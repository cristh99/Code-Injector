#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
out=${1:-"$here/LLAVE-v1.0.0-release-kit.reconstructed.tar.gz"}
source="$here/LLAVE-v1.0.0-release-kit.tar.gz"
if [[ ! -f "$source" ]]; then
  echo "Missing exact release kit: $source" >&2
  exit 1
fi
cp "$source" "$out"
expected=$(awk '{print $1}' "$here/LLAVE-v1.0.0-release-kit.tar.gz.sha256")
observed=$(sha256sum "$out" | awk '{print $1}')
[[ "$observed" == "$expected" ]] || {
  echo "SHA256 mismatch: expected=$expected observed=$observed" >&2
  exit 1
}
echo "$observed  $out"
