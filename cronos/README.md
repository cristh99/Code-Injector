# CRONOS v1

CRONOS binds automatic QA to the exact state that exists immediately after result submission, then requires the snapshot SHA-256 as a compare-and-set token at finalization.

## Problem

A valid result can wait in the verification queue while its work item, assignment, source read-set, contract or artifact registry changes. A verdict must therefore be bound to the state originally submitted, not merely to a later target hash.

## Safety model

1. The legacy submission creates the result message and verification request.
2. CRONOS reads the resulting VERIFYING state and compiles expected values itself. Producer-supplied expected values are rejected.
3. The exact numeric work state version is not hard-coded. Under the canonical dispatcher path the canary observed version 3 after READY to WORKING to VERIFYING; the invariant is that the compiled expectation equals the actual post-submit cut.
4. The snapshot binds the message payload, target hash, artifact set, read-set, acceptance contract, check contract and selected live invariants.
5. Finalization requires the exact snapshot SHA-256.
6. Immutable mismatch becomes FAIL; invalidating drift becomes INCONCLUSIVE; allowlisted drift can remain PASS_AT_CUT_LIVE_DRIFT_NONINVALIDATING.
7. Producer and verifier identities must differ. Finalization receipts are idempotent and append-only.

## Verified canary

The disposable Neon canary passed 11 of 11 controls. The authoritative Neon receipt SHA-256 is 3d7ab6d6f03319aa62276200274d519f1eb32dc881448aaab9504ddbee9216ad. Production remained at zero CRONOS objects and zero synthetic rows.

## Status

The PostgreSQL canary passed 11 of 11 and the dependency-free Node reference suite passed 17 of 17 locally before publication. This branch is a tested draft. The migration is additive and must not be applied to production without distinct automatic QA and explicit migration authorization.
