# ARCA

**Artefactos Resilientes con Custodia Autoverificable** transports exact bytes through lossy channels using systematic Reed–Solomon shards, SHA-256 per shard, a self-hashed canonical manifest, a Merkle root, NACK bitmap, transport epochs and optional FORJA session fences.

ARCA is dependency-free and does not grant access to storage providers. It only encodes, verifies and reconstructs bytes; production installation requires separate authorization and independent QA.
