const OFFICIAL_HOSTS = [
  'tsc.gob.hn',
  'iaip.gob.hn',
  'sedesol.gob.hn',
  'banadesa.hn',
];

const VERIFIED_AUTHORITIES = [
  'TSC',
  'IAIP',
  'SEDESOL',
  'BANADESA',
];

const EXACT_INSTRUMENTS = [
  '001-2025-DDISP-SEDESOL-A',
  'DM-698-2025',
  '029-GA-2025',
];

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase();
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isBingWrapper(url) {
  const host = url.hostname.toLowerCase();
  return (host === 'bing.com' || host.endsWith('.bing.com')) && url.pathname === '/ck/a';
}

function decodeBingToken(value) {
  if (!value) return null;
  const direct = String(value);
  if (isHttpUrl(direct)) return direct;

  if (!direct.startsWith('a1')) return null;
  let token = direct.slice(2).replace(/-/gu, '+').replace(/_/gu, '/');
  token += '='.repeat((4 - (token.length % 4)) % 4);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    return isHttpUrl(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function canonicalizeCandidateUrl(rawUrl) {
  if (!isHttpUrl(rawUrl)) {
    return { status: 'REJECT_INVALID_URL', canonical_url: null };
  }

  const parsed = new URL(rawUrl);
  if (!isBingWrapper(parsed)) {
    return { status: 'DIRECT_HTTP_URL', canonical_url: parsed.href };
  }

  const candidateParams = ['url', 'target', 'r', 'u'];
  for (const key of candidateParams) {
    const value = parsed.searchParams.get(key);
    const decoded = decodeBingToken(value);
    if (!decoded) continue;
    const target = new URL(decoded);
    if (isBingWrapper(target)) {
      return { status: 'REJECT_NESTED_WRAPPER', canonical_url: null };
    }
    return { status: 'CANONICALIZED_WRAPPER', canonical_url: target.href };
  }

  return { status: 'REJECT_OPAQUE_WRAPPER', canonical_url: null };
}

function collectContentFields(candidate) {
  const metadata = candidate?.source_metadata ?? {};
  return [
    ['title', candidate?.title],
    ['snippet', candidate?.snippet],
    ['body', candidate?.body],
    ['document_title', metadata.document_title],
    ['document_id', metadata.document_id],
    ['description', metadata.description],
    ['institution', metadata.institution],
    ['source_name', metadata.source_name],
  ].filter(([, value]) => typeof value === 'string' && value.trim() !== '');
}

function targetRelevance(candidate) {
  const fields = collectContentFields(candidate);
  const signals = [];
  const firedFields = [];

  for (const [field, raw] of fields) {
    const text = fold(raw);
    for (const instrument of EXACT_INSTRUMENTS) {
      if (text.includes(fold(instrument))) {
        signals.push(`EXACT_INSTRUMENT:${instrument}`);
        firedFields.push(field);
      }
    }
    if (text.includes('SEDESOL')) {
      signals.push('ENTITY:SEDESOL');
      firedFields.push(field);
    }
    if (text.includes('JOVENES METAS')) {
      signals.push('ENTITY:JOVENES_METAS');
      firedFields.push(field);
    }
    if (text.includes('CONVENIO 011')) {
      signals.push('INSTRUMENT:CONVENIO_011');
      firedFields.push(field);
    }
    if (text.includes('RED SOLIDARIA')) {
      signals.push('ENTITY:RED_SOLIDARIA');
      firedFields.push(field);
    }
    if (text.includes('SEDESOL') && /(AUDITOR|INFORME|EXPEDIENTE|CONVENIO)/u.test(text)) {
      signals.push('SEDESOL_AUDIT_OR_FILE_SIGNAL');
      firedFields.push(field);
    }
  }

  const uniqueSignals = [...new Set(signals)].sort();
  const uniqueFields = [...new Set(firedFields)].sort();
  const exactInstrument = uniqueSignals.some((s) => s.startsWith('EXACT_INSTRUMENT:'));
  const sedesolAudit = uniqueSignals.includes('SEDESOL_AUDIT_OR_FILE_SIGNAL');
  const linkedEntityPair = uniqueSignals.includes('ENTITY:SEDESOL') &&
    (uniqueSignals.includes('ENTITY:JOVENES_METAS') || uniqueSignals.includes('INSTRUMENT:CONVENIO_011'));

  return {
    pass: exactInstrument || sedesolAudit || linkedEntityPair,
    signals: uniqueSignals,
    fields: uniqueFields,
  };
}

function hostMatchesAuthority(hostname) {
  const host = hostname.toLowerCase();
  return OFFICIAL_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
}

function sourceAuthority(candidate, canonicalUrl) {
  const signals = [];
  if (canonicalUrl) {
    const host = new URL(canonicalUrl).hostname.toLowerCase();
    if (hostMatchesAuthority(host)) signals.push(`OFFICIAL_HOST:${host}`);
  }

  const metadata = candidate?.source_metadata ?? {};
  const institution = fold(metadata.institution ?? metadata.source_name ?? '');
  if (metadata.authority_verified === true) {
    for (const authority of VERIFIED_AUTHORITIES) {
      if (institution.includes(authority)) signals.push(`VERIFIED_METADATA:${authority}`);
    }
  }

  const uniqueSignals = [...new Set(signals)].sort();
  return { pass: uniqueSignals.length > 0, signals: uniqueSignals };
}

function classificationFor(relevance) {
  if (relevance.signals.includes('EXACT_INSTRUMENT:DM-698-2025') ||
      relevance.signals.includes('EXACT_INSTRUMENT:029-GA-2025')) {
    return 'RETRIEVAL_CANDIDATE_ONLY';
  }
  return 'AUTHORITY_CANDIDATE';
}

export function evaluateCandidate(candidate = {}) {
  const urlResult = canonicalizeCandidateUrl(candidate.raw_url ?? '');
  const relevance = targetRelevance(candidate);
  const authority = sourceAuthority(candidate, urlResult.canonical_url);
  const urlOk = !urlResult.status.startsWith('REJECT_');
  const highPrioritySignal = relevance.signals.some((signal) =>
    signal.startsWith('EXACT_INSTRUMENT:') || signal === 'SEDESOL_AUDIT_OR_FILE_SIGNAL'
  );
  const accept = urlOk && relevance.pass && authority.pass && highPrioritySignal;

  let reasonCode;
  if (!urlOk) reasonCode = urlResult.status;
  else if (!relevance.pass) reasonCode = 'TARGET_RELEVANCE_FAIL';
  else if (!authority.pass) reasonCode = 'SOURCE_AUTHORITY_FAIL';
  else if (!highPrioritySignal) reasonCode = 'HIGH_PRIORITY_SIGNAL_REQUIRED';
  else reasonCode = 'ACCEPT_BOTH_GATES';

  return {
    decision: accept ? 'ACCEPT' : 'REJECT',
    classification: accept ? classificationFor(relevance) : null,
    reason_code: reasonCode,
    target_relevance: relevance,
    source_authority: authority,
    high_priority: accept,
    url_status: urlResult.status,
    provenance: {
      source_query: String(candidate.source_query ?? ''),
      raw_url: String(candidate.raw_url ?? ''),
      canonical_url: urlResult.canonical_url,
      redirect_chain: Array.isArray(candidate.redirect_chain) ? [...candidate.redirect_chain] : [],
    },
  };
}
