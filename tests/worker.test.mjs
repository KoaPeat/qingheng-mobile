import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

const ORIGIN = 'https://demo.example.com';
const READ = 'test-only-read-token-0123456789abcdef';
const WRITE = 'test-only-write-token-0123456789abcdef';

// Immediate-consistency mock for request semantics, not a model of KV's replication.
class MockKV {
  values = new Map();
  puts = [];
  lists = [];
  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return type === 'json' && value !== null ? JSON.parse(value) : value;
  }
  async put(key, value) { this.puts.push(key); this.values.set(key, value); }
  async list(options) {
    this.lists.push(options);
    const cursor = options.cursor || '0';
    if (!/^\d+$/.test(cursor)) throw new Error('Invalid cursor');
    const start = Number(cursor);
    const keys = [...this.values.keys()].filter(key => key.startsWith(options.prefix)).sort();
    const end = Math.min(start + options.limit, keys.length);
    return {
      keys: keys.slice(start, end).map(name => ({ name })),
      list_complete: end >= keys.length,
      cursor: String(end),
    };
  }
}

function environment(overrides = {}) {
  return {
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8000`,
    QH_READ_TOKEN: READ,
    QH_WRITE_TOKEN: WRITE,
    QH_EVENTS: new MockKV(),
    ...overrides,
  };
}
const event = (overrides = {}) => ({
  id: 'test-000001', date: '2026-10-18', type: 'day.patch', payload: { weight: 70 }, ...overrides,
});
function request({ method = 'GET', path = '/v1/events', origin = ORIGIN, token = READ, body, headers = {} } = {}) {
  const allHeaders = { ...headers };
  if (origin !== null) allHeaders.Origin = origin;
  if (token !== null) allHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) allHeaders['Content-Type'] = 'application/json';
  return new Request(`https://inbox.example.com${path}`, {
    method, headers: allHeaders, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}
const call = (env, options) => worker.fetch(request(options), env);

test('CORS permits only configured exact origins and needed preflight headers/methods', async () => {
  const env = environment();
  for (const origin of [ORIGIN, 'http://localhost:8000']) {
    const response = await call(env, {
      method: 'OPTIONS', origin, token: null,
      headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Authorization,Content-Type');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET,POST,OPTIONS');
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  }
  for (const origin of ['https://evil.example', `${ORIGIN}.evil.example`, null, 'null']) {
    const response = await call(env, { method: 'OPTIONS', origin, token: null });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal((await call(env, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  assert.equal((await call(env, { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'X-Other' } })).status, 403);
});

test('invalid origin configuration grants no access; non-browser authenticated requests work', async () => {
  const env = environment({ ALLOWED_ORIGINS: '*,https://demo.example.com/,https://user:pass@demo.example.com,broken' });
  assert.equal((await call(env)).status, 403);
  assert.equal((await call(env, { origin: null })).status, 200);
  assert.equal((await call(environment(), { origin: 'https://evil.example', method: 'POST', token: WRITE, body: event() })).status, 403);
  assert.equal((await call(environment({ ALLOWED_ORIGINS: '' }), { origin: ORIGIN })).status, 403);
});

test('read and write tokens have independent permissions and Bearer syntax is required', async () => {
  const env = environment();
  assert.equal((await call(env)).status, 200);
  for (const token of [null, '', 'wrong', WRITE]) assert.equal((await call(env, { token })).status, 401);
  for (const token of [null, '', 'wrong', READ]) assert.equal((await call(env, { method: 'POST', token, body: event() })).status, 401);
  assert.equal((await call(env, { method: 'POST', token: WRITE, body: event() })).status, 201);
  const bare = request({ token: null });
  bare.headers.set('Authorization', READ);
  assert.equal((await worker.fetch(bare, env)).status, 401);
  const denied = await call(env, { token: null });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(denied.headers.get('Cache-Control'), 'no-store');
});

test('unconfigured or reused secrets fail closed; health contains no records or credentials', async () => {
  for (const overrides of [
    { QH_READ_TOKEN: undefined }, { QH_WRITE_TOKEN: 'short' }, { QH_EVENTS: undefined },
    { QH_WRITE_TOKEN: READ }, { QH_READ_TOKEN: 'REPLACE_WITH_A_RANDOM_READ_TOKEN' },
  ]) assert.equal((await call(environment(overrides))).status, 503);
  const health = await call(environment({ QH_EVENTS: undefined }), { path: '/health', token: null });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: 'qingheng-sync-rest' });
});

test('valid event payloads remain raw and unknown nutrition remains null or absent', async () => {
  const env = environment();
  const original = event({ payload: {
    weight: null, activity: 0, calorieOverride: null, poop: 'unspecified', noteAppend: '示例备注',
    mealOverrides: { breakfast: null, dinner: 520 }, removeEntryIds: ['earlier-entry'],
    entries: [{ id: 'meal-1', name: '示例食物', meal: 'lunch', amount: 1, unit: '份', custom: true, kcal: null, protein: 0 }],
  } });
  assert.equal((await call(env, { method: 'POST', token: WRITE, body: original })).status, 201);
  assert.equal(env.QH_EVENTS.values.get('v1/2026-10-18/test-000001'), JSON.stringify(original));
  const output = await (await call(env)).json();
  assert.deepEqual(output.events, [original]);
  assert.equal(output.events[0].payload.entries[0].kcal, null);
  assert.equal(Object.hasOwn(output.events[0].payload.entries[0], 'fat'), false);
});

test('invalid dates, identifiers, ranges and food entries are rejected without writing', async () => {
  const env = environment();
  const invalid = [
    null, [], event({ id: 'short' }), event({ id: '../bad-id' }), event({ date: '2026-02-30' }),
    event({ type: 'day.delete' }), event({ payload: {} }), event({ payload: [] }),
    event({ payload: { weight: 19 } }), event({ payload: { weight: '70' } }),
    event({ payload: { activity: -1 } }), event({ payload: { calorieOverride: 30001 } }),
    event({ payload: { poop: 'other' } }), event({ payload: { noteAppend: 'a'.repeat(301) } }),
    event({ payload: { removeEntryIds: [123] } }), event({ payload: { entries: Array(51).fill({}) } }),
    event({ payload: { mealOverrides: { dessert: 1 } } }),
    event({ payload: { entries: [{ id: 'meal-1', name: '示例', meal: 'lunch', amount: 0, unit: '份' }] } }),
    event({ payload: { entries: [{ id: 'meal-1', name: '示例', meal: 'lunch', amount: 1, unit: '份', custom: true, kcal: -1 }] } }),
  ];
  for (const body of invalid) assert.equal((await call(env, { method: 'POST', token: WRITE, body: JSON.stringify(body) })).status, 400, JSON.stringify(body));
  assert.equal(env.QH_EVENTS.values.size, 0);
});

test('malformed JSON and oversized bodies return 400/413 before storage', async () => {
  const env = environment();
  assert.equal((await call(env, { method: 'POST', token: WRITE, body: '{broken' })).status, 400);
  assert.equal((await call(env, { method: 'POST', token: WRITE, body: ' '.repeat(30001) })).status, 413);
  assert.equal((await call(env, { method: 'POST', token: WRITE, body: event(), headers: { 'Content-Length': '30001' } })).status, 413);
  assert.equal(env.QH_EVENTS.values.size, 0);
});

test('sequential append, retry, conflict and correction preserve the original key', async () => {
  const env = environment();
  const first = event();
  const options = { method: 'POST', token: WRITE, body: first };
  const appended = await call(env, options);
  assert.equal(appended.status, 201);
  assert.deepEqual(await appended.json(), { ok: true, duplicate: false, id: first.id });
  const retry = await call(env, options);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { ok: true, duplicate: true, id: first.id });
  assert.equal((await call(env, { ...options, body: event({ payload: { weight: 69 } }) })).status, 409);
  assert.equal((await call(env, { ...options, body: { payload: first.payload, ...first } })).status, 409, 'property order is part of raw JSON equality');
  assert.equal(env.QH_EVENTS.values.get('v1/2026-10-18/test-000001'), JSON.stringify(first));
  assert.equal(env.QH_EVENTS.puts.length, 1);
  assert.equal((await call(env, { ...options, body: event({ id: 'test-000002', payload: { weight: 69 } }) })).status, 201);
  assert.equal(env.QH_EVENTS.values.size, 2);
});

test('GET paginates by v1 key and cursor without leaking unrelated KV values', async () => {
  const env = environment();
  for (let index = 0; index < 105; index++) {
    const item = event({ id: `test-${String(index).padStart(6, '0')}` });
    env.QH_EVENTS.values.set(`v1/${item.date}/${item.id}`, JSON.stringify(item));
  }
  env.QH_EVENTS.values.set('unrelated/private', JSON.stringify({ secret: 'test-only' }));
  const first = await (await call(env)).json();
  assert.equal(first.events.length, 100);
  assert.equal(first.hasMore, true);
  assert.equal(typeof first.cursor, 'string');
  assert.deepEqual(env.QH_EVENTS.lists[0], { prefix: 'v1/', limit: 100 });
  const second = await (await call(env, { path: `/v1/events?cursor=${encodeURIComponent(first.cursor)}` })).json();
  assert.equal(second.events.length, 5);
  assert.equal(second.hasMore, false);
  assert.equal(second.cursor, null);
  assert.equal(new Set([...first.events, ...second.events].map(value => value.id)).size, 105);
  assert.equal(second.events.at(-1).id, 'test-000104');
});

test('empty pages, invalid cursors and KV list failures return explicit outcomes', async () => {
  const env = environment();
  assert.deepEqual(await (await call(env)).json(), { ok: true, events: [], hasMore: false, cursor: null });
  assert.equal((await call(env, { path: `/v1/events?cursor=${'a'.repeat(1001)}` })).status, 400);
  assert.equal((await call(env, { path: '/v1/events?cursor=not-a-valid-mock-cursor' })).status, 503);
  env.QH_EVENTS.list = async () => { throw new Error('KV unavailable'); };
  assert.equal((await call(env)).status, 503);
});

test('unknown paths and unsupported methods cannot modify stored history', async () => {
  const env = environment();
  assert.equal((await call(env, { method: 'DELETE', token: WRITE })).status, 404);
  assert.equal((await call(env, { path: '/mcp', method: 'POST', token: WRITE, body: {} })).status, 404);
  assert.equal(env.QH_EVENTS.puts.length, 0);
});
