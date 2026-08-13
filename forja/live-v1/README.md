# FORJA v1 — exact database payload custody

This directory contains the exact FORJA database payload reconstructed from integrity-verified Neon cooperation messages and executed on an isolated Neon branch.

It is distinct from the earlier SDK baseline under `forja/release/`. That baseline remains independently reproducible and green, but it contains an earlier database revision. The files here are the authoritative 69,909-byte database candidate.

## Exact artifacts

- Migration: 69,909 bytes; SHA-256 `2bea73c72938db55b2fc077baa7e3d8fb7d02f8e751d248e95b312cabed14584`.
- Canary: 19,862 bytes; SHA-256 `c03743c42654bf975aa91af2506145abda901dee5deea0f7970fc04920af7c3b`.
- Rollback: 3,354 bytes; SHA-256 `8d103087c34cabf29e06161c8ec5934bade47e8518e20632cafbc18ae099eeac`.
- Manifest: SHA-256 `db29fdd21f13e0302ee6c87241a3254df403df533a212ea7c2d05b7bc13220d6`.
- Checksums: SHA-256 `bcef23283acd264bea6267990c8bc4bc718af2495cb2d4f3d7cad769cb8f88a3`.

## Verified lifecycle

On isolated branch `br-late-darkness-axovrbmc`, the exact payload produced:

- 7 tables, 22 functions, 4 views, 6 triggers, and 24 indexes;
- zero operational rows immediately after installation;
- original canary verdict `PASS`, including split-brain rejection, scope fencing, idempotency conflicts, attempt budgeting, invalid MotherDuck wrapper rejection, response-contract mismatch rejection, executed-input mismatch rejection, append-only artifact sealing, stale managed-claim recovery, and successor fencing;
- transactional canary rollback readback `rollback_clean=true`;
- explicit uninstall readback: 0 relations, 0 functions, 0 types, and 0 triggers;
- clean reinstall with the full 7/22/4/6/24 surface and zero operational rows;
- final cleanup to zero FORJA objects.

All three temporary FORJA branches were deleted. Production branch `br-flat-block-ax5eh8og` remains unchanged with zero FORJA objects, cooperation version 2.2.0, and canonical migration integrity passing.

## Reconstruct

```bash
bash forja/live-v1/reconstruct.sh
```

The script recreates all five exact artifacts under `/tmp/forja-live-v1`, verifies byte counts and SHA-256 values, inspects the 7-table/22-function safety surface, verifies rollback followed by zero-residue readback, and rejects any certification that authorizes production.

## Boundary

This is verified custody and isolated-branch lifecycle evidence. It is not production authorization, not a merge decision, and not proof that legacy calls bypassing FORJA are fenced.
