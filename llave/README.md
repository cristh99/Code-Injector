# LLAVE v1

**LLAVE — Leases Limitados de Autorización Verificable para Ejecución** separates operational ability from authorization. An agent can hold `motherduck:write` and still be rejected unless an active refined grant covers the exact resource, operation, mode, limits and invariants required by the work.

## Properties

- exact or terminal-prefix resource contracts;
- operation and mode allowlists;
- canonical, cross-runtime contract identity with JSON-safe integer ceilings;
- numeric ceilings and exact invariants;
- legacy write grants fail closed without a refined requirement;
- effective-readiness certificates expose missing supply and refinement mismatches;
- delegated leases are narrowed to the work requirement and bound to a FORJA session fence;
- dependency-free Node 22 package and additive PostgreSQL migration.

## CLI

```bash
printf '%s' "$CONTRACT_JSON" | llave contract-hash
printf '%s' "$GRANT_AND_REQUIREMENT_JSON" | llave authorize-check
printf '%s' "$READINESS_INPUT_JSON" | llave effective-ready
```

Exit code `0` means PASS; exit code `2` means a valid fail-closed authorization or readiness denial; exit code `1` means malformed input or an internal error.

## Boundary

LLAVE does not create external tool access. It authorizes already-proven operational capability. Production migration and scheduler replacement require separate approval and independent QA.

## Verification artifacts

- `LLAVE-V1-SCHEMA-MANIFEST.json` defines the additive database surface and the Node/PostgreSQL contract-hash test vector.
- `LLAVE-V1-CANARY-RECEIPT.json` records the self-cleaning temporary-Neon proof; production remains unchanged.
