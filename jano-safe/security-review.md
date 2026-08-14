# JANO v1.0.1 — local security review

**Classification:** producer local security diff review; not distinct QA and not production authorization.

## Result
- 50/50 tests PASS; compileall PASS.
- Open confirmed reportable findings: 0 after remediation.
- Release SHA-256: `8874c0115da9bb14351022503560e968895597aeff4e4f2155e6d4f230522e3e`.
- Source `release.py` SHA-256: `e7ff594b6a9af5a28075b86c3cc83274ae8c7329b24db595137174cfb0821a84`.

## Fixed during review
- release receipt schema did not match emitted archive_name/mutations_performed fields.
- archive and manifest symlink inputs were followed.
- noncanonical gzip/tar encodings could pass with a matching untrusted manifest.
- parent-directory symlink swap could escape the extraction root.
- mode correction used a path after closing the descriptor.
- cleanup could delete a pre-existing extraction root.

## Boundaries
- POSIX dir_fd/O_NOFOLLOW platform required.
- no authenticity/signature claim.
- no semantic correctness or production authorization claim.
- SonarQube MCP/CLI unavailable in this runtime.
- hosted GitHub Actions blocked by account billing lock.
- distinct automatic QA pending.
