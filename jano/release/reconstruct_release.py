from pathlib import Path
import base64, hashlib
ROOT = Path(__file__).resolve().parent
parts = sorted((ROOT / "chunks").glob("part-*.b64"))
if not parts:
    raise SystemExit("NO_RELEASE_CHUNKS")
encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
data = base64.b64decode(encoded, validate=True)
expected = "2f5442434e5913b03b40bac85a1e76d6ff0da44b8770e1a4381e7faad00e6cc7"
observed = hashlib.sha256(data).hexdigest()
if observed != expected:
    raise SystemExit(f"JANO_RELEASE_SHA_MISMATCH:{observed}")
out = ROOT / "jano-v1.0.0-experimental.tar.gz"
out.write_bytes(data)
print(f"{out} {len(data)} bytes sha256={observed}")
