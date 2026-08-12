import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, safeArtifactPath, browserHeadlessMode } from '../playwright-controller/controller.mjs';

test('validateRequest accepts a deterministic browser task', () => {
  const request = validateRequest({
    run_id: 'canary-001',
    url: 'https://example.com/',
    actions: [
      { type: 'fill', locator: { label: 'Name' }, value: 'Ada' },
      { type: 'press', locator: { label: 'Name' }, key: 'Enter' },
      { type: 'screenshot', path: 'page.png' },
    ],
    extract: [{ name: 'title', type: 'title' }],
  });

  assert.equal(request.run_id, 'canary-001');
  assert.equal(request.actions.length, 3);
});

test('validateRequest rejects non-http navigation', () => {
  assert.throws(
    () => validateRequest({ run_id: 'bad', url: 'file:///etc/passwd', actions: [] }),
    /http or https/i,
  );
});

test('validateRequest rejects unsupported actions', () => {
  assert.throws(
    () => validateRequest({
      run_id: 'bad-action',
      url: 'https://example.com/',
      actions: [{ type: 'evaluate', script: 'process.exit()' }],
    }),
    /unsupported action/i,
  );
});

test('safeArtifactPath prevents traversal outside artifacts', () => {
  assert.throws(() => safeArtifactPath('../secret.txt'), /unsafe artifact path/i);
  assert.match(safeArtifactPath('screens/page.png'), /artifacts\/screens\/page\.png$/);
});

test('browserHeadlessMode permits an explicit headed runtime only', () => {
  assert.equal(browserHeadlessMode({}), true);
  assert.equal(browserHeadlessMode({ PW_HEADLESS: 'true' }), true);
  assert.equal(browserHeadlessMode({ PW_HEADLESS: 'false' }), false);
  assert.equal(browserHeadlessMode({ PW_HEADLESS: 'FALSE' }), true);
});

test('validateRequest accepts a bounded pinned IAIP download', () => {
  const request = validateRequest({
    run_id: 'iaip-download-001',
    url: 'https://example.com/',
    actions: [{
      type: 'download',
      url: 'https://portalunico.iaip.gob.hn/ver_archivo/MjU0ODM0NQ==',
      path: 'downloads/report.pdf',
      pinned_ip: '190.107.149.100',
      expected_format: 'PDF',
      max_bytes: 10485760,
    }],
  });

  assert.equal(request.actions[0].type, 'download');
  assert.equal(request.actions[0].pinned_ip, '190.107.149.100');
});

test('validateRequest rejects pinned downloads outside IAIP official hosts', () => {
  assert.throws(
    () => validateRequest({
      run_id: 'bad-pinned-download',
      url: 'https://example.com/',
      actions: [{
        type: 'download',
        url: 'https://example.com/private.pdf',
        path: 'downloads/private.pdf',
        pinned_ip: '203.0.113.10',
        expected_format: 'PDF',
      }],
    }),
    /pinned downloads.*IAIP/i,
  );
});

test('pinnedLookup returns an address array when Node requests all addresses', async () => {
  const module = await import('../playwright-controller/controller.mjs');
  assert.equal(typeof module.pinnedLookup, 'function');

  const lookup = module.pinnedLookup('190.107.149.100');
  await new Promise((resolve, reject) => {
    lookup('portalunico.iaip.gob.hn', { all: true }, (error, addresses) => {
      if (error) return reject(error);
      assert.deepEqual(addresses, [{ address: '190.107.149.100', family: 4 }]);
      return resolve();
    });
  });
});
