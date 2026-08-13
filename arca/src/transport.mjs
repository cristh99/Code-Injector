import { gzipSync, gunzipSync } from 'node:zlib';
import { canonicalize, sha256Hex, sha256Canonical } from './canonical.mjs';
import { gfMul, gfPow, GF_POLYNOMIAL } from './gf256.mjs';
import { invert, multiply } from './matrix.mjs';

const FORMAT = 'arca-manifest-v1';
const GENERATOR = 'systematic-vandermonde-v1';
const MAX_SHARDS = 255;
const HEX64 = /^[0-9a-f]{64}$/;

function assertCount(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SHARDS) throw new RangeError(`ARCA_${name}_INVALID`);
}
function assertText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`ARCA_${name}_REQUIRED`);
  return value.trim();
}
function normalizeFence(value) {
  if (value == null) return null;
  const text = String(value).toLowerCase();
  if (!HEX64.test(text)) throw new TypeError('ARCA_SESSION_FENCE_INVALID');
  return text;
}

export function systematicGenerator(dataShards, parityShards) {
  assertCount(dataShards, 'DATA_SHARDS');
  assertCount(parityShards, 'PARITY_SHARDS');
  const total = dataShards + parityShards;
  if (total > MAX_SHARDS) throw new RangeError('ARCA_TOTAL_SHARDS_INVALID');
  const vandermonde = Array.from({ length: total }, (_, r) => Array.from({ length: dataShards }, (_, c) => gfPow(r + 1, c)));
  const topInverse = invert(vandermonde.slice(0, dataShards));
  return multiply(vandermonde, topInverse);
}

function combine(coefficients, shards, shardSize) {
  const out = Buffer.alloc(shardSize);
  for (let s = 0; s < coefficients.length; s += 1) {
    const coefficient = coefficients[s];
    if (!coefficient) continue;
    const shard = shards[s];
    for (let i = 0; i < shardSize; i += 1) out[i] ^= gfMul(coefficient, shard[i]);
  }
  return out;
}

function leafHash(descriptor) {
  return Buffer.from(sha256Hex(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalize(descriptor), 'utf8')])), 'hex');
}
export function merkleRoot(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length === 0) throw new TypeError('ARCA_MERKLE_REQUIRES_LEAVES');
  let level = descriptors.map(leafHash);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(Buffer.from(sha256Hex(Buffer.concat([Buffer.from([1]), left, right])), 'hex'));
    }
    level = next;
  }
  return level[0].toString('hex');
}

export function encodeArtifact(input, options = {}) {
  const original = Buffer.from(input);
  const dataShards = options.dataShards ?? 10;
  const parityShards = options.parityShards ?? 5;
  assertCount(dataShards, 'DATA_SHARDS');
  assertCount(parityShards, 'PARITY_SHARDS');
  if (dataShards + parityShards > MAX_SHARDS) throw new RangeError('ARCA_TOTAL_SHARDS_INVALID');
  const compression = options.compression ?? 'none';
  if (!['none', 'gzip'].includes(compression)) throw new TypeError('ARCA_COMPRESSION_INVALID');
  const encoded = compression === 'gzip' ? gzipSync(original, { level: 9, mtime: 0 }) : Buffer.from(original);
  const shardSize = Math.max(1, Math.ceil(encoded.length / dataShards));
  const padded = Buffer.alloc(shardSize * dataShards);
  encoded.copy(padded);
  const data = Array.from({ length: dataShards }, (_, i) => padded.subarray(i * shardSize, (i + 1) * shardSize));
  const generator = systematicGenerator(dataShards, parityShards);
  const shards = generator.map((row, index) => ({ index, bytes: combine(row, data, shardSize) }));
  const descriptors = shards.map(({ index, bytes }) => ({
    index,
    role: index < dataShards ? 'data' : 'parity',
    size: bytes.length,
    sha256: sha256Hex(bytes),
  }));
  const manifestWithoutHash = {
    format: FORMAT,
    artifact_id: assertText(options.artifactId ?? `sha256:${sha256Hex(original)}`, 'ARTIFACT_ID'),
    artifact_ref: assertText(options.artifactRef ?? 'memory:artifact', 'ARTIFACT_REF'),
    media_type: assertText(options.mediaType ?? 'application/octet-stream', 'MEDIA_TYPE'),
    original_size: original.length,
    original_sha256: sha256Hex(original),
    compression,
    encoded_size: encoded.length,
    encoded_sha256: sha256Hex(encoded),
    data_shards: dataShards,
    parity_shards: parityShards,
    total_shards: dataShards + parityShards,
    shard_size: shardSize,
    padding_bytes: padded.length - encoded.length,
    gf_polynomial: GF_POLYNOMIAL,
    generator: GENERATOR,
    transport_epoch: options.transportEpoch ?? 1,
    session_fence_sha256: normalizeFence(options.sessionFenceSha256),
    shards: descriptors,
    merkle_root: merkleRoot(descriptors),
  };
  if (!Number.isSafeInteger(manifestWithoutHash.transport_epoch) || manifestWithoutHash.transport_epoch < 0) throw new RangeError('ARCA_TRANSPORT_EPOCH_INVALID');
  const manifest = { ...manifestWithoutHash, manifest_sha256: sha256Canonical(manifestWithoutHash) };
  return { manifest, shards, generator };
}

const MANIFEST_KEYS = new Set(['format','artifact_id','artifact_ref','media_type','original_size','original_sha256','compression','encoded_size','encoded_sha256','data_shards','parity_shards','total_shards','shard_size','padding_bytes','gf_polynomial','generator','transport_epoch','session_fence_sha256','shards','merkle_root','manifest_sha256']);
const DESCRIPTOR_KEYS = new Set(['index','role','size','sha256']);
export function validateManifest(manifest) {
  try {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return false;
    if (Object.keys(manifest).some((key) => !MANIFEST_KEYS.has(key))) return false;
    if (manifest.format !== FORMAT || manifest.generator !== GENERATOR || manifest.gf_polynomial !== GF_POLYNOMIAL) return false;
    if (!['none','gzip'].includes(manifest.compression)) return false;
    for (const key of ['artifact_id','artifact_ref','media_type']) if (typeof manifest[key] !== 'string' || !manifest[key].trim()) return false;
    for (const key of ['original_sha256','encoded_sha256','merkle_root','manifest_sha256']) if (!HEX64.test(manifest[key])) return false;
    if (manifest.session_fence_sha256 !== null && !HEX64.test(manifest.session_fence_sha256)) return false;
    for (const key of ['original_size','encoded_size','data_shards','parity_shards','total_shards','shard_size','padding_bytes','gf_polynomial','transport_epoch']) if (!Number.isSafeInteger(manifest[key]) || manifest[key] < 0) return false;
    if (manifest.data_shards < 1 || manifest.parity_shards < 1 || manifest.total_shards !== manifest.data_shards + manifest.parity_shards || manifest.total_shards > MAX_SHARDS || manifest.shard_size < 1) return false;
    if (manifest.encoded_size > manifest.data_shards * manifest.shard_size || manifest.padding_bytes !== manifest.data_shards * manifest.shard_size - manifest.encoded_size) return false;
    if (manifest.compression === 'none' && (manifest.original_size !== manifest.encoded_size || manifest.original_sha256 !== manifest.encoded_sha256)) return false;
    if (!Array.isArray(manifest.shards) || manifest.shards.length !== manifest.total_shards) return false;
    for (let i = 0; i < manifest.shards.length; i += 1) {
      const descriptor = manifest.shards[i];
      if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor) || Object.keys(descriptor).some((key) => !DESCRIPTOR_KEYS.has(key))) return false;
      if (descriptor.index !== i || descriptor.size !== manifest.shard_size || descriptor.role !== (i < manifest.data_shards ? 'data' : 'parity') || !HEX64.test(descriptor.sha256)) return false;
    }
    if (merkleRoot(manifest.shards) !== manifest.merkle_root) return false;
    const { manifest_sha256, ...withoutHash } = manifest;
    return sha256Canonical(withoutHash) === manifest_sha256;
  } catch {
    return false;
  }
}

function asMap(input) {
  if (input instanceof Map) return new Map(input);
  if (!Array.isArray(input)) throw new TypeError('ARCA_SHARDS_COLLECTION_INVALID');
  return new Map(input.map((item) => [item.index, item.bytes]));
}
export function inspectShards(manifest, input) {
  if (!validateManifest(manifest)) throw new TypeError('ARCA_MANIFEST_INVALID');
  const supplied = asMap(input);
  const valid = new Map();
  const missing = [];
  const corrupt = [];
  for (const descriptor of manifest.shards) {
    const bytes = supplied.get(descriptor.index);
    if (bytes == null) { missing.push(descriptor.index); continue; }
    const buffer = Buffer.from(bytes);
    if (buffer.length !== descriptor.size || sha256Hex(buffer) !== descriptor.sha256) corrupt.push(descriptor.index);
    else valid.set(descriptor.index, buffer);
  }
  const nack = manifest.shards.map(({ index }) => (valid.has(index) ? '0' : '1')).join('');
  return {
    status: valid.size === manifest.total_shards ? 'READY' : valid.size >= manifest.data_shards ? 'RECOVERABLE' : 'BLOCKED_TRANSPORT',
    valid, valid_count: valid.size, missing_indexes: missing, corrupt_indexes: corrupt, nack_bitmap: nack,
  };
}

export function recoverArtifact(manifest, input, options = {}) {
  if (!validateManifest(manifest)) throw new TypeError('ARCA_MANIFEST_INVALID');
  if (options.expectedEpoch != null && options.expectedEpoch !== manifest.transport_epoch) throw new Error('ARCA_TRANSPORT_EPOCH_STALE');
  if (options.expectedSessionFenceSha256 != null && String(options.expectedSessionFenceSha256).toLowerCase() !== manifest.session_fence_sha256) throw new Error('ARCA_SESSION_FENCE_MISMATCH');
  const inspection = inspectShards(manifest, input);
  if (inspection.valid_count < manifest.data_shards) throw new Error('ARCA_INSUFFICIENT_VALID_SHARDS');
  const chosen = [...inspection.valid.entries()].slice(0, manifest.data_shards);
  const generator = systematicGenerator(manifest.data_shards, manifest.parity_shards);
  const decode = invert(chosen.map(([index]) => generator[index]));
  const selectedBuffers = chosen.map(([, bytes]) => bytes);
  const data = decode.map((row) => combine(row, selectedBuffers, manifest.shard_size));
  const encoded = Buffer.concat(data).subarray(0, manifest.encoded_size);
  if (sha256Hex(encoded) !== manifest.encoded_sha256) throw new Error('ARCA_ENCODED_HASH_MISMATCH');
  const original = manifest.compression === 'gzip' ? gunzipSync(encoded) : encoded;
  if (original.length !== manifest.original_size || sha256Hex(original) !== manifest.original_sha256) throw new Error('ARCA_ORIGINAL_HASH_MISMATCH');
  return original;
}
