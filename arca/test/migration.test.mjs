import test from 'node:test'; import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../sql/001_arca_v1.sql',import.meta.url),'utf8');
test('migration is additive and creates ARCA surfaces',()=>{for(const token of ['arca_schema_versions_v1','arca_artifact_manifests_v1','arca_shards_v1','arca_transport_certificate_v1','arca_transport_readiness_v1'])assert.match(sql,new RegExp(token));assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM agent_memory\.(?!arca_)/i);});
test('migration validates hashes and bounds Neon shard storage',()=>{assert.match(sql,/digest\(shard_bytes,'sha256'\)/);assert.match(sql,/33554432/);assert.match(sql,/16777216/);});
