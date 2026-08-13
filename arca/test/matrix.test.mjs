import test from 'node:test'; import assert from 'node:assert/strict';
import { identity, invert, multiply } from '../src/matrix.mjs'; import { systematicGenerator } from '../src/transport.mjs';
test('matrix inversion returns identity',()=>assert.deepEqual(multiply([[1,2,3],[4,5,6],[7,8,10]],invert([[1,2,3],[4,5,6],[7,8,10]])),identity(3)));
test('singular matrix fails closed',()=>assert.throws(()=>invert([[1,2],[2,4]])));
test('systematic generator begins with identity',()=>assert.deepEqual(systematicGenerator(4,2).slice(0,4),identity(4)));
test('invalid shard dimensions fail closed',()=>{assert.throws(()=>systematicGenerator(0,2));assert.throws(()=>systematicGenerator(250,10));});
