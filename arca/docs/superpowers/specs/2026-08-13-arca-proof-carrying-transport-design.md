# ARCA v1 design

ARCA treats connector transport as an erasure-and-corruption channel. It binds exact bytes to a canonical manifest, per-shard SHA-256, a Merkle root, transport epoch and optional FORJA session fence. Systematic Reed–Solomon coding permits byte-identical recovery from any `k` valid shards among `k+m`. A NACK bitmap requests only absent or corrupt shards. Acceptance requires recovered endpoint size and SHA-256, never merely enough shard count.
