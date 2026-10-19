import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { BODY_MODES, calculateNutritionTargets, getNutrientStatus } from '../web/health-core.mjs';
import { diffDay, splitPatch, makeEvent, NUTRIENT_FIELDS } from '../web/sync-bridge.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const webRoot = path.join(root, 'web');
const html = await readFile(path.join(webRoot, 'index.html'), 'utf8');
const appScript = html.match(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(appScript, 'public app has a module entrypoint');

// Evaluate the actual named function without starting the app or substituting its
// implementation. Parsing each candidate closing brace also handles templates.
function actualFunction(name, globals = {}) {
  const start = appScript.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `function ${name} exists`);
  for (let end = appScript.indexOf('}', start); end >= 0; end = appScript.indexOf('}', end + 1)) {
    try {
      return new vm.Script(`(${appScript.slice(start, end + 1)})`).runInNewContext(globals);
    } catch (error) {
      if (error.name !== 'SyntaxError') throw error;
    }
  }
  throw new Error(`Unable to parse ${name}`);
}

function literalSettings() {
  const match = appScript.match(/const\s+DEFAULT_SETTINGS\s*=\s*({[^\n;]+})\s*;/);
  assert.ok(match, 'default profile is declared');
  return vm.runInNewContext(`(${match[1]})`);
}

const plain = value => JSON.parse(JSON.stringify(value));
// Source checkouts include historical entrypoints; release archives deliberately
// omit them. Public namespace/default checks still run in both distributions.
async function legacyReference(file) {
  try { return await readFile(path.join(root, file), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

test('public modules and inline entrypoint parse and module imports resolve', async () => {
  const files = await readdir(webRoot);
  for (const file of files.filter(name => /\.(?:mjs|js)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', path.join(webRoot, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    if (file.endsWith('.mjs')) await import(pathToFileURL(path.join(webRoot, file)).href);
  }
  const inline = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: appScript, encoding: 'utf8' });
  assert.equal(inline.status, 0, inline.stderr);
  for (const match of appScript.matchAll(/\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    await access(path.resolve(webRoot, match[1]));
  }
});

test('HTML, manifests, icons and worker assets have resolvable local references', async () => {
  for (const file of (await readdir(webRoot)).filter(name => name.endsWith('.html'))) {
    const source = await readFile(path.join(webRoot, file), 'utf8');
    for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      const reference = match[1];
      if (/^(?:[a-z]+:|#|\$)/i.test(reference) || reference.includes('${')) continue;
      const resolved = path.resolve(webRoot, reference.split(/[?#]/)[0]);
      assert.ok(resolved === webRoot || resolved.startsWith(webRoot + path.sep), `${file} escapes public package`);
      await access(resolved);
    }
  }
  const manifest = JSON.parse(await readFile(path.join(webRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) await access(path.resolve(webRoot, icon.src));
  const worker = await readFile(path.join(webRoot, 'sw.js'), 'utf8');
  const assets = vm.runInNewContext(worker.match(/const\s+ASSETS\s*=\s*(\[[^;]+\])/)[1]);
  for (const asset of assets) await access(path.resolve(webRoot, asset));
  assert.match(appScript, /serviceWorker\.register\(['"]\.\/sw\.js['"]\s*,\s*\{\s*scope\s*:\s*['"]\.\/['"]/);
});

test('public package has no private deployment defaults or personal contact details', async () => {
  assert.match(appScript, /const\s+DEFAULT_SYNC_URL\s*=\s*['"]['"]/);
  const legacy = await legacyReference('phone/index.html');
  const privateLiterals = [...legacy.matchAll(/const\s+(?:LEGACY_SYNC_URL|DEFAULT_SYNC_URL|PRIVACY_OPERATOR|PRIVACY_EMAIL)\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const file of (await readdir(webRoot)).filter(name => /\.(?:html|js|mjs|webmanifest)$/.test(name))) {
    const source = await readFile(path.join(webRoot, file), 'utf8');
    for (const value of privateLiterals) assert.ok(!source.includes(value), `${file} contains a legacy private default/contact`);
  }
});

function storageKeys(source) {
  return [...source.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*(['"])([^'"\r\n]+)\2/g)]
    .filter(match => /(?:STORE|SESSION|OUTBOX|BOOTSTRAP|ENABLED)$/.test(match[1]))
    .map(match => ({ name: match[1], key: match[3] }));
}

test('public browser storage is isolated from both legacy applications', async () => {
  const ai = await readFile(path.join(webRoot, 'ai-client.mjs'), 'utf8');
  const keys = storageKeys(appScript + '\n' + ai);
  assert.ok(keys.length >= 10, 'app, food, privacy, AI and sync stores are included');
  assert.equal(new Set(keys.map(item => item.key)).size, keys.length, 'storage keys are distinct');
  const legacySources = await Promise.all(['index.html', 'phone/index.html', 'phone/ai-client.mjs'].map(legacyReference));
  const oldKeys = new Set(storageKeys(legacySources.join('\n')).map(item => item.key));
  for (const { name, key } of keys) {
    assert.match(key, /^(?:qingheng|qh)-public-/, `${name} needs a public namespace`);
    assert.ok(!oldKeys.has(key), `${name} must not read or overwrite legacy data`);
  }
});

test('demo blocks real AI, cloud reads/writes, credentials and persistent record saves', async () => {
  const touches = [];
  const forbidden = label => () => { touches.push(label); throw new Error(`unexpected ${label}`); };
  const globals = {
    DEMO_MODE: true,
    fetch: forbidden('network'),
    localStorage: { getItem: forbidden('local read'), setItem: forbidden('local write'), removeItem: forbidden('local delete') },
    sessionStorage: { getItem: forbidden('credential read'), setItem: forbidden('credential write') },
    showToast: () => {},
  };
  await assert.rejects(actualFunction('requestAiRecognition', globals)({}), /示例|demo/i);
  await actualFunction('pullSync', globals)(true);
  await actualFunction('flushPhoneOutbox', globals)(true);
  await actualFunction('openSyncConfig', globals)();
  await actualFunction('openAiSettings', globals)();
  actualFunction('save', globals)();
  assert.equal(actualFunction('readPhoneSession', globals)('any-key'), '');
  assert.deepEqual(touches, []);
});

test('demo food library and another real-record tab cannot read or replace fictional data', () => {
  const touches = [];
  const globals = {
    DEMO_MODE: true, FOOD_DB: [], FOOD_LIBRARY_STORE: 'public-test-foods',
    localStorage: {
      getItem: () => { touches.push('food read'); return '[]'; },
      setItem: () => { touches.push('food write'); },
    },
  };
  actualFunction('loadUserFoods', globals)();
  actualFunction('saveUserFoods', globals)();
  assert.deepEqual(touches, [], 'demonstration never loads or overwrites saved personal foods');

  let handler;
  const original = { demo: true };
  const context = {
    DEMO_MODE: true, STORE: 'public-test-records', data: original,
    validateState: () => ({ private: true }), render: () => {},
    window: { addEventListener: (type, callback) => { assert.equal(type, 'storage'); handler = callback; } },
  };
  const registration = appScript.split(/\r?\n/).find(line => /window\.addEventListener\(['"]storage['"]/.test(line));
  assert.ok(registration);
  vm.runInNewContext(registration, context);
  handler({ key: context.STORE, newValue: '{"private":true}' });
  assert.equal(context.data, original, 'real-record storage events cannot populate demo views');
});

test('complete demo boot and navigation never load saved records/config or persist changes', async () => {
  const touches = [], listeners = new Map(), nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, contains: () => false, toggle: () => false },
      setAttribute() {}, addEventListener() {}, prepend() {}, appendChild() {},
      querySelector: child => node(child), querySelectorAll: () => [],
      animate() {}, focus() {}, remove() {}, click() {},
    });
    return nodes.get(selector);
  };
  const storage = {
    getItem: key => { touches.push(`read:${key}`); return null; },
    setItem: key => { touches.push(`write:${key}`); },
    removeItem: key => { touches.push(`delete:${key}`); },
  };
  const globals = {
    URL, URLSearchParams, Headers, Request, Response, Blob, TextEncoder, TextDecoder,
    location: new URL('https://public.example.test/project/web/?demo=1'),
    localStorage: storage, sessionStorage: storage,
    fetch: async () => { touches.push('network'); throw new Error('demo network forbidden'); },
    navigator: { onLine: true, serviceWorker: { register: async () => ({}) } },
    document: { querySelector: node, querySelectorAll: () => [], createElement: node, body: node('body'), addEventListener() {}, visibilityState: 'visible' },
    window: { matchMedia: () => ({ matches: true }), addEventListener: (type, fn) => listeners.set(type, fn), scrollTo() {} },
    requestAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
    confirm: () => true, alert: message => { throw new Error(message); }, console,
  };
  for (const file of ['ai-client.mjs', 'chain-foods.mjs', 'health-core.mjs', 'sync-bridge.mjs']) {
    Object.assign(globals, await import(pathToFileURL(path.join(webRoot, file)).href));
  }
  const context = vm.createContext(globals);
  vm.runInContext(appScript.replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, ''), context);
  assert.ok(node('#main').innerHTML.length > 100, 'demo renders real app UI');
  assert.equal(vm.runInContext('Object.keys(data.days).length', context), 7);
  for (const tab of ['food', 'trends', 'profile', 'home']) vm.runInContext(`navigateTo(${JSON.stringify(tab)})`, context);
  const before = vm.runInContext('JSON.stringify(data)', context);
  listeners.get('storage')({ key: 'qingheng-public-local-v1', newValue: '{"days":{},"weightHistory":{}}' });
  assert.equal(vm.runInContext('JSON.stringify(data)', context), before);
  vm.runInContext('openOnboarding(0)', context);
  node('#tutorialBack').onclick?.();
  vm.runInContext('withdrawPrivacyConsent()', context);
  vm.runInContext('reset()', context);
  assert.deepEqual(touches, [], 'demo boot/navigation must not read or write personal browser storage');
});

test('fresh public records are empty; demo is marked fictitious and uses valid profile/records', () => {
  const settings = literalSettings();
  assert.ok(Object.hasOwn(BODY_MODES, settings.bodyMode));
  assert.equal(settings.birthMonth, '');
  assert.equal(settings.usesWearableActivity, false);
  const globals = { DEFAULT_SETTINGS: settings };
  globals.initState = actualFunction('initState', globals);
  globals.emptyDay = actualFunction('emptyDay', globals);
  globals.localDate = actualFunction('localDate', globals);
  const empty = plain(globals.initState());
  assert.deepEqual(empty.days, {});
  assert.deepEqual(empty.weightHistory, {});
  const demo = plain(actualFunction('createDemoState', globals)());
  assert.equal(Object.keys(demo.days).length, 7);
  assert.equal(Object.keys(demo.weightHistory).length, 7);
  assert.ok(Object.hasOwn(BODY_MODES, demo.settings.bodyMode));
  const meals = Object.values(demo.days).flatMap(day => day.entries);
  assert.ok(meals.length > 0);
  for (const entry of meals) {
    assert.match(entry.id, /^demo-/);
    assert.match(entry.origin, /虚构|fictional/i);
    assert.ok(['breakfast', 'lunch', 'dinner', 'snack'].includes(entry.meal));
    assert.ok(Number.isFinite(entry.kcal) && entry.kcal >= 0);
  }
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.doesNotMatch(key, /token|secret|password|api.?key|sync.?url/i, 'seed must not carry credentials or endpoints');
      visit(child);
    }
  };
  visit(demo);
});

async function workerHarness() {
  const handlers = new Map(), deleted = [], puts = [], fetched = [], installed = [];
  const cache = { addAll: async values => installed.push(...values), put: async (...args) => puts.push(args) };
  const source = await readFile(path.join(webRoot, 'sw.js'), 'utf8');
  const location = new URL('https://public.example.test/project/web/sw.js');
  const globals = {
    URL, Headers, Request, Response, location,
    self: { location, addEventListener: (type, fn) => handlers.set(type, fn), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['unrelated-cache', 'qingheng-offline-private', 'qingheng-public-shell-old'], delete: async key => { deleted.push(key); return true; }, match: async () => undefined },
    fetch: async request => { fetched.push(request.url || request); return new Response('<html>public shell</html>', { headers: { 'Content-Type': 'text/html' } }); },
  };
  vm.runInNewContext(source, globals);
  async function dispatch(url, options = {}) {
    let response;
    const request = { url, method: options.method || 'GET', mode: options.mode || 'cors', headers: new Headers(options.headers || {}) };
    handlers.get('fetch')({ request, respondWith: promise => { assert.equal(response, undefined); response = Promise.resolve(promise); } });
    if (response) await response;
    await new Promise(resolve => setImmediate(resolve));
    return Boolean(response);
  }
  async function lifetime(type) {
    let work;
    handlers.get(type)({ waitUntil: promise => { work = promise; } });
    await work;
  }
  return { dispatch, lifetime, deleted, puts, fetched, installed };
}

test('service worker installs only shell files and deletes only its own stale caches', async () => {
  const worker = await workerHarness();
  await worker.lifetime('install');
  assert.ok(worker.installed.length > 0);
  for (const file of worker.installed) {
    assert.match(file, /^\.\//);
    assert.doesNotMatch(file, /https?:|events|export|backup|private|\.json$/i);
  }
  await worker.lifetime('activate');
  assert.deepEqual(worker.deleted, ['qingheng-public-shell-old']);
});

test('service worker bypasses external, authenticated, API, export and out-of-scope requests', async () => {
  const worker = await workerHarness();
  const base = 'https://public.example.test/project/web/';
  for (const [url, options] of [
    ['https://api.example.test/v1/events', {}],
    [base + 'index.html', { method: 'POST' }],
    [base + 'index.html', { headers: { Authorization: 'Bearer test-only-never-a-real-key' } }],
    [base + 'index.html?token=test-only', { mode: 'navigate' }],
    [base + 'v1/events', {}],
    [base + 'export.json', { mode: 'navigate' }],
    [base + 'records.private.json', { mode: 'navigate' }],
    [base + 'unknown-route', { mode: 'navigate' }],
    ['https://public.example.test/project/phone/index.html', { mode: 'navigate' }],
  ]) assert.equal(await worker.dispatch(url, options), false, `${url} must bypass app shell cache`);
  assert.equal(worker.puts.length, 0);
  assert.equal(await worker.dispatch(base + 'index.html', { mode: 'navigate' }), true);
  assert.ok(worker.fetched.length > 0);
});

const entry = (id, changes = {}) => ({ id, name: '示例食品', meal: 'lunch', amount: 100, unit: 'g', custom: true, kcal: 120, protein: 8, carbs: 15, fat: 3, fiber: null, sodium: null, potassium: null, calcium: null, vitC: null, ...changes });
const calculate = actualFunction('calcNutrition', { FIELDS: NUTRIENT_FIELDS });

function nutritionRenderer() {
  const statusCalls = [];
  const globals = {
    FIELDS: NUTRIENT_FIELDS, calcNutrition: calculate,
    MEALS: ['breakfast', 'lunch', 'dinner', 'snack'].map(id => ({ id })),
    data: { settings: literalSettings() }, activeDate: '2026-01-01',
    calculateNutritionTargets,
    getNutrientStatus: (...args) => { statusCalls.push(args); return getNutrientStatus(...args); },
    recentNutritionPattern: () => [], esc: value => String(value),
    expend: () => ({ total: 0 }),
  };
  globals.DEFAULT_SETTINGS = globals.data.settings;
  globals.sums = actualFunction('sums', globals);
  globals.fmt = actualFunction('fmt', globals);
  globals.calorieTotals = actualFunction('calorieTotals', globals);
  return {
    render: actualFunction('macroCard', globals),
    advice: actualFunction('nutritionAdvice', globals),
    sums: globals.sums, statusCalls, settings: globals.data.settings,
  };
}

test('nutrition card renders unknown sodium as unavailable and displays the actual upper bound', () => {
  const renderer = nutritionRenderer();
  const day = { entries: [entry('nutrition-unknown')], activity: null, mealOverrides: {}, calorieOverride: null };
  const sum = renderer.sums(day.entries);
  assert.equal(sum.result.sodium, 0, 'sum is a lower bound, not proof of known zero sodium');
  assert.equal(sum.missing.sodium, 1);
  const sodiumRow = markup => markup.split('<div class="zone-row">').find(row => /<span>钠/.test(row));
  const unknown = sodiumRow(renderer.render(day));
  assert.ok(unknown, 'sodium row is rendered');
  assert.match(unknown, /钠 \* · — mg/);
  assert.match(unknown, /数据不足/);
  assert.doesNotMatch(unknown, /合理摄入|zone-marker/);
  assert.ok(!renderer.statusCalls.some(([, , options]) => options?.maximumOnly), 'unknown sodium is never classified as an ideal known zero');
  const targets = calculateNutritionTargets(renderer.settings, { actualActivity: null, intakeKcal: 120, referenceDate: '2026-01-01' });
  assert.ok(targets.sodium[1] > targets.sodium[0]);
  assert.ok(unknown.includes(`建议上限 ≤ ${targets.sodium[1].toLocaleString('zh-CN')} mg`));

  const knownAmount = targets.sodium[1] + 1000;
  const knownDay = { ...day, entries: [entry('nutrition-known', { sodium: knownAmount })] };
  const known = sodiumRow(renderer.render(knownDay));
  const expectedStatus = getNutrientStatus(knownAmount, targets.sodium, { maximumOnly: true });
  assert.ok(known.includes(expectedStatus.label), 'known excessive sodium receives the actual health-core classification');
  assert.ok(known.includes(`${knownAmount.toLocaleString('zh-CN')} mg`));
  assert.doesNotMatch(known, /数据不足/);
  assert.match(known, /zone-marker/);
});

test('micronutrient advice requires known data rather than treating unknowns as zero', () => {
  const renderer = nutritionRenderer();
  const day = { entries: [entry('micro-unknown')], activity: null, mealOverrides: {}, calorieOverride: null };
  const microKeys = ['calcium', 'vitC', 'potassium'];
  const unknownAdvice = renderer.advice(day);
  assert.ok(!unknownAdvice.some(item => microKeys.includes(item.key)), 'all-unknown micronutrients must not trigger deficiency advice');
  const withKnown = { ...day, entries: [entry('micro-known', { calcium: 100, vitC: 10, potassium: 100 })] };
  const knownKeys = renderer.advice(withKnown).map(item => item.key);
  for (const key of microKeys) assert.ok(knownKeys.includes(key), `${key} remains actionable when a known component exists`);
});

test('real day diff handles additions, edits, deletions and unknown nutrition without inventing zeroes', () => {
  const original = { entries: [entry('edit-me'), entry('remove-me')], weight: 70, activity: 200, note: '' };
  const revised = { entries: [entry('edit-me', { amount: 150, kcal: 180 }), entry('add-me', { kcal: 90 })], weight: null, activity: 250, note: '' };
  const patch = diffDay(original, revised, calculate);
  assert.deepEqual(patch.removeEntryIds, ['remove-me']);
  assert.deepEqual(patch.entries.map(item => item.id), ['edit-me', 'add-me']);
  assert.equal(patch.entries[0].amount, 150);
  assert.equal(patch.entries[0].kcal, 180);
  assert.equal(patch.weight, null);
  assert.equal(patch.activity, 250);
  for (const added of patch.entries) {
    for (const field of ['fiber', 'sodium', 'potassium', 'calcium', 'vitC']) assert.ok(added[field] == null, `${field} remains unknown`);
  }
  assert.deepEqual(diffDay(revised, revised, calculate), {});
  const event = makeEvent('2026-01-01', patch, 'test-public-event-001');
  assert.equal(event.type, 'day.patch');
  assert.equal(event.payload, patch);
});

test('large patches split to service limits without dropping or duplicating changed data', () => {
  const additions = Array.from({ length: 123 }, (_, index) => entry(`added-${index}`));
  const removals = Array.from({ length: 53 }, (_, index) => `removed-${index}`);
  const chunks = splitPatch({ entries: additions, removeEntryIds: removals, weight: 70, noteAppend: '示例备注' });
  assert.deepEqual(chunks.flatMap(chunk => chunk.entries || []), additions);
  assert.deepEqual(chunks.flatMap(chunk => chunk.removeEntryIds || []), removals);
  for (const chunk of chunks) {
    assert.ok((chunk.entries?.length || 0) <= 50);
    assert.ok((chunk.removeEntryIds?.length || 0) <= 50);
  }
  assert.equal(chunks.filter(chunk => Object.hasOwn(chunk, 'weight')).length, 1);
  assert.equal(chunks.filter(chunk => Object.hasOwn(chunk, 'noteAppend')).length, 1);
});
