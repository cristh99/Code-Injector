import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidate, canonicalizeCandidateUrl } from './fas-candidate-filter-v1.mjs';

const tsc = {
  raw_url: 'https://www.tsc.gob.hn/wp-content/uploads/001-2025-DDISP-SEDESOL-A.pdf',
  title: 'Informe 001-2025-DDISP-SEDESOL-A sobre SEDESOL',
  snippet: 'Auditoría de SEDESOL vinculada al expediente objetivo.',
  source_query: 'SEDESOL 001-2025-DDISP-SEDESOL-A',
  redirect_chain: [],
};

test('BBCBOARDS_FAS_ONLY_REJECT', () => {
  const out = evaluateCandidate({
    raw_url: 'https://www.bbcboards.net/showthread.php?t=123',
    title: 'FAS discussion',
    snippet: 'FAS setup and forum discussion',
    source_query: 'FAS',
    redirect_chain: [],
  });
  assert.equal(out.decision, 'REJECT');
  assert.equal(out.target_relevance.pass, false);
});

test('OFFICIAL_TSC_SEDESOL_AUDIT_ACCEPT', () => {
  const out = evaluateCandidate(tsc);
  assert.equal(out.decision, 'ACCEPT');
  assert.equal(out.classification, 'AUTHORITY_CANDIDATE');
  assert.equal(out.target_relevance.pass, true);
  assert.equal(out.source_authority.pass, true);
});

test('DM_698_2025_AUTHORITY_ACCEPT', () => {
  const out = evaluateCandidate({
    raw_url: 'https://portal.iaip.gob.hn/portal/ver_documento.php?uid=2570649',
    title: 'SEDESOL Convenio 011 — referencia DM-698-2025',
    snippet: 'Documento soporte citado para Jóvenes Metas.',
    source_query: 'DM-698-2025 SEDESOL',
    redirect_chain: [],
  });
  assert.equal(out.decision, 'ACCEPT');
  assert.equal(out.classification, 'RETRIEVAL_CANDIDATE_ONLY');
});

test('029_GA_2025_AUTHORITY_ACCEPT', () => {
  const out = evaluateCandidate({
    raw_url: 'https://portal.iaip.gob.hn/portal/ver_documento.php?uid=2570649',
    title: 'SEDESOL Convenio 011 — referencia 029-GA-2025',
    snippet: 'Documento soporte citado para Jóvenes Metas.',
    source_query: '029-GA-2025 SEDESOL',
    redirect_chain: [],
  });
  assert.equal(out.decision, 'ACCEPT');
  assert.equal(out.classification, 'RETRIEVAL_CANDIDATE_ONLY');
});

test('BING_WRAPPER_CANONICALIZES_OR_REJECTS_FAIL_CLOSED', () => {
  const target = tsc.raw_url;
  const token = Buffer.from(target, 'utf8').toString('base64').replace(/=+$/u, '');
  const wrapped = `https://www.bing.com/ck/a?u=a1${token}`;
  assert.equal(canonicalizeCandidateUrl(wrapped).canonical_url, target);
  assert.equal(canonicalizeCandidateUrl('https://www.bing.com/ck/a?x=opaque').status, 'REJECT_OPAQUE_WRAPPER');
});

test('GENERIC_FAS_ONLY_ADMISSION_ZERO', () => {
  const fixtures = [
    ['https://example.com/fas', 'FAS', 'FAS'],
    ['https://www.bbcboards.net/fas', 'FAS forum', 'FAS'],
    ['https://shop.example/fas', 'FAS product', 'FAS'],
  ];
  const admitted = fixtures.filter(([raw_url, title, snippet]) =>
    evaluateCandidate({ raw_url, title, snippet, source_query: 'FAS', redirect_chain: [] }).decision === 'ACCEPT'
  );
  assert.equal(admitted.length, 0);
});

test('URL_NOISE_ONLY_REJECT', () => {
  const out = evaluateCandidate({
    raw_url: 'https://example.com/SEDESOL/DM-698-2025/Jovenes-Metas.pdf',
    title: 'Documento disponible',
    snippet: 'Archivo para descarga.',
    source_query: 'DM-698-2025',
    redirect_chain: [],
  });
  assert.equal(out.decision, 'REJECT');
  assert.equal(out.target_relevance.pass, false);
});

test('OFFICIAL_HOST_UNRELATED_CONTENT_REJECT', () => {
  const out = evaluateCandidate({
    raw_url: 'https://www.tsc.gob.hn/other-report.pdf',
    title: 'Informe anual de otra institución',
    snippet: 'Contenido sobre otra dependencia estatal.',
    source_query: 'SEDESOL',
    redirect_chain: [],
  });
  assert.equal(out.decision, 'REJECT');
});

test('SOURCE_QUERY_AND_REDIRECT_PROVENANCE_PRESERVED', () => {
  const out = evaluateCandidate({
    ...tsc,
    source_query: 'consulta exacta SEDESOL',
    redirect_chain: ['https://search.example/result', tsc.raw_url],
  });
  assert.deepEqual(out.provenance, {
    source_query: 'consulta exacta SEDESOL',
    raw_url: tsc.raw_url,
    canonical_url: tsc.raw_url,
    redirect_chain: ['https://search.example/result', tsc.raw_url],
  });
});

test('DETERMINISTIC_OUTPUT', () => {
  const a = evaluateCandidate(tsc);
  const b = evaluateCandidate(structuredClone(tsc));
  assert.deepEqual(a, b);
});

test('ZERO_NETWORK_BROWSER_VM_MOTHERDUCK_WRITE_SPEND', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./fas-candidate-filter-v1.mjs', import.meta.url), 'utf8');
  const banned = [
    "from 'node:http'", "from 'node:https'", 'child_process', 'playwright',
    'puppeteer', 'motherduck', 'fetch(', 'XMLHttpRequest', 'WebSocket',
  ];
  for (const token of banned) assert.equal(source.includes(token), false, `banned runtime token: ${token}`);
});
