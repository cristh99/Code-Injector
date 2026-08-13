import { createHash } from 'node:crypto';

function fail(code) {
  throw new Error(code);
}

export function canonicalJson(value) {
  if (value === undefined) fail('CRONOS_CANONICAL_UNDEFINED');
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('CRONOS_CANONICAL_NONFINITE_NUMBER');
    if (!Number.isSafeInteger(value)) fail('CRONOS_CANONICAL_UNSAFE_NUMBER');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, 'en'));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  fail('CRONOS_CANONICAL_UNSUPPORTED_TYPE');
}

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashJson(value) {
  return hashBytes(Buffer.from(canonicalJson(value), 'utf8'));
}
