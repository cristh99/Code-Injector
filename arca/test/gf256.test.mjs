import test from 'node:test'; import assert from 'node:assert/strict'; import {gfAdd,gfMul,gfDiv,gfInv,gfPow} from '../src/gf256.mjs';
test('GF addition is XOR',()=>assert.equal(gfAdd(0xa5,0x5a),0xff));
test('GF multiplication identities',()=>{for(const x of [0,1,2,17,255]){assert.equal(gfMul(x,0),0);assert.equal(gfMul(x,1),x);}});
test('GF division reverses multiplication',()=>{for(const a of [1,2,17,255])for(const b of [1,3,19,200])assert.equal(gfDiv(gfMul(a,b),b),a);});
test('GF inverse works',()=>{for(const x of [1,2,17,255])assert.equal(gfMul(x,gfInv(x)),1);});
test('GF power follows multiplication',()=>assert.equal(gfPow(7,4),gfMul(gfMul(gfMul(7,7),7),7)));
test('zero division fails closed',()=>{assert.throws(()=>gfDiv(1,0));assert.throws(()=>gfInv(0));});
