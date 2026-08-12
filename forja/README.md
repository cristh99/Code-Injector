# FORJA v1.0.0

FORJA is an additive control plane for EVIDENCIA_PUBLICA that prevents same-identity split-brain, enforces exact execution budgets, rejects unsafe MotherDuck dynamic-SQL transport, and seals artifacts from their actual bytes.

## Verified properties

- Local tests: **38/38 PASS**.
- Clean offline package installation: PASS.
- Exact F5 SQL: **24,622 bytes**, SHA-256 `ab5cec709644a700a55b7ae43e0ff7a562cb66808d56b2a82fc30037a1b24e14`, accepted by the direct-SQL policy.
- Neon canary on `br-weathered-lake-axmtvq28`: all gates PASS; competing session, invalid wrapper, second call, and false artifact hash were rejected.
- Legacy control-plane row counts unchanged; synthetic canary rows removed.
- External provider calls and spend: **0**.

## Reconstruct

```bash
bash release/reconstruct.sh
mkdir /tmp/forja-kit
tar -xzf release/FORJA-v1.0.0-release-kit.tar.gz -C /tmp/forja-kit
cd /tmp/forja-kit/FORJA-v1-release-kit
sha256sum -c SHA256SUMS
npm install --ignore-scripts --offline --prefix /tmp/forja-install packages/evidencia-publica-forja-1.0.0.tgz
```

Production Neon migration is intentionally **not applied**. The tested migration is included in the kit and requires a separate approval gate.
