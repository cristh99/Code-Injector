#!/usr/bin/env node
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const BLOCK = 512;
const EXECUTABLE_SUFFIXES = new Set([
  '/bootstrap/recover.mjs',
  '/scripts/build-release.sh',
  '/scripts/deterministic-archive.mjs',
  '/src/cli.mjs',
  '/VERIFY-RELEASE.mjs',
]);

function fail(code) {
  throw new Error(code);
}

function writeField(header, offset, length, value) {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > length) fail('ARCA_TAR_FIELD_TOO_LONG');
  bytes.copy(header, offset);
}

function writeOctal(header, offset, length, value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('ARCA_TAR_NUMBER_INVALID');
  const octal = value.toString(8);
  if (octal.length > length - 1) fail('ARCA_TAR_NUMBER_OVERFLOW');
  writeField(header, offset, length, `${octal.padStart(length - 1, '0')}\0`);
}

function splitPath(path) {
  const bytes = Buffer.byteLength(path, 'utf8');
  if (bytes <= 100) return { name: path, prefix: '' };
  const points = [];
  for (let i = 0; i < path.length; i += 1) if (path[i] === '/') points.push(i);
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    const prefix = path.slice(0, point);
    const name = path.slice(point + 1);
    if (Buffer.byteLength(prefix, 'utf8') <= 155 && Buffer.byteLength(name, 'utf8') <= 100 && name) {
      return { name, prefix };
    }
  }
  fail('ARCA_TAR_PATH_TOO_LONG');
}

function headerFor(path, { directory, size, mode }) {
  const header = Buffer.alloc(BLOCK, 0);
  const { name, prefix } = splitPath(path);
  writeField(header, 0, 100, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, directory ? 0 : size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeField(header, 156, 1, directory ? '5' : '0');
  writeField(header, 257, 6, 'ustar\0');
  writeField(header, 263, 2, '00');
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);
  writeField(header, 345, 155, prefix);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const check = checksum.toString(8).padStart(6, '0');
  writeField(header, 148, 8, `${check}\0 `);
  return header;
}

async function walk(root) {
  const entries = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail('ARCA_RELEASE_SYMLINK_FORBIDDEN');
    if (stat.isDirectory()) {
      entries.push({ path, directory: true, bytes: null });
      const names = (await readdir(path)).sort((a, b) => a.localeCompare(b, 'en'));
      for (const name of names) await visit(join(path, name));
      return;
    }
    if (!stat.isFile()) fail('ARCA_RELEASE_SPECIAL_FILE_FORBIDDEN');
    entries.push({ path, directory: false, bytes: await readFile(path) });
  }
  await visit(root);
  return entries;
}

function normalizedMode(path, directory) {
  if (directory) return 0o755;
  const normalized = path.replaceAll(sep, '/');
  return [...EXECUTABLE_SUFFIXES].some((suffix) => normalized.endsWith(suffix)) ? 0o755 : 0o644;
}

async function main() {
  const [rootArg, outputArg] = process.argv.slice(2);
  if (!rootArg || !outputArg) fail('USAGE: deterministic-archive.mjs <root-dir> <output.tar.gz>');
  const root = rootArg;
  const parent = dirname(root);
  const rootName = basename(root);
  if (!rootName || rootName === '.' || rootName === '..') fail('ARCA_RELEASE_ROOT_INVALID');
  const entries = await walk(root);
  const chunks = [];
  for (const entry of entries) {
    let tarPath = relative(parent, entry.path).split(sep).join('/');
    if (entry.directory && !tarPath.endsWith('/')) tarPath += '/';
    const bytes = entry.bytes ?? Buffer.alloc(0);
    chunks.push(headerFor(tarPath, {
      directory: entry.directory,
      size: bytes.length,
      mode: normalizedMode(tarPath, entry.directory),
    }));
    if (!entry.directory) {
      chunks.push(bytes);
      const padding = (BLOCK - (bytes.length % BLOCK)) % BLOCK;
      if (padding) chunks.push(Buffer.alloc(padding, 0));
    }
  }
  chunks.push(Buffer.alloc(BLOCK * 2, 0));
  const tar = Buffer.concat(chunks);
  const gzip = gzipSync(tar, { level: 9, mtime: 0, portable: true });
  await writeFile(outputArg, gzip);
  const sha256 = createHash('sha256').update(gzip).digest('hex');
  process.stdout.write(`${JSON.stringify({ format: 'arca-deterministic-archive-v1', bytes: gzip.length, sha256, entries: entries.length })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
});
