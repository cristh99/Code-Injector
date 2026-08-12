import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, safeArtifactPath } from '../playwright-controller/controller.mjs';

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
