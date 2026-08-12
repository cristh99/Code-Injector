import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { classifyPage, selectPublicArtifactLinks } from './handoff.mjs';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'playwright-handoff', 'artifacts');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readRequest(requestPath) {
  const request = JSON.parse(await fsp.readFile(requestPath, 'utf8'));
  if (!request || typeof request !== 'object') throw new Error('request must be an object');
  if (typeof request.run_id !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(request.run_id)) {
    throw new Error('run_id is invalid');
  }
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('url must use http or https');
  const expectedHost = request.expected_host ?? url.hostname;
  const timeoutMs = request.timeout_ms ?? 420_000;
  const settleMs = request.settle_ms ?? 3_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 30_000 || timeoutMs > 540_000) {
    throw new Error('timeout_ms must be between 30000 and 540000');
  }
  if (!Number.isInteger(settleMs) || settleMs < 0 || settleMs > 30_000) {
    throw new Error('settle_ms must be between 0 and 30000');
  }
  return { ...request, url: url.toString(), expected_host: expectedHost, timeout_ms: timeoutMs, settle_ms: settleMs };
}

async function connectToBrowser(deadline) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5_000 });
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  }
  throw new Error(`Could not connect to Chrome over CDP: ${lastError?.message ?? 'timeout'}`);
}

async function findTargetPage(browser, expectedHost) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  for (const page of pages) {
    try {
      if (new URL(page.url()).hostname.toLowerCase() === expectedHost.toLowerCase()) return page;
    } catch {
      // Ignore transient blank or malformed URLs.
    }
  }
  return pages[0] ?? null;
}

async function pageSnapshot(page, expectedHost) {
  const [title, bodyText] = await Promise.all([
    page.title().catch(() => ''),
    page.locator('body').innerText({ timeout: 5_000 }).catch(() => ''),
  ]);
  const url = page.url();
  return {
    title,
    bodyText,
    url,
    state: classifyPage({ title, bodyText, url, expectedHost }),
  };
}

async function writeJson(name, value) {
  await fsp.mkdir(ARTIFACT_ROOT, { recursive: true });
  await fsp.writeFile(path.join(ARTIFACT_ROOT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function extractIdentifier(bodyText, pattern) {
  return bodyText.match(pattern)?.[0] ?? null;
}

async function capture(page, request, snapshot, startedAt, challengeObservations) {
  await delay(request.settle_ms);
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});

  const [title, bodyText, html, allLinks] = await Promise.all([
    page.title().catch(() => snapshot.title),
    page.locator('body').innerText({ timeout: 10_000 }).catch(() => snapshot.bodyText),
    page.content(),
    page.locator('a[href]').evaluateAll((elements) => elements.map((element) => element.href)),
  ]);

  const publicArtifactLinks = selectPublicArtifactLinks(allLinks);
  const screenshotPath = path.join(ARTIFACT_ROOT, 'final.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await fsp.writeFile(path.join(ARTIFACT_ROOT, 'final.html'), html, 'utf8');
  await fsp.writeFile(path.join(ARTIFACT_ROOT, 'body.txt'), bodyText, 'utf8');

  const result = {
    success: true,
    status: 'SOURCE_REACHED_AFTER_HUMAN_HANDOFF',
    run_id: request.run_id,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    source_url: page.url(),
    title,
    request_identifier: extractIdentifier(bodyText, /\bSOL-[A-ZÁÉÍÓÚÑ0-9-]+-\d+-\d{4}\b/i),
    response_memorandum: extractIdentifier(bodyText, /\b(?:GA|DPBS)-[A-ZÁÉÍÓÚÑ0-9-]+-\d+-\d{4}\b/i),
    public_artifact_links: publicArtifactLinks,
    all_link_count: allLinks.length,
    challenge_observations: challengeObservations,
  };
  await writeJson('result.json', result);
  console.log(JSON.stringify(result));
  return result;
}

export async function main(requestPath = process.argv[2] ?? 'playwright-handoff/request.json') {
  await fsp.rm(ARTIFACT_ROOT, { recursive: true, force: true });
  await fsp.mkdir(ARTIFACT_ROOT, { recursive: true });

  const request = await readRequest(requestPath);
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + request.timeout_ms;
  const challengeObservations = [];
  let browser;

  try {
    browser = await connectToBrowser(Math.min(deadline, Date.now() + 30_000));
    let page = await findTargetPage(browser, request.expected_host);
    if (!page) throw new Error('Chrome has no open page');

    let lastState = null;
    while (Date.now() < deadline) {
      const replacement = await findTargetPage(browser, request.expected_host);
      if (replacement) page = replacement;

      const snapshot = await pageSnapshot(page, request.expected_host);
      const observation = {
        observed_at: new Date().toISOString(),
        state: snapshot.state,
        title: snapshot.title,
        url: snapshot.url,
      };
      if (snapshot.state !== lastState || challengeObservations.length === 0) {
        challengeObservations.push(observation);
        lastState = snapshot.state;
        await writeJson('status.json', {
          run_id: request.run_id,
          status: snapshot.state,
          observed_at: observation.observed_at,
          title: snapshot.title,
          url: snapshot.url,
          instruction: snapshot.state === 'challenge'
            ? 'Use the live noVNC session only to complete the visible verification. Do not enter credentials or sensitive data.'
            : null,
        });
      }

      if (snapshot.state === 'source') {
        return await capture(page, request, snapshot, startedAt, challengeObservations);
      }

      await delay(2_000);
    }

    const snapshot = await pageSnapshot(page, request.expected_host);
    await page.screenshot({ path: path.join(ARTIFACT_ROOT, 'timeout.png'), fullPage: true }).catch(() => {});
    await fsp.writeFile(path.join(ARTIFACT_ROOT, 'timeout.html'), await page.content().catch(() => ''), 'utf8');
    const result = {
      success: false,
      status: snapshot.state === 'challenge' ? 'HUMAN_HANDOFF_TIMEOUT_CHALLENGE_REMAINS' : 'HUMAN_HANDOFF_TIMEOUT',
      run_id: request.run_id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      final_url: snapshot.url,
      title: snapshot.title,
      challenge_observations: challengeObservations,
    };
    await writeJson('result.json', result);
    console.error(JSON.stringify(result));
    process.exitCode = 2;
    return result;
  } catch (error) {
    const result = {
      success: false,
      status: 'HANDOFF_RUNTIME_ERROR',
      run_id: request.run_id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) },
      challenge_observations: challengeObservations,
    };
    await writeJson('result.json', result);
    console.error(JSON.stringify(result));
    process.exitCode = 1;
    return result;
  } finally {
    await browser?.close().catch(() => {});
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
