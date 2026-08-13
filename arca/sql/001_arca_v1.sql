-- ARCA v1.0.0 additive migration. Production application requires separate authorization.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_memory.arca_schema_versions_v1(
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agent_memory.arca_artifact_manifests_v1(
  manifest_sha256 text PRIMARY KEY CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_id text NOT NULL,
  artifact_ref text NOT NULL,
  media_type text NOT NULL,
  original_size bigint NOT NULL CHECK (original_size >= 0),
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  encoded_size bigint NOT NULL CHECK (encoded_size >= 0),
  encoded_sha256 text NOT NULL CHECK (encoded_sha256 ~ '^[0-9a-f]{64}$'),
  data_shards integer NOT NULL CHECK (data_shards >= 1),
  parity_shards integer NOT NULL CHECK (parity_shards >= 1),
  total_shards integer NOT NULL CHECK (total_shards=data_shards+parity_shards AND total_shards<=255),
  shard_size integer NOT NULL CHECK (shard_size >= 1),
  transport_epoch bigint NOT NULL CHECK (transport_epoch >= 0),
  session_fence_sha256 text CHECK (session_fence_sha256 IS NULL OR session_fence_sha256 ~ '^[0-9a-f]{64}$'),
  storage_mode text NOT NULL CHECK (storage_mode IN ('POINTER_ONLY','NEON_SHARDS')),
  manifest jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETE','REVOKED','EXPIRED')),
  created_by_agent_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(artifact_id,transport_epoch)
);
CREATE INDEX IF NOT EXISTS arca_artifact_manifests_v1_artifact_idx ON agent_memory.arca_artifact_manifests_v1(artifact_id,transport_epoch DESC);
CREATE INDEX IF NOT EXISTS arca_artifact_manifests_v1_status_idx ON agent_memory.arca_artifact_manifests_v1(status,expires_at);

CREATE TABLE IF NOT EXISTS agent_memory.arca_shards_v1(
  manifest_sha256 text NOT NULL REFERENCES agent_memory.arca_artifact_manifests_v1(manifest_sha256) ON DELETE CASCADE,
  shard_index integer NOT NULL CHECK (shard_index BETWEEN 0 AND 254),
  shard_role text NOT NULL CHECK (shard_role IN ('data','parity')),
  shard_size integer NOT NULL CHECK (shard_size >= 1),
  shard_sha256 text NOT NULL CHECK (shard_sha256 ~ '^[0-9a-f]{64}$'),
  shard_bytes bytea NOT NULL,
  stored_by_agent_id text NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(manifest_sha256,shard_index),
  CHECK (octet_length(shard_bytes)=shard_size),
  CHECK (encode(digest(shard_bytes,'sha256'),'hex')=shard_sha256)
);

CREATE OR REPLACE FUNCTION agent_memory.arca_canonical_json_v1(p_value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE v_type text:=jsonb_typeof(p_value); v_result text;
BEGIN
  IF v_type='object' THEN
    SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||agent_memory.arca_canonical_json_v1(value),',' ORDER BY key COLLATE "C"),'')||'}'
      INTO v_result FROM jsonb_each(p_value); RETURN v_result;
  ELSIF v_type='array' THEN
    SELECT '['||coalesce(string_agg(agent_memory.arca_canonical_json_v1(value),',' ORDER BY ordinal),'')||']'
      INTO v_result FROM jsonb_array_elements(p_value) WITH ORDINALITY AS x(value,ordinal); RETURN v_result;
  ELSIF v_type='number' THEN RETURN trim_scale((p_value#>>'{}')::numeric)::text;
  END IF;
  RETURN p_value::text;
END $$;

CREATE OR REPLACE FUNCTION agent_memory.arca_merkle_root_v1(p_shards jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE v_level bytea[]:=ARRAY[]::bytea[]; v_next bytea[]; v_leaf jsonb; v_left bytea; v_right bytea; v_len integer; i integer;
BEGIN
  IF jsonb_typeof(p_shards)<>'array' OR jsonb_array_length(p_shards)=0 THEN RAISE EXCEPTION 'ARCA_MERKLE_REQUIRES_LEAVES'; END IF;
  FOR v_leaf IN SELECT value FROM jsonb_array_elements(p_shards) WITH ORDINALITY x(value,ordinal) ORDER BY ordinal LOOP
    v_level:=array_append(v_level,digest(decode('00','hex')||convert_to(agent_memory.arca_canonical_json_v1(v_leaf),'UTF8'),'sha256'));
  END LOOP;
  WHILE coalesce(array_length(v_level,1),0)>1 LOOP
    v_next:=ARRAY[]::bytea[]; v_len:=array_length(v_level,1); i:=1;
    WHILE i<=v_len LOOP
      v_left:=v_level[i]; v_right:=CASE WHEN i+1<=v_len THEN v_level[i+1] ELSE v_left END;
      v_next:=array_append(v_next,digest(decode('01','hex')||v_left||v_right,'sha256')); i:=i+2;
    END LOOP; v_level:=v_next;
  END LOOP;
  RETURN encode(v_level[1],'hex');
END $$;

CREATE OR REPLACE FUNCTION agent_memory.arca_manifest_valid_v1(p_manifest jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE expected_hash text; expected_merkle text; capacity numeric;
BEGIN
  IF jsonb_typeof(p_manifest)<>'object' OR p_manifest->>'format'<>'arca-manifest-v1' OR p_manifest->>'generator'<>'systematic-vandermonde-v1' OR p_manifest->>'gf_polynomial'<>'285' THEN RETURN false; END IF;
  IF p_manifest->>'compression' NOT IN ('none','gzip') OR coalesce(p_manifest->>'original_sha256','')!~'^[0-9a-f]{64}$' OR coalesce(p_manifest->>'encoded_sha256','')!~'^[0-9a-f]{64}$' OR coalesce(p_manifest->>'manifest_sha256','')!~'^[0-9a-f]{64}$' THEN RETURN false; END IF;
  IF (p_manifest->>'data_shards')::integer<1 OR (p_manifest->>'parity_shards')::integer<1 OR (p_manifest->>'total_shards')::integer<>(p_manifest->>'data_shards')::integer+(p_manifest->>'parity_shards')::integer OR (p_manifest->>'total_shards')::integer>255 THEN RETURN false; END IF;
  IF jsonb_typeof(p_manifest->'shards')<>'array' OR jsonb_array_length(p_manifest->'shards')<>(p_manifest->>'total_shards')::integer THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest->'shards') WITH ORDINALITY s(v,n) WHERE (v->>'index')::integer<>n-1 OR (v->>'size')::integer<>(p_manifest->>'shard_size')::integer OR coalesce(v->>'sha256','')!~'^[0-9a-f]{64}$') THEN RETURN false; END IF;
  capacity:=(p_manifest->>'data_shards')::numeric*(p_manifest->>'shard_size')::numeric;
  IF (p_manifest->>'encoded_size')::numeric>capacity OR (p_manifest->>'padding_bytes')::numeric<>capacity-(p_manifest->>'encoded_size')::numeric THEN RETURN false; END IF;
  expected_merkle:=agent_memory.arca_merkle_root_v1(p_manifest->'shards'); IF expected_merkle<>p_manifest->>'merkle_root' THEN RETURN false; END IF;
  expected_hash:=encode(digest(convert_to(agent_memory.arca_canonical_json_v1(p_manifest-'manifest_sha256'),'UTF8'),'sha256'),'hex');
  RETURN expected_hash=p_manifest->>'manifest_sha256';
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION agent_memory.arca_register_manifest_v1(p_manifest jsonb,p_storage_mode text,p_created_by_agent_id text,p_expires_at timestamptz DEFAULT NULL,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS agent_memory.arca_artifact_manifests_v1 LANGUAGE plpgsql AS $$
DECLARE r agent_memory.arca_artifact_manifests_v1%ROWTYPE; latest bigint; total_storage numeric;
BEGIN
  IF NOT agent_memory.arca_manifest_valid_v1(p_manifest) THEN RAISE EXCEPTION 'ARCA_MANIFEST_INVALID'; END IF;
  IF p_storage_mode NOT IN ('POINTER_ONLY','NEON_SHARDS') THEN RAISE EXCEPTION 'ARCA_STORAGE_MODE_INVALID'; END IF;
  IF p_storage_mode='NEON_SHARDS' THEN total_storage:=(p_manifest->>'total_shards')::numeric*(p_manifest->>'shard_size')::numeric; IF (p_manifest->>'encoded_size')::numeric>16777216 OR total_storage>33554432 THEN RAISE EXCEPTION 'ARCA_NEON_SHARD_STORAGE_LIMIT_EXCEEDED'; END IF; END IF;
  SELECT max(transport_epoch) INTO latest FROM agent_memory.arca_artifact_manifests_v1 WHERE artifact_id=p_manifest->>'artifact_id';
  IF latest IS NOT NULL AND (p_manifest->>'transport_epoch')::bigint<latest THEN RAISE EXCEPTION 'ARCA_TRANSPORT_EPOCH_STALE'; END IF;
  INSERT INTO agent_memory.arca_artifact_manifests_v1(manifest_sha256,artifact_id,artifact_ref,media_type,original_size,original_sha256,encoded_size,encoded_sha256,data_shards,parity_shards,total_shards,shard_size,transport_epoch,session_fence_sha256,storage_mode,manifest,created_by_agent_id,expires_at,metadata)
  VALUES(p_manifest->>'manifest_sha256',p_manifest->>'artifact_id',p_manifest->>'artifact_ref',p_manifest->>'media_type',(p_manifest->>'original_size')::bigint,p_manifest->>'original_sha256',(p_manifest->>'encoded_size')::bigint,p_manifest->>'encoded_sha256',(p_manifest->>'data_shards')::integer,(p_manifest->>'parity_shards')::integer,(p_manifest->>'total_shards')::integer,(p_manifest->>'shard_size')::integer,(p_manifest->>'transport_epoch')::bigint,nullif(p_manifest->>'session_fence_sha256',''),p_storage_mode,p_manifest,btrim(p_created_by_agent_id),p_expires_at,coalesce(p_metadata,'{}'::jsonb))
  ON CONFLICT(manifest_sha256) DO UPDATE SET metadata=agent_memory.arca_artifact_manifests_v1.metadata||excluded.metadata RETURNING * INTO r; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION agent_memory.arca_store_shard_v1(p_manifest_sha256 text,p_shard_index integer,p_shard_bytes bytea,p_stored_by_agent_id text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS agent_memory.arca_shards_v1 LANGUAGE plpgsql AS $$
DECLARE m agent_memory.arca_artifact_manifests_v1%ROWTYPE; d jsonb; r agent_memory.arca_shards_v1%ROWTYPE; h text;
BEGIN
  SELECT * INTO m FROM agent_memory.arca_artifact_manifests_v1 WHERE manifest_sha256=lower(p_manifest_sha256) FOR SHARE;
  IF NOT FOUND OR m.status<>'ACTIVE' OR m.storage_mode<>'NEON_SHARDS' THEN RAISE EXCEPTION 'ARCA_MANIFEST_NOT_ACTIVE'; END IF;
  IF p_shard_index<0 OR p_shard_index>=m.total_shards THEN RAISE EXCEPTION 'ARCA_SHARD_INDEX_INVALID'; END IF;
  d:=m.manifest->'shards'->p_shard_index; h:=encode(digest(p_shard_bytes,'sha256'),'hex');
  IF octet_length(p_shard_bytes)<>(d->>'size')::integer OR h<>d->>'sha256' THEN RAISE EXCEPTION 'ARCA_SHARD_BYTES_INVALID'; END IF;
  INSERT INTO agent_memory.arca_shards_v1(manifest_sha256,shard_index,shard_role,shard_size,shard_sha256,shard_bytes,stored_by_agent_id,metadata)
  VALUES(m.manifest_sha256,p_shard_index,d->>'role',(d->>'size')::integer,d->>'sha256',p_shard_bytes,btrim(p_stored_by_agent_id),coalesce(p_metadata,'{}'::jsonb))
  ON CONFLICT(manifest_sha256,shard_index) DO UPDATE SET metadata=agent_memory.arca_shards_v1.metadata||excluded.metadata RETURNING * INTO r; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION agent_memory.arca_transport_certificate_v1(p_manifest_sha256 text,p_expected_epoch bigint DEFAULT NULL,p_expected_session_fence_sha256 text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE m agent_memory.arca_artifact_manifests_v1%ROWTYPE; n integer; missing jsonb; bitmap text; state text;
BEGIN
  SELECT * INTO m FROM agent_memory.arca_artifact_manifests_v1 WHERE manifest_sha256=lower(p_manifest_sha256);
  IF NOT FOUND THEN RAISE EXCEPTION 'ARCA_MANIFEST_NOT_FOUND'; END IF;
  IF p_expected_epoch IS NOT NULL AND m.transport_epoch<>p_expected_epoch THEN RAISE EXCEPTION 'ARCA_TRANSPORT_EPOCH_STALE'; END IF;
  IF p_expected_session_fence_sha256 IS NOT NULL AND m.session_fence_sha256 IS DISTINCT FROM lower(p_expected_session_fence_sha256) THEN RAISE EXCEPTION 'ARCA_SESSION_FENCE_MISMATCH'; END IF;
  SELECT count(s.shard_index),coalesce(jsonb_agg(i ORDER BY i) FILTER(WHERE s.shard_index IS NULL),'[]'::jsonb),string_agg(CASE WHEN s.shard_index IS NULL THEN '1' ELSE '0' END,'' ORDER BY i)
  INTO n,missing,bitmap FROM generate_series(0,m.total_shards-1)i LEFT JOIN agent_memory.arca_shards_v1 s ON s.manifest_sha256=m.manifest_sha256 AND s.shard_index=i;
  state:=CASE WHEN n=m.total_shards THEN 'READY' WHEN n>=m.data_shards THEN 'RECOVERABLE' ELSE 'BLOCKED_TRANSPORT' END;
  RETURN jsonb_build_object('format','arca-transport-certificate-v1','status',state,'manifest_sha256',m.manifest_sha256,'artifact_id',m.artifact_id,'valid_count',n,'data_shards',m.data_shards,'parity_shards',m.parity_shards,'total_shards',m.total_shards,'missing_indexes',missing,'nack_bitmap',bitmap,'transport_epoch',m.transport_epoch,'session_fence_sha256',m.session_fence_sha256);
END $$;

CREATE OR REPLACE VIEW agent_memory.arca_transport_readiness_v1 AS
SELECT manifest_sha256,artifact_id,artifact_ref,storage_mode,status AS manifest_status,transport_epoch,created_at,expires_at,agent_memory.arca_transport_certificate_v1(manifest_sha256,NULL,NULL) AS certificate
FROM agent_memory.arca_artifact_manifests_v1 WHERE status IN ('ACTIVE','COMPLETE') AND (expires_at IS NULL OR expires_at>now());

INSERT INTO agent_memory.arca_schema_versions_v1(version,metadata)
VALUES('1.0.0',jsonb_build_object('format','arca-schema-version-v1','additive',true,'production_applied',false,'neon_shard_encoded_bytes_max',16777216,'neon_total_shard_bytes_max',33554432,'external_spend_usd',0))
ON CONFLICT(version) DO UPDATE SET metadata=excluded.metadata;
