#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
out=${1:-"$here/ARCA-v1.0.0-release-kit.reconstructed.tar.gz"}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
segments=("$here"/shard-segments/ARCA-V1-SHARDS.b64.segment-*)
[[ "${#segments[@]}" -eq 5 ]] || { echo "ARCA segment count mismatch: ${#segments[@]}" >&2; exit 1; }
index=0
while IFS= read -r line; do [[ -n "$line" ]] || continue; printf '%s' "$line"|base64 --decode>"$tmp/shard-$(printf '%03d' "$index").bin"; index=$((index+1)); done < <(cat "${segments[@]}")
[[ "$index" -eq 15 ]] || { echo "ARCA shard count mismatch: $index" >&2; exit 1; }
args=(); [[ -n "${ARCA_MISSING:-}" ]]&&args+=("--missing=${ARCA_MISSING}"); [[ -n "${ARCA_CORRUPT:-}" ]]&&args+=("--corrupt=${ARCA_CORRUPT}")
node "$here/../bootstrap/recover.mjs" "$here/ARCA-V1-SHARD-MANIFEST.json" "$tmp" "$out" "${args[@]}"
expected=$(awk '{print $1}' "$here/ARCA-v1.0.0-release-kit.tar.gz.sha256"); observed=$(sha256sum "$out"|awk '{print $1}'); [[ "$observed" == "$expected" ]] || exit 1; echo "$observed  $out"
