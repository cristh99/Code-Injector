import { createHash } from 'node:crypto';

function normalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw new TypeError('ARCA_CANONICAL_UNSAFE_NUMBER');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('ARCA_CANONICAL_UNSUPPORTED_VALUE');
  if (seen.has(value)) throw new TypeError('ARCA_CANONICAL_CYCLE');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => normalize(item, seen));
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError('ARCA_CANONICAL_NONPLAIN_OBJECT');
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined || typeof child === 'function' || typeof child === 'symbol') {
        throw new TypeError('ARCA_CANONICAL_UNSUPPORTED_VALUE');
      }
      out[key] = normalize(child, seen);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

export function canonicalize(value) {
  return JSON.stringify(normalize(value, new Set()));
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Canonical(value) {
  return sha256Hex(Buffer.from(canonicalize(value), 'utf8'));
}
