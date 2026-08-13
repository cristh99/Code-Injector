# PODA v1.0.0

PODA reconciles historical `PENDING` message deliveries without deleting or changing message bytes. It is fail-closed, namespace-bound, batch-bounded, dry-run by default, and writes append-only hash-bound receipts.

## Safety boundary

- `EXPIRE_TTL`: only when message TTL is at or before a current evaluation cut.
- `CANCEL_TERMINAL_STALE`: only non-actionable terminal-evidence messages, exactly one terminal work item, zero active matching work, and a STALE/DEAD recipient.
- `COMMAND`, `REQUEST`, `QUERY`, fresh recipients, unknown liveness, active work, and no-work matches remain pending unless TTL has expired.
- `cut_at` must be within five minutes of database time; it is not a time-travel query.
- No message deletion, payload mutation, or ACK impersonation.
- Production migration is not authorized.

Current canary status: `INCONCLUSIVE_CONCURRENCY_ENVIRONMENT_BLOCKED`; all non-concurrency controls passed, and no concurrency simulation was substituted.