import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'playwright-controller', 'artifacts');
const ALLOWED_ACTIONS = new Set([
  'goto', 'reload', 'click', 'fill', 'type', 'press', 'select',
  'check', 'uncheck', 'wait_for', 'wait_ms', 'assert_text',
  'assert_url', 'screenshot',
]);
const ALLOWED_EXTRACTS = new Set(['title', 'url', 'text', 'count', 'attribute', 'html', 'visible']);
const LOCATOR_KEYS = ['selector', 'role', 'label', 'placeholder', 'text', 'testid', 'alt', 'title'];

function fail(message) {
  throw new Error(message);
}

export function browserHeadlessMode(env = process.env) {
  return env.PW_HEADLESS !== 'false';
}

function requireString(value, field, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    fail(`${field} must be a${allowEmpty ? '' : ' non-empty'} string`);
  }
  return value;
}

function validateHttpUrl(value, field = 'url') {
  requireString(value, field);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${field} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail(`${field} must use http or https`);
  }
  return parsed.toString();
}

function validateLocator(locator, field) {
  if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
    fail(`${field} must be an object`);
  }
  const present = LOCATOR_KEYS.filter((key) => locator[key] !== undefined);
  if (present.length !== 1) {
    fail(`${field} must specify exactly one locator strategy`);
  }
  const strategy = present[0];
  requireString(locator[strategy], `${field}.${strategy}`);
  if (strategy === 'role' && locator.name !== undefined) {
    requireString(locator.name, `${field}.name`);
  }
  if (locator.exact !== undefined && typeof locator.exact !== 'boolean') {
    fail(`${field}.exact must be boolean`);
  }
  return locator;
}

export function safeArtifactPath(relativePath) {
  requireString(relativePath, 'artifact path');
  if (relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    fail('Unsafe artifact path');
  }
  const resolved = path.resolve(ARTIFACT_ROOT, relativePath);
  if (resolved !== ARTIFACT_ROOT && !resolved.startsWith(`${ARTIFACT_ROOT}${path.sep}`)) {
    fail('Unsafe artifact path');
  }
  return resolved;
}

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('request must be an object');
  }
  const runId = requireString(input.run_id, 'run_id');
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(runId)) {
    fail('run_id may contain only letters, numbers, dot, underscore, and hyphen');
  }

  const request = {
    run_id: runId,
    url: validateHttpUrl(input.url),
    timeout_ms: input.timeout_ms ?? 45_000,
    viewport: input.viewport ?? { width: 1440, height: 900 },
    actions: input.actions ?? [],
    extract: input.extract ?? [],
    capture_final_screenshot: input.capture_final_screenshot ?? true,
  };

  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms < 1_000 || request.timeout_ms > 120_000) {
    fail('timeout_ms must be an integer between 1000 and 120000');
  }
  if (!request.viewport || !Number.isInteger(request.viewport.width) || !Number.isInteger(request.viewport.height)
      || request.viewport.width < 320 || request.viewport.width > 3840
      || request.viewport.height < 240 || request.viewport.height > 2160) {
    fail('viewport must contain reasonable integer width and height values');
  }
  if (!Array.isArray(request.actions) || request.actions.length > 100) {
    fail('actions must be an array with at most 100 items');
  }
  if (!Array.isArray(request.extract) || request.extract.length > 50) {
    fail('extract must be an array with at most 50 items');
  }
  if (typeof request.capture_final_screenshot !== 'boolean') {
    fail('capture_final_screenshot must be boolean');
  }

  request.actions.forEach((action, index) => {
    const field = `actions[${index}]`;
    if (!action || typeof action !== 'object' || Array.isArray(action)) fail(`${field} must be an object`);
    if (!ALLOWED_ACTIONS.has(action.type)) fail(`Unsupported action: ${action.type}`);

    if (['click', 'fill', 'type', 'press', 'select', 'check', 'uncheck', 'wait_for', 'assert_text'].includes(action.type)) {
      validateLocator(action.locator, `${field}.locator`);
    }
    if (action.type === 'goto') validateHttpUrl(action.url, `${field}.url`);
    if (['fill', 'type'].includes(action.type)) requireString(action.value, `${field}.value`, { allowEmpty: true });
    if (action.type === 'press') requireString(action.key, `${field}.key`);
    if (action.type === 'select' && typeof action.value !== 'string' && !Array.isArray(action.value)) {
      fail(`${field}.value must be a string or array`);
    }
    if (action.type === 'wait_ms' && (!Number.isInteger(action.ms) || action.ms < 0 || action.ms > 30_000)) {
      fail(`${field}.ms must be an integer between 0 and 30000`);
    }
    if (action.type === 'assert_text') {
      if (action.equals === undefined && action.contains === undefined) fail(`${field} needs equals or contains`);
      if (action.equals !== undefined) requireString(action.equals, `${field}.equals`, { allowEmpty: true });
      if (action.contains !== undefined) requireString(action.contains, `${field}.contains`, { allowEmpty: true });
    }
    if (action.type === 'assert_url') {
      if (action.equals === undefined && action.contains === undefined) fail(`${field} needs equals or contains`);
    }
    if (action.type === 'screenshot') safeArtifactPath(action.path ?? 'page.png');
  });

  request.extract.forEach((item, index) => {
    const field = `extract[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${field} must be an object`);
    requireString(item.name, `${field}.name`);
    if (!ALLOWED_EXTRACTS.has(item.type)) fail(`Unsupported extract type: ${item.type}`);
    if (!['title', 'url'].includes(item.type)) validateLocator(item.locator, `${field}.locator`);
    if (item.type === 'attribute') requireString(item.attribute, `${field}.attribute`);
  });

  return request;
}

function locatorFor(page, spec) {
  if (spec.selector !== undefined) return page.locator(spec.selector);
  if (spec.role !== undefined) return page.getByRole(spec.role, { name: spec.name, exact: spec.exact });
  if (spec.label !== undefined) return page.getByLabel(spec.label, { exact: spec.exact });
  if (spec.placeholder !== undefined) return page.getByPlaceholder(spec.placeholder, { exact: spec.exact });
  if (spec.text !== undefined) return page.getByText(spec.text, { exact: spec.exact });
  if (spec.testid !== undefined) return page.getByTestId(spec.testid);
  if (spec.alt !== undefined) return page.getByAltText(spec.alt, { exact: spec.exact });
  if (spec.title !== undefined) return page.getByTitle(spec.title, { exact: spec.exact });
  fail('Unknown locator strategy');
}

async function runAction(page, action, timeout) {
  const locator = action.locator ? locatorFor(page, action.locator) : null;
  switch (action.type) {
    case 'goto':
      await page.goto(action.url, { waitUntil: action.wait_until ?? 'domcontentloaded', timeout });
      break;
    case 'reload':
      await page.reload({ waitUntil: action.wait_until ?? 'domcontentloaded', timeout });
      break;
    case 'click':
      await locator.click({ timeout, button: action.button, clickCount: action.click_count });
      break;
    case 'fill':
      await locator.fill(action.value, { timeout });
      break;
    case 'type':
      await locator.pressSequentially(action.value, { delay: action.delay_ms ?? 0, timeout });
      break;
    case 'press':
      await locator.press(action.key, { timeout });
      break;
    case 'select':
      await locator.selectOption(action.value, { timeout });
      break;
    case 'check':
      await locator.check({ timeout });
      break;
    case 'uncheck':
      await locator.uncheck({ timeout });
      break;
    case 'wait_for':
      await locator.waitFor({ state: action.state ?? 'visible', timeout });
      break;
    case 'wait_ms':
      await page.waitForTimeout(action.ms);
      break;
    case 'assert_text': {
      const actual = (await locator.textContent({ timeout })) ?? '';
      if (action.equals !== undefined && actual !== action.equals) {
        fail(`assert_text failed: expected exactly ${JSON.stringify(action.equals)}, got ${JSON.stringify(actual)}`);
      }
      if (action.contains !== undefined && !actual.includes(action.contains)) {
        fail(`assert_text failed: expected ${JSON.stringify(actual)} to contain ${JSON.stringify(action.contains)}`);
      }
      break;
    }
    case 'assert_url': {
      const actual = page.url();
      if (action.equals !== undefined && actual !== action.equals) fail(`assert_url failed: ${actual}`);
      if (action.contains !== undefined && !actual.includes(action.contains)) fail(`assert_url failed: ${actual}`);
      break;
    }
    case 'screenshot': {
      const output = safeArtifactPath(action.path ?? 'page.png');
      await fsp.mkdir(path.dirname(output), { recursive: true });
      await page.screenshot({ path: output, fullPage: action.full_page ?? true });
      break;
    }
    default:
      fail(`Unsupported action: ${action.type}`);
  }
}

async function extractValue(page, item, timeout) {
  if (item.type === 'title') return page.title();
  if (item.type === 'url') return page.url();
  const locator = locatorFor(page, item.locator);
  switch (item.type) {
    case 'text': return (await locator.textContent({ timeout })) ?? '';
    case 'count': return locator.count();
    case 'attribute': return locator.getAttribute(item.attribute, { timeout });
    case 'html': return locator.innerHTML({ timeout });
    case 'visible': return locator.isVisible({ timeout });
    default: fail(`Unsupported extract type: ${item.type}`);
  }
}

async function findChromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fsp.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  fail('No executable Chrome/Chromium found; set PLAYWRIGHT_CHROME_PATH');
}

async function writeJson(relativePath, value) {
  const output = safeArtifactPath(relativePath);
  await fsp.mkdir(path.dirname(output), { recursive: true });
  await fsp.writeFile(output, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function main(requestPath = process.env.PW_REQUEST ?? 'playwright-controller/request.json') {
  await fsp.rm(ARTIFACT_ROOT, { recursive: true, force: true });
  await fsp.mkdir(ARTIFACT_ROOT, { recursive: true });

  const startedAt = new Date().toISOString();
  const actionLog = [];
  let browser;
  let context;
  let page;
  let request;
  let traceStarted = false;
  const headless = browserHeadlessMode();

  try {
    request = validateRequest(JSON.parse(await fsp.readFile(requestPath, 'utf8')));
    const { chromium } = await import('playwright-core');
    const executablePath = await findChromeExecutable();
    browser = await chromium.launch({
      executablePath,
      headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    context = await browser.newContext({ viewport: request.viewport });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    traceStarted = true;
    page = await context.newPage();
    page.setDefaultTimeout(request.timeout_ms);
    page.setDefaultNavigationTimeout(request.timeout_ms);

    await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: request.timeout_ms });

    for (let index = 0; index < request.actions.length; index += 1) {
      const action = request.actions[index];
      const start = Date.now();
      await runAction(page, action, request.timeout_ms);
      actionLog.push({ index, type: action.type, success: true, duration_ms: Date.now() - start });
    }

    const output = {};
    for (const item of request.extract) {
      output[item.name] = await extractValue(page, item, request.timeout_ms);
    }

    await fsp.writeFile(safeArtifactPath('final.html'), await page.content(), 'utf8');
    if (request.capture_final_screenshot) {
      await page.screenshot({ path: safeArtifactPath('final.png'), fullPage: true });
    }
    if (traceStarted) {
      await context.tracing.stop({ path: safeArtifactPath('trace.zip') });
      traceStarted = false;
    }

    const result = {
      success: true,
      run_id: request.run_id,
      browser_headless: headless,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      final_url: page.url(),
      output,
      actions: actionLog,
    };
    await writeJson('result.json', result);
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    const normalizedError = {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      stack: error?.stack,
    };
    try {
      if (page) {
        await page.screenshot({ path: safeArtifactPath('failure.png'), fullPage: true });
        await fsp.writeFile(safeArtifactPath('failure.html'), await page.content(), 'utf8');
      }
      if (traceStarted && context) {
        await context.tracing.stop({ path: safeArtifactPath('trace.zip') });
        traceStarted = false;
      }
      await writeJson('result.json', {
        success: false,
        run_id: request?.run_id ?? null,
        browser_headless: headless,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        final_url: page?.url() ?? null,
        actions: actionLog,
        error: normalizedError,
      });
    } catch (artifactError) {
      console.error('Failed to save diagnostic artifacts:', artifactError);
    }
    console.error(normalizedError);
    process.exitCode = 1;
    return { success: false, error: normalizedError };
  } finally {
    await browser?.close().catch(() => {});
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  await main(process.argv[2]);
}
