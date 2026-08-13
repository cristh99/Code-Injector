# CRONOS v1

**CRONOS** binds automatic QA to the exact state that exists immediately after `submit_work_result_v2`, then requires the snapshot SHA-256 as a compare-and-set token at finalization.

## Problem

A valid result can wait in the verification queue while its work item, assignment, source read-set, contract or artifact registry changes. The legacy verifier checks the hash it receives, but it does not bind the verdict to the surrounding state originally submitted.

The frozen diagnostic in `docs/DRIFT-AUDIT.json` found 60 submissions, 7 requests with state changes before verdict, 9 cancellations before verdict, p90 latency above 11 hours and a maximum above 15 hours.

## Safety model

1. The legacy submission runs first and creates the result message and verification request.
2. CRONOS then reads the resulting `VERIFYING` state and compiles expected values itself; producer-supplied `expected` values are rejected before submission.
3. The exact numeric `work_state_version` is not hard-coded. Under the canonical dispatcher path the canary observed `3` (`READY → WORKING → VERIFYING`); the invariant is that the compiled expectation equals the actual post-submit cut.
4. The snapshot binds the message payload, target hash, artifact set, read-set, acceptance contract, check contract and selected live invariants.
5. Finalization requires the exact snapshot SHA-256.
6. Immutable mismatch becomes `FAIL`; invalidating drift becomes `INCONCLUSIVE`; allowlisted drift can remain `PASS_AT_CUT_LIVE_DRIFT_NONINVALIDATING`.
7. Producer and verifier identities must differ. Finalization receipts are idempotent and append-only.

## Verified canary

The disposable Neon canary passed 11/11 controls. Its portable mirror is `CRONOS-V1-NEON-CANARY-RECEIPT.json`; the authoritative Neon receipt SHA-256 is `3d7ab6d6f03319aa62276200274d519f1eb32dc881448aaab9504ddbee9216ad`. Production remained at zero CRONOS objects and zero synthetic rows.

## Status

The PostgreSQL canary passed 11/11 and the dependency-free Node reference/package suite passes 17/17, including deterministic release reconstruction and ambient-file exclusion. This is a tested draft. The migration is additive and must not be applied to production without distinct automatic QA and explicit migration authorization.
