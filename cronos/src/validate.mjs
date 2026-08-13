import { ALLOWED_PATHS, POLICIES } from './constants.mjs';
import { cronosError } from './errors.mjs';
import { hasOwn } from './path.mjs';

export function validateRaw(raw, seen) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) cronosError('CRONOS_INVARIANT_INVALID');
  if (hasOwn(raw, 'expected') || hasOwn(raw, 'cut_value')) cronosError('CRONOS_PRODUCER_EXPECTED_FORBIDDEN');
  const path = raw.path;
  const policy = String(raw.policy ?? '').toUpperCase();
  if (!ALLOWED_PATHS.has(path) || !POLICIES.has(policy)) cronosError('CRONOS_INVARIANT_INVALID');
  if (seen.has(path)) cronosError('CRONOS_DUPLICATE_INVARIANT_PATH');
  seen.add(path);
  return { path, policy };
}
