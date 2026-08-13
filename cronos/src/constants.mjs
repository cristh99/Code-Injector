export const DEFAULT_INVARIANTS = Object.freeze([
  Object.freeze({ path: 'work.state_version', policy: 'EXACT', invalidates_pass: true }),
  Object.freeze({ path: 'work.status', policy: 'EXACT', invalidates_pass: true }),
  Object.freeze({ path: 'assignment.status', policy: 'EXACT', invalidates_pass: true }),
  Object.freeze({ path: 'verification.status', policy: 'ONE_OF', allowed: ['PENDING', 'RUNNING'], invalidates_pass: true })
]);

export const TERMINAL_STATUSES = new Set(['PASSED', 'FAILED', 'INCONCLUSIVE', 'CANCELLED']);

export const ALLOWED_PATHS = new Set([
  'work.state_version',
  'work.status',
  'assignment.status',
  'assignment.updated_at',
  'verification.status',
  'verification.updated_at'
]);

export const POLICIES = new Set(['EXACT', 'ONE_OF', 'NONDECREASING']);
