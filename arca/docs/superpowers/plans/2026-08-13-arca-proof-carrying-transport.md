# ARCA v1 implementation plan

1. Specify canonical JSON, GF(256), matrix and transport properties as tests.
2. Implement dependency-free Node 22 encoder, verifier, recovery engine and CLI.
3. Add additive Neon manifest/shard/certificate surfaces with bounded storage.
4. Prove real recovery against a previously transported release artifact.
5. Package deterministically, encode the package with ARCA itself, damage shards, recover byte-identically and run clean-room CI.
6. Publish only as a draft; production migration and merge require separate authorization and independent QA.
