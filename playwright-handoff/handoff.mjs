const CLOUDFLARE_MARKERS = [
  'just a moment',
  'performing security verification',
  'enable javascript and cookies to continue',
  'challenge-platform',
  'cf-chl-',
  'ray id:',
];

const ARTIFACT_HOSTS = [
  '1drv.ms',
  'onedrive.live.com',
  'sharepoint.com',
  'sharepoint-df.com',
  'drive.google.com',
  'docs.google.com',
];

const ARTIFACT_EXTENSIONS = [
  '.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ods', '.odt', '.ppt', '.pptx', '.rar', '.7z',
];

export function classifyPage({ title = '', bodyText = '', url = '', expectedHost = 'sielho.iaip.gob.hn' }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'unexpected';
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    return 'unexpected';
  }

  const haystack = `${title}\n${bodyText}`.toLowerCase();
  if (CLOUDFLARE_MARKERS.some((marker) => haystack.includes(marker))) {
    return 'challenge';
  }

  return 'source';
}

function isArtifactHost(hostname) {
  const host = hostname.toLowerCase();
  return ARTIFACT_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function selectPublicArtifactLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) return [];

  const result = [];
  const seen = new Set();

  for (const rawLink of rawLinks) {
    let parsed;
    try {
      parsed = new URL(rawLink);
    } catch {
      continue;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) continue;

    parsed.hash = '';
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    const hasArtifactExtension = ARTIFACT_EXTENSIONS.some((extension) => path.endsWith(extension));
    const hasDownloadHint = /(?:download|attachment|serve_archivo|ver_archivo|archivo|documento|media\/)/i.test(`${path}${query}`);

    if (!isArtifactHost(parsed.hostname) && !hasArtifactExtension && !hasDownloadHint) continue;

    const normalized = parsed.toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
