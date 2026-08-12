import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPage, selectPublicArtifactLinks } from '../playwright-handoff/handoff.mjs';

test('classifyPage identifies a Cloudflare managed challenge', () => {
  assert.equal(classifyPage({
    title: 'Just a moment...',
    bodyText: 'Performing security verification. Enable JavaScript and cookies to continue. Ray ID: abc123',
    url: 'https://sielho.iaip.gob.hn/solicitud/85111/historial/',
  }), 'challenge');
});

test('classifyPage accepts the requested SIELHO source page after verification', () => {
  assert.equal(classifyPage({
    title: 'Historial solicitud - SIELHO | IAIP',
    bodyText: 'Historial de la solicitud SOL-SEDESOL-564-2026',
    url: 'https://sielho.iaip.gob.hn/solicitud/85111/historial/',
  }), 'source');
});

test('classifyPage rejects navigation away from the expected host', () => {
  assert.equal(classifyPage({
    title: 'Example',
    bodyText: 'not the target',
    url: 'https://example.com/',
  }), 'unexpected');
});

test('selectPublicArtifactLinks keeps and deduplicates relevant public locators', () => {
  const links = selectPublicArtifactLinks([
    'https://sielho.iaip.gob.hn/media/respuesta.pdf',
    'https://sielho.iaip.gob.hn/media/respuesta.pdf#page=1',
    'https://tenant-my.sharepoint.com/:f:/g/example',
    'https://1drv.ms/u/s!example',
    'javascript:alert(1)',
    'mailto:test@example.com',
    'https://sielho.iaip.gob.hn/solicitud/85111/historial/',
  ]);

  assert.deepEqual(links, [
    'https://sielho.iaip.gob.hn/media/respuesta.pdf',
    'https://tenant-my.sharepoint.com/:f:/g/example',
    'https://1drv.ms/u/s!example',
  ]);
});
