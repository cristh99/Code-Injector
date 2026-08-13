const POLY = 0x11d;
const EXP = new Uint8Array(512);
const LOG = new Int16Array(256).fill(-1);
let x = 1;
for (let i = 0; i < 255; i += 1) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= POLY;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

export const GF_POLYNOMIAL = POLY;
export const gfAdd = (a, b) => a ^ b;
export const gfSub = gfAdd;
export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}
export function gfDiv(a, b) {
  if (b === 0) throw new RangeError('ARCA_GF_DIVIDE_BY_ZERO');
  if (a === 0) return 0;
  let e = LOG[a] - LOG[b];
  if (e < 0) e += 255;
  return EXP[e];
}
export function gfInv(a) {
  if (a === 0) throw new RangeError('ARCA_GF_INVERSE_ZERO');
  return EXP[255 - LOG[a]];
}
export function gfPow(a, power) {
  if (!Number.isSafeInteger(power) || power < 0) throw new RangeError('ARCA_GF_POWER_INVALID');
  if (power === 0) return 1;
  if (a === 0) return 0;
  return EXP[(LOG[a] * power) % 255];
}
