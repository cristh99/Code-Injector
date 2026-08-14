from pathlib import Path
import base64, hashlib
ROOT = Path(__file__).resolve().parent
parts = sorted((ROOT / "chunks").glob("part-*.b64"))
if not parts:
    raise SystemExit("NO_RELEASE_CHUNKS")
encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
data = base64.b64decode(encoded, validate=True)
expected_bytes = 34589
expected_sha256 = "8874c0115da9bb14351022503560e968895597aeff4e4f2155e6d4f230522e3e"
observed_sha256 = hashlib.sha256(data).hexdigest()
if len(data) != expected_bytes:
    raise SystemExit(f"JANO_RELEASE_SIZE_MISMATCH:{len(data)}")
if observed_sha256 != expected_sha256:
    raise SystemExit(f"JANO_RELEASE_SHA_MISMATCH:{observed_sha256}")
out = ROOT / "jano-v1.0.1-experimental.tar.gz"
out.write_bytes(data)
print(f"{out} {len(data)} bytes sha256={observed_sha256}")
