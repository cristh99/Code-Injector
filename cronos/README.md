# CRONOS v1

**CRONOS** binds automatic QA to the exact state that existed immediately after `submit_work_result_v2`, then uses a snapshot hash as a compare-and-set token at finalization.

## Problem

A valid result can wait in the verification queue while its work item, assignment, source read-set, contract or artifact registry changes. The legacy verifier checks the hash it receives, but it does not prove that the surrounding state is still the state originally submitted.

The frozen diagnostic in `docs/DRIFT-AUDIT.json` found 60 submissions, 7 requests with state changes before verdict, 9 cancellations before verdict, p90 latency above 11 hours and a maximum above 15 hours.

## Safety model

1. Legacy submission runs first and creates the result message and verification request.
2. CRONOS reads the resulting `VERIFYING` state and compiles its own expected values; the producer cannot supply them.
3. The snapshot binds the message payload, target hash, artifact set, read-set, acceptance contract, check contract and selected live invariants.
4. Finalization requires the exact snapshot SHA-256.
5. Immutable mismatch becomes `FAIL`; invalidating drift becomes `INCONCLUSIVE`; allowlisted drift can remain `PASS_AT_CUT`.
6. Producer and verifier identities must differ. Finalization receipts are append-only.

## Status

This branch is a tested draft. The migration is additive and must not be applied to production without distinct automatic QA and explicit migration authorization.
