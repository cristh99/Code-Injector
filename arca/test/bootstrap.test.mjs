import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { encodeArtifact } from '../src/transport.mjs';

const bootstrap = new URL('../bootstrap/recover.mjs', import.meta.url).pathname;

test('standalone bootstrap recovers exact bytes without importing the package', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arca-bootstrap-'));
  const shardsDir = join(dir, 'shards');
  await mkdir(shardsDir);
  const bytes = Buffer.from('ARCA bootstrap independent recovery '.repeat(2048));
  const encoded = encodeArtifact(bytes, {
    artifactId: 'bootstrap-canary', artifactRef: 'memory:bootstrap', mediaType: 'application/octet-stream',
    dataShards: 6, parityShards: 3,
  });
  const manifestFile = join(dir, 'manifest.json');
  await writeFile(manifestFile, `${JSON.stringify(encoded.manifest)}\n`);
  for (const shard of encoded.shards) await writeFile(join(shardsDir, `shard-${String(shard.index).padStart(3, '0')}.bin`), shard.bytes);
  const out = join(dir, 'recovered.bin');
  const result = spawnSync(process.execPath, [bootstrap, manifestFile, shardsDir, out, '--missing=0', '--corrupt=7'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await readFile(out), bytes);
});
