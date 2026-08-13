-- Run only in a disposable Neon branch.
BEGIN;
SELECT version FROM agent_memory.arca_schema_versions_v1 WHERE version='1.0.0';
SELECT count(*) AS synthetic_manifests FROM agent_memory.arca_artifact_manifests_v1 WHERE artifact_id LIKE 'arca-canary-%';
SELECT count(*) AS synthetic_shards FROM agent_memory.arca_shards_v1 WHERE manifest_sha256 IN (SELECT manifest_sha256 FROM agent_memory.arca_artifact_manifests_v1 WHERE artifact_id LIKE 'arca-canary-%');
ROLLBACK;
