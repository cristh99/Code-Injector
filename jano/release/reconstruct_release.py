from pathlib import Path
import base64, hashlib, sys
ROOT=Path(__file__).resolve().parent
parts=sorted((ROOT/"chunks").glob("part-*.b64"))
if not parts:
    raise SystemExit("NO_RELEASE_CHUNKS")
encoded="".join(p.read_text(encoding="ascii").strip() for p in parts)
data=base64.b64decode(encoded, validate=True)
expected="334c369373b067ac1d810a718b0e1c584e69796b27a0b0ec6478bb50f82e4c4f"
observed=hashlib.sha256(data).hexdigest()
if observed != expected:
    raise SystemExit(f"JANO_RELEASE_SHA_MISMATCH:{observed}")
out=ROOT/"jano-v1.0.0-experimental.tar.gz"
out.write_bytes(data)
print(f"{out} {len(data)} bytes sha256={observed}")
