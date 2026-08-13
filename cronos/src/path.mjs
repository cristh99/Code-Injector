export function getPath(state, path) {
  let value = state;
  for (const part of path.split('.')) value = value?.[part];
  return value;
}

export function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
