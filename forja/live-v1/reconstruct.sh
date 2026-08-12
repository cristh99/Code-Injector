#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-/tmp/forja-live-v1}"
rm -rf "$OUT"
mkdir -p "$OUT"
cat "$ROOT"/migration.sql.gz.b64.part-* | base64 --decode | gzip -dc > "$OUT/001_forja_v1.sql"
base64 --decode < "$ROOT/canary.sql.gz.b64" | gzip -dc > "$OUT/002_forja_v1_canary.sql"
base64 --decode < "$ROOT/rollback.sql.gz.b64" | gzip -dc > "$OUT/rollback_forja_v1.sql"
base64 --decode < "$ROOT/MANIFEST.json.gz.b64" | gzip -dc > "$OUT/MANIFEST.json"
base64 --decode < "$ROOT/SHA256SUMS.gz.b64" | gzip -dc > "$OUT/SHA256SUMS"
printf '%s  %s\n' \
  2bea73c72938db55b2fc077baa7e3d8fb7d02f8e751d248e95b312cabed14584 "$OUT/001_forja_v1.sql" \
  c03743c42654bf975aa91af2506145abda901dee5deea0f7970fc04920af7c3b "$OUT/002_forja_v1_canary.sql" \
  8d103087c34cabf29e06161c8ec5934bade47e8518e20632cafbc18ae099eeac "$OUT/rollback_forja_v1.sql" \
  db29fdd21f13e0302ee6c87241a3254df403df533a212ea7c2d05b7bc13220d6 "$OUT/MANIFEST.json" \
  bcef23283acd264bea6267990c8bc4bc718af2495cb2d4f3d7cad769cb8f88a3 "$OUT/SHA256SUMS" | sha256sum -c -
test "$(wc -c < "$OUT/001_forja_v1.sql")" -eq 69909
test "$(wc -c < "$OUT/002_forja_v1_canary.sql")" -eq 19862
test "$(wc -c < "$OUT/rollback_forja_v1.sql")" -eq 3354
test "$(wc -c < "$OUT/MANIFEST.json")" -eq 1788
test "$(wc -c < "$OUT/SHA256SUMS")" -eq 867
python3 - "$OUT" "$ROOT/FORJA-LIVE-CERTIFICATION.json" <<'PY'
import hashlib, json, pathlib, re, sys
out=pathlib.Path(sys.argv[1]); cert=json.loads(pathlib.Path(sys.argv[2]).read_text())
sql=(out/'001_forja_v1.sql').read_text()
assert len(re.findall(r'CREATE OR REPLACE FUNCTION agent_memory\.forja_',sql)) == 21
assert len(re.findall(r'CREATE TABLE IF NOT EXISTS agent_memory\.forja_',sql)) == 4
assert 'forja_sessions_v1_one_active_identity' in sql
assert 'UNSAFE_DYNAMIC_SQL_TRANSPORT' in sql
assert 'AUTOMATIC_VERIFICATION_LEAF_REQUIRES_YES' in sql
canary=(out/'002_forja_v1_canary.sql').read_text()
assert canary.rstrip().endswith('ROLLBACK;')
assert cert['live_neon']['gates_passed']==20
assert cert['live_neon']['gates_failed']==0
assert cert['verification']['production_applied'] is False
assert cert['verification']['promotion_authorized'] is False
print(json.dumps({'status':'PASS','migration_functions':21,'migration_tables':4,'live_gates':20,'production_applied':False},sort_keys=True))
PY
