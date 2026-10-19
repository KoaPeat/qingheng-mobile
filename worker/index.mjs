/**
 * Optional personal Qingheng event inbox, deployed to your own Cloudflare account.
 * QH_EVENTS: a dedicated KV namespace. Tokens are separate Worker secrets.
 * No personal deployment, records or credentials are included in this template.
 */
const RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  vary: 'Origin',
};
const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

function allowedOrigins(value) {
  const origins = new Set();
  for (const candidate of String(value || '').split(',').map(value => value.trim()).filter(Boolean)) {
    try {
      const url = new URL(candidate);
      // Exact origins only: no wildcards, paths, credentials or trailing slash.
      if (url.origin === candidate && ['http:', 'https:'].includes(url.protocol)) origins.add(candidate);
    } catch { /* An invalid configuration entry never grants browser access. */ }
  }
  return origins;
}

function json(body, status, origin, origins) {
  const headers = { ...RESPONSE_HEADERS };
  if (origins.has(origin)) headers['access-control-allow-origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function bearerToken(request) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') || '');
  return match ? match[1] : '';
}

const real = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isDate = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

function validEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)
    || typeof event.id !== 'string' || !/^[A-Za-z0-9_.-]{6,110}$/.test(event.id)
    || !isDate(event.date) || event.type !== 'day.patch'
    || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return false;
  const payload = event.payload;
  if (JSON.stringify(payload).length > 20000 || !Object.keys(payload).length) return false;
  if (payload.entries !== undefined && (!Array.isArray(payload.entries) || payload.entries.length > 50)) return false;
  if (payload.removeEntryIds !== undefined && (!Array.isArray(payload.removeEntryIds)
    || payload.removeEntryIds.length > 50
    || payload.removeEntryIds.some(value => typeof value !== 'string' || value.length > 130))) return false;
  for (const [key, min, max] of [['weight', 20, 400], ['activity', 0, 10000], ['calorieOverride', 0, 30000]]) {
    if (payload[key] !== undefined && payload[key] !== null && !real(payload[key], min, max)) return false;
  }
  if (payload.poop !== undefined && !['before', 'after', 'unspecified'].includes(payload.poop)) return false;
  if (payload.noteAppend !== undefined && (typeof payload.noteAppend !== 'string' || payload.noteAppend.length > 300)) return false;
  if (payload.mealOverrides !== undefined) {
    if (!payload.mealOverrides || typeof payload.mealOverrides !== 'object' || Array.isArray(payload.mealOverrides)) return false;
    for (const [key, value] of Object.entries(payload.mealOverrides)) {
      if (!MEALS.has(key) || (value !== null && !real(value, 0, 30000))) return false;
    }
  }
  for (const entry of payload.entries || []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.id !== 'string' || entry.id.length < 1 || entry.id.length > 130
      || typeof entry.name !== 'string' || entry.name.length < 1 || entry.name.length > 180
      || !MEALS.has(entry.meal) || !real(entry.amount, 0.01, 10000)
      || typeof entry.unit !== 'string' || !entry.unit || entry.unit.length > 20) return false;
    if (entry.foodId !== undefined && (typeof entry.foodId !== 'string' || entry.foodId.length > 80)) return false;
    if (entry.custom) {
      for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'potassium', 'calcium', 'vitC']) {
        if (entry[key] !== undefined && entry[key] !== null && !real(entry[key], 0, 100000)) return false;
      }
    }
  }
  return true;
}

function configured(env) {
  const strong = value => typeof value === 'string' && value.length >= 24 && !value.startsWith('REPLACE_');
  return env.QH_EVENTS && strong(env.QH_READ_TOKEN) && strong(env.QH_WRITE_TOKEN)
    && env.QH_READ_TOKEN !== env.QH_WRITE_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const origins = allowedOrigins(env.ALLOWED_ORIGINS);
    const reply = (body, status = 200) => json(body, status, origin, origins);
    const fail = (error, status) => reply({ ok: false, error }, status);

    if (request.method === 'OPTIONS') {
      if (!origins.has(origin)) return fail('来源未获允许', 403);
      const method = request.headers.get('access-control-request-method');
      const headers = (request.headers.get('access-control-request-headers') || '')
        .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if ((method && !['GET', 'POST'].includes(method))
        || headers.some(value => !['authorization', 'content-type'].includes(value))) return fail('预检请求未获允许', 403);
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'Authorization,Content-Type',
          'access-control-max-age': '600',
          'cache-control': 'no-store',
          vary: 'Origin',
        },
      });
    }

    // No Origin header is normal for authenticated server-to-server requests.
    if (origin && !origins.has(origin)) return fail('来源未获允许', 403);
    if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true, service: 'qingheng-sync-rest' });
    if (!configured(env)) return fail('服务未正确配置：需要 KV 和不同的强密钥', 503);

    if (url.pathname === '/v1/events' && request.method === 'POST') {
      if (bearerToken(request) !== env.QH_WRITE_TOKEN) return fail('未授权写入', 401);
      if (Number(request.headers.get('content-length') || 0) > 30000) return fail('事件过大', 413);
      const body = await request.text();
      if (body.length > 30000) return fail('事件过大', 413);
      let event;
      try { event = JSON.parse(body); } catch { return fail('请求不是有效 JSON', 400); }
      if (!validEvent(event)) return fail('事件结构无效', 400);
      const key = `v1/${event.date}/${event.id}`;
      const existing = await env.QH_EVENTS.get(key);
      const payload = JSON.stringify(event);
      // Preserve the original event; corrections always need a new event ID.
      if (existing) return existing === payload
        ? reply({ ok: true, duplicate: true, id: event.id })
        : fail('事件 ID 冲突；更正请使用新事件 ID', 409);
      await env.QH_EVENTS.put(key, payload);
      return reply({ ok: true, duplicate: false, id: event.id }, 201);
    }

    if (url.pathname === '/v1/events' && request.method === 'GET') {
      if (bearerToken(request) !== env.QH_READ_TOKEN) return fail('未授权读取', 401);
      const cursor = url.searchParams.get('cursor') || undefined;
      if (cursor && cursor.length > 1000) return fail('游标错误', 400);
      let list;
      try {
        list = await env.QH_EVENTS.list({ prefix: 'v1/', limit: 100, ...(cursor ? { cursor } : {}) });
      } catch { return fail('事件读取失败', 503); }
      const events = (await Promise.all(list.keys.map(key => env.QH_EVENTS.get(key.name, 'json')))).filter(Boolean);
      return reply({ ok: true, events, hasMore: !list.list_complete, cursor: list.list_complete ? null : list.cursor });
    }
    return fail('没有该接口', 404);
  },
};
