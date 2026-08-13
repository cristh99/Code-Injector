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

test('release builder normalizes source file modes across environments', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arca-release-modes-'));
  const pkg = join(dir, 'package.tgz');
  const canary = join(dir, 'canary.tar.gz');
  const a = join(dir, 'a.tar.gz');
  const b = join(dir, 'b.tar.gz');
  await writeFile(pkg, Buffer.from('package-fixture'));
  await writeFile(canary, Buffer.from('canary-fixture'));
  const readme = join(root, 'README.md');
  const script = join(root, 'scripts', 'build-release.sh');
  const { chmod, stat } = await import('node:fs/promises');
  const readmeMode = (await stat(readme)).mode;
  const scriptMode = (await stat(script)).mode;
  let p = spawnSync('bash', [builder, a, pkg, canary], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stdout + p.stderr);
  try {
    await chmod(readme, 0o600);
    await chmod(script, 0o700);
    p = spawnSync('bash', [builder, b, pkg, canary], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
    assert.equal(await digest(b), await digest(a));
  } finally {
    await chmod(readme, readmeMode & 0o777);
    await chmod(script, scriptMode & 0o777);
  }
});
