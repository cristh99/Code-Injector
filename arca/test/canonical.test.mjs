import test from 'node:test'; import assert from 'node:assert/strict';
import { canonicalize, sha256Hex, sha256Canonical } from '../src/canonical.mjs';
test('canonical JSON sorts object keys recursively and preserves arrays',()=>assert.equal(canonicalize({z:1,a:{y:2,x:3},b:[2,1]}),'{"a":{"x":3,"y":2},"b":[2,1],"z":1}'));
test('canonical JSON rejects unsafe and non-finite numbers',()=>{assert.throws(()=>canonicalize({x:Number.MAX_SAFE_INTEGER+1}));assert.throws(()=>canonicalize({x:Infinity}));});
test('canonical JSON rejects undefined instead of dropping it',()=>assert.throws(()=>canonicalize({x:undefined})));
test('canonical hash ignores object insertion order',()=>assert.equal(sha256Canonical({b:2,a:1}),sha256Canonical({a:1,b:2})));
test('sha256 hashes exact bytes',()=>assert.equal(sha256Hex(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
