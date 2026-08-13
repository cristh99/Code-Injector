#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: build-release.sh <output.tar.gz> <package.tgz> <real-canary.tar.gz>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage
out=$(realpath -m "$1")
package=$(realpath "$2")
canary=$(realpath "$3")
source_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
kit="$work/ARCA-v1-release-kit"
mkdir -p "$kit/source" "$kit/packages" "$kit/canaries" "$kit/verification"

mkdir -p "$kit/source/arca"
for file in package.json README.md LICENSE ARCA-V1-SCHEMA-MANIFEST.json ARCA-V1-CANARY-RECEIPT.json; do
  cp "$source_root/$file" "$kit/source/arca/$file"
done
for dir in bootstrap docs examples scripts sql src; do
  cp -a "$source_root/$dir" "$kit/source/arca/$dir"
done
mkdir -p "$kit/source/arca/test"
for test_file in "$source_root"/test/*.test.mjs; do
  cp "$test_file" "$kit/source/arca/test/"
done
cp "$package" "$kit/packages/evidencia-publica-arca-1.0.0.tgz"
cp "$canary" "$kit/canaries/FORJA-v1.0.0-release-kit.tar.gz"

(
  cd "$kit"
  find source packages canaries -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)

node --input-type=module - "$kit" <<'NODE'
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const kit=process.argv[2];
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const walk=async dir=>{let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);out.push(...(e.isDirectory()?await walk(p):[p]));}return out;};
const files=(await walk(join(kit,'source','arca'))).sort();
const manifest={
  format:'arca-release-manifest-v1',artifact:'ARCA',version:'1.0.0',production_applied:false,
  external_spend_usd:0,basic_memory:'PROHIBITED',source_file_count:files.length,
  package:{filename:'evidencia-publica-arca-1.0.0.tgz',sha256:await sha(join(kit,'packages','evidencia-publica-arca-1.0.0.tgz'))},
  real_canary:{filename:'FORJA-v1.0.0-release-kit.tar.gz',sha256:await sha(join(kit,'canaries','FORJA-v1.0.0-release-kit.tar.gz'))}
};
await writeFile(join(kit,'RELEASE-MANIFEST.json'),JSON.stringify(manifest)+'\n');
NODE

cat > "$kit/VERIFY-RELEASE.mjs" <<'NODE'
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const lines=(await readFile(join(root,'SHA256SUMS'),'utf8')).trim().split('\n');
for(const line of lines){const m=line.match(/^([0-9a-f]{64})  (.+)$/);if(!m)throw new Error('ARCA_RELEASE_SUM_LINE_INVALID');const observed=createHash('sha256').update(await readFile(join(root,m[2]))).digest('hex');if(observed!==m[1])throw new Error(`ARCA_RELEASE_HASH_MISMATCH:${m[2]}`);}
const manifest=JSON.parse(await readFile(join(root,'RELEASE-MANIFEST.json'),'utf8'));
if(manifest.format!=='arca-release-manifest-v1'||manifest.artifact!=='ARCA'||manifest.version!=='1.0.0'||manifest.production_applied!==false||manifest.external_spend_usd!==0)throw new Error('ARCA_RELEASE_MANIFEST_INVALID');
console.log(JSON.stringify({valid:true,artifact:'ARCA',version:'1.0.0',inventory_entries:lines.length,package_sha256:manifest.package.sha256,canary_sha256:manifest.real_canary.sha256,production_applied:false,external_spend_usd:0}));
NODE

# Normalize modes so release bytes do not depend on checkout umask or filesystem metadata.
find "$kit" -type d -exec chmod 0755 {} +
find "$kit" -type f -exec chmod 0644 {} +
chmod 0755 \
  "$kit/source/arca/bootstrap/recover.mjs" \
  "$kit/source/arca/scripts/build-release.sh" \
  "$kit/source/arca/src/cli.mjs" \
  "$kit/VERIFY-RELEASE.mjs"

(
  cd "$work"
  tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -cf - ARCA-v1-release-kit \
    | gzip -n -9 > "$out"
)
sha256sum "$out"
