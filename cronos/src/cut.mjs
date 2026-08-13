import { cronosError } from './errors.mjs';
import { getPath } from './path.mjs';

export function readCut(path, policy, cutState) {
  const value = getPath(cutState, path);
  if (value === undefined) cronosError('CRONOS_STATE_VECTOR_INVALID');
  return { path, policy, cutValue: value };
}
