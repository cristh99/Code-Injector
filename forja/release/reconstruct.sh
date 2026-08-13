#!/usr/bin/env bash
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
out=${1:-"$here/FORJA-v1.0.0-release-kit.tar.gz"}

{
  for i in 00 01 02 03 04 05 06 07 08; do
    cat "$here/FORJA-v1.0.0-release-kit.tar.gz.b64.part-$i"
  done
  for i in 00 01 02 03 04 05 06 07; do
    cat "$here/part-09-split/part-09-$i.txt"
  done
  for i in 10 11 12; do
    cat "$here/FORJA-v1.0.0-release-kit.tar.gz.b64.part-$i"
  done
} | base64 -d > "$out"

expected=$(awk '{print $1}' "$here/FORJA-v1.0.0-release-kit.tar.gz.sha256")
observed=$(sha256sum "$out" | awk '{print $1}')
[[ "$observed" == "$expected" ]] || {
  echo "SHA256 mismatch: expected=$expected observed=$observed" >&2
  exit 1
}

echo "$observed  $out"
