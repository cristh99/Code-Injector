import test from 'node:test'; import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
test('package is dependency-free and allowlisted',()=>{assert.equal(p.dependencies,undefined);assert.deepEqual(p.files,['src','sql','examples','README.md','LICENSE','ARCA-V1-SCHEMA-MANIFEST.json','ARCA-V1-CANARY-RECEIPT.json']);});
test('package requires Node 22 and exposes CLI',()=>{assert.equal(p.engines.node,'>=22');assert.equal(p.bin.arca,'src/cli.mjs');});
test('package export target is canonical and warning-free',()=>assert.equal(p.exports,'./src/index.mjs'));
