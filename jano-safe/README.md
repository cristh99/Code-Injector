# JANO v1.0.1-experimental — safe release intake

Stacked, non-production extension of JANO v1.0.0. It verifies and safely extracts exact release archives before any code is trusted or executed.

## Exact identity

- Release: `jano-v1.0.1-experimental.tar.gz`
- Bytes: `34,589`
- SHA-256: `8874c0115da9bb14351022503560e968895597aeff4e4f2155e6d4f230522e3e`
- External manifest SHA-256: `b33c81fbdc9e68e95dca72e5064c506b6e6188bed9ca5aabbd0224d6b7bd427c`
- Tests: `50/50 PASS`; compileall PASS
- Audit canary unchanged: `MATAR=4`, `CAMBIAR=4`, `MOVER=1`, `FUSIONAR=0`, `CREAR=0`, `SIN_CAMBIO=2`; mutations `0`

## Reconstruct

```bash
cd release
python reconstruct_release.py
```

Then verify with the JANO CLI inside the reconstructed release. No production mutation or merge is authorized.
