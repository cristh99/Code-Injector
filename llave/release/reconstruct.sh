#!/usr/bin/env bash
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
out=${1:-"$here/LLAVE-v1.0.0-release-kit.reconstructed.tar.gz"}

parts=(
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-00"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.segment-01-02"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-03"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-04"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.segment-05-06"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.segment-07-08"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-09"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-10"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-11"
  "$here/LLAVE-v1.0.0-release-kit.tar.gz.b64.part-12"
)

for part in "${parts[@]}"; do
  [[ -f "$part" ]] || {
    echo "Missing release segment: $part" >&2
    exit 1
  }
done

cat "${parts[@]}" | base64 --decode > "$out"
expected=$(awk '{print $1}' "$here/LLAVE-v1.0.0-release-kit.tar.gz.sha256")
observed=$(sha256sum "$out" | awk '{print $1}')
[[ "$observed" == "$expected" ]] || {
  echo "SHA256 mismatch: expected=$expected observed=$observed" >&2
  exit 1
}
echo "$observed  $out"
