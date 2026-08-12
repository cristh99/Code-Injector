# FORJA v1 — exact live database custody

This directory restores the exact FORJA database payload that was tested on the isolated Neon branch `br-late-block-axayxmxq`.

It is distinct from the earlier SDK release kit under `forja/release/`: that baseline remains reproducible and green, but contains an older migration. The files here are the newer integrity-verified payload recovered from Neon messages and must be treated as the authoritative live-canary database candidate.

## Verified boundary

- Migration: 69,909 bytes, SHA-256 `2bea73c72938db55b2fc077baa7e3d8fb7d02f8e751d248e95b312cabed14584`.
- Surface: 4 tables, 21 functions, 94 constraints, 12 indexes.
- Two rollback-only canary executions: 20/20 gates PASS.
- Explicit uninstall: 0 FORJA objects remaining; cooperation 2.2.0 integrity unchanged.
- Clean reinstall: 4 tables, 21 functions, 0 data rows.
- Production main: not migrated; promotion not authorized; spend USD 0.

## Reconstruct

```bash
bash forja/live-v1/reconstruct.sh
```

The script reconstructs all five exact artifacts under `/tmp/forja-live-v1`, verifies byte counts and SHA-256 values, confirms the migration surface, and checks that the certification explicitly forbids production promotion.
