import { gfMul, gfInv } from './gf256.mjs';

function validate(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) throw new TypeError('ARCA_MATRIX_INVALID');
  const width = matrix[0].length;
  if (!width || matrix.some((row) => !Array.isArray(row) || row.length !== width)) throw new TypeError('ARCA_MATRIX_RAGGED');
  for (const row of matrix) for (const value of row) if (!Number.isInteger(value) || value < 0 || value > 255) throw new TypeError('ARCA_MATRIX_BYTE_INVALID');
  return width;
}

export function identity(size) {
  if (!Number.isSafeInteger(size) || size < 1) throw new RangeError('ARCA_MATRIX_SIZE_INVALID');
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => (r === c ? 1 : 0)));
}

export function multiply(a, b) {
  const aWidth = validate(a);
  const bWidth = validate(b);
  if (aWidth !== b.length) throw new RangeError('ARCA_MATRIX_DIMENSION_MISMATCH');
  return Array.from({ length: a.length }, (_, r) => Array.from({ length: bWidth }, (_, c) => {
    let value = 0;
    for (let k = 0; k < aWidth; k += 1) value ^= gfMul(a[r][k], b[k][c]);
    return value;
  }));
}

export function invert(matrix) {
  const width = validate(matrix);
  if (matrix.length !== width) throw new RangeError('ARCA_MATRIX_NOT_SQUARE');
  const aug = matrix.map((row, r) => [...row, ...identity(width)[r]]);
  for (let col = 0; col < width; col += 1) {
    let pivot = col;
    while (pivot < width && aug[pivot][col] === 0) pivot += 1;
    if (pivot === width) throw new RangeError('ARCA_MATRIX_SINGULAR');
    if (pivot !== col) [aug[pivot], aug[col]] = [aug[col], aug[pivot]];
    const inv = gfInv(aug[col][col]);
    for (let c = 0; c < width * 2; c += 1) aug[col][c] = gfMul(aug[col][c], inv);
    for (let r = 0; r < width; r += 1) {
      if (r === col || aug[r][col] === 0) continue;
      const factor = aug[r][col];
      for (let c = 0; c < width * 2; c += 1) aug[r][c] ^= gfMul(factor, aug[col][c]);
    }
  }
  return aug.map((row) => row.slice(width));
}
