#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { encodeArtifact, inspectShards, recoverArtifact } from './transport.mjs';

function options(args) {
  const out = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [key, value = 'true'] = arg.slice(2).split('=', 2);
    out[key] = value;
  }
  return out;
}
function indexes(value) {
  return new Set(value ? value.split(',').filter(Boolean).map((v) => Number.parseInt(v, 10)) : []);
}
async function loadShardMap(dir, manifest, opts = {}) {
  const missing = indexes(opts.missing);
  const corrupt = indexes(opts.corrupt);
  const files = new Set(await readdir(dir));
  const map = new Map();
  for (const descriptor of manifest.shards) {
    if (missing.has(descriptor.index)) continue;
    const name = `shard-${String(descriptor.index).padStart(3, '0')}.bin`;
    if (!files.has(name)) continue;
    const bytes = Buffer.from(await readFile(join(dir, name)));
    if (corrupt.has(descriptor.index) && bytes.length) bytes[0] ^= 0xff;
    map.set(descriptor.index, bytes);
  }
  return map;
}
function output(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = code;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'encode') {
    const [input, outputDir] = args;
    if (!input || !outputDir) throw new Error('USAGE: arca encode <input> <outputDir> [--data=10 --parity=5]');
    const opts = options(args.slice(2));
    const encoded = encodeArtifact(await readFile(input), {
      artifactId: opts['artifact-id'] ?? `file:${input}`,
      artifactRef: opts['artifact-ref'] ?? `file:${input}`,
      mediaType: opts['media-type'] ?? 'application/octet-stream',
      dataShards: Number.parseInt(opts.data ?? '10', 10), parityShards: Number.parseInt(opts.parity ?? '5', 10),
      compression: opts.compression ?? 'none', transportEpoch: Number.parseInt(opts.epoch ?? '1', 10),
      sessionFenceSha256: opts.fence ?? null,
    });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(encoded.manifest, null, 2)}\n`);
    for (const shard of encoded.shards) await writeFile(join(outputDir, `shard-${String(shard.index).padStart(3, '0')}.bin`), shard.bytes);
    output({ status: 'ENCODED', manifest_sha256: encoded.manifest.manifest_sha256, original_sha256: encoded.manifest.original_sha256, total_shards: encoded.manifest.total_shards });
  } else if (command === 'verify') {
    const [manifestFile, shardDir] = args;
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    const result = inspectShards(manifest, await loadShardMap(shardDir, manifest, options(args.slice(2))));
    output({ ...result, valid: undefined }, result.status === 'BLOCKED_TRANSPORT' ? 2 : 0);
  } else if (command === 'recover') {
    const [manifestFile, shardDir, outputFile] = args;
    if (!manifestFile || !shardDir || !outputFile) throw new Error('USAGE: arca recover <manifest> <shardDir> <output>');
    const opts = options(args.slice(3));
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    const bytes = recoverArtifact(manifest, await loadShardMap(shardDir, manifest, opts), {
      expectedEpoch: opts.epoch == null ? undefined : Number.parseInt(opts.epoch, 10),
      expectedSessionFenceSha256: opts.fence,
    });
    await writeFile(outputFile, bytes);
    output({ status: 'RECOVERED', bytes: bytes.length, original_sha256: manifest.original_sha256, output: outputFile });
  } else {
    throw new Error('USAGE: arca <encode|verify|recover> ...');
  }
} catch (error) {
  output({ status: 'FAIL_CLOSED', error: error.message }, 2);
}
