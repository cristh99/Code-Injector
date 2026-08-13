import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const builder = new URL('../scripts/build-release.sh', import.meta.url).pathname;

test('release builder ignores ambient untracked and backup files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arca-release-builder-'));
  const pkg = join(dir, 'package.tgz');
  const canary = join(dir, 'canary.tar.gz');
  const a = join(dir, 'a.tar.gz');
  const b = join(dir, 'b.tar.gz');
  await writeFile(pkg, Buffer.from('package-fixture'));
  await writeFile(canary, Buffer.from('canary-fixture'));
  let p = spawnSync('bash', [builder, a, pkg, canary], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stdout + p.stderr);
  const scratch = join(root, '.ARCA-UNTRACKED-SCRATCH');
  const backup = join(root, 'test', 'ambient.bak');
  await writeFile(scratch, 'must not enter release');
  await writeFile(backup, 'must not enter release');
  try {
    p = spawnSync('bash', [builder, b, pkg, canary], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
    assert.equal(await digest(b), await digest(a));
  } finally {
    await rm(scratch, { force: true });
    await rm(backup, { force: true });
  }
});
