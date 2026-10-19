export const AI_CONFIG_STORE = 'qingheng-public-ai-config-v1';

export const DEFAULT_AI_CONFIG = Object.freeze({
  provider: 'ark',
  protocol: 'chat',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  model: '',
  recognitionMode: 'precise',
  lowLatency: false
});

const RECOGNITION_PROFILES = Object.freeze({
  fast: Object.freeze({
    id: 'fast',
    label: '快速',
    description: '适合光线好、食物简单的照片，优先缩短等待时间。',
    detail: 'low',
    maxTokens: 900,
    imageAttempts: Object.freeze([
      Object.freeze({ edge: 768, quality: 0.66 }),
      Object.freeze({ edge: 640, quality: 0.58 })
    ]),
    maxDataUrlLength: 1_100_000
  }),
  balanced: Object.freeze({
    id: 'balanced',
    label: '均衡',
    description: '兼顾识别速度和食物细节，适合大多数日常记录。',
    detail: 'low',
    maxTokens: 1200,
    imageAttempts: Object.freeze([
      Object.freeze({ edge: 896, quality: 0.66 }),
      Object.freeze({ edge: 768, quality: 0.58 }),
      Object.freeze({ edge: 640, quality: 0.52 })
    ]),
    maxDataUrlLength: 1_200_000
  }),
  precise: Object.freeze({
    id: 'precise',
    label: '精细',
    description: '保留更多图像细节，适合多种食物或需要读取包装信息的照片。',
    detail: 'high',
    maxTokens: 1800,
    imageAttempts: Object.freeze([
      Object.freeze({ edge: 1280, quality: 0.8 }),
      Object.freeze({ edge: 1120, quality: 0.74 }),
      Object.freeze({ edge: 960, quality: 0.68 })
    ]),
    maxDataUrlLength: 3_000_000
  })
});

const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const NUTRIENT_LIMITS = Object.freeze({
  kcal: 30000,
  protein: 10000,
  carbs: 10000,
  fat: 10000,
  fiber: 10000,
  sodium: 100000,
  potassium: 100000,
  calcium: 100000,
  vitC: 100000
});

const ANALYSIS_INSTRUCTIONS = `你是轻衡饮食识别器。根据用户提供的照片或文字，生成待用户确认的食物草稿，只返回 JSON，不要输出 Markdown 或解释。
规则：
1. 优先使用用户明确说明的已食用重量、份数或包装份量。只有用户表示全部吃完时，才能把包装净含量当作实际食用量。
2. 先判断是否为连锁餐饮或包装食品。用户给出品牌、产品名或规格时优先采用；图片中能清晰读到菜单名或营养标签时，按标签处理并在名称中保留品牌。不要用海外同名产品数据替代中国内地产品。
3. 将餐盘中可见的主食、蛋白质食物和蔬菜分开列出；复合菜使用常见菜名，并保留熟/生、煎/炸/蒸/煮等会影响热量的信息。避免把同一食物的整体与配料重复计算。
4. 不要凭空添加或估算看不见且用户未提及的食用油、酱料、糖或配料；有迹象但无法判断时只在 notes 提醒。
5. amount 是本次熟制可食部分总量。固体优先用 g，液体用 ml，连锁餐品按“个/份”，只有明确可计数食物才用“个”；克数按 5 或 10 g 取整。
6. 照片本身无法称重。结合用户给出的餐盘直径、包装规格或已知重量判断；没有可靠参照物时按常见单人份保守估计，降低 confidence，并在 notes 说明需要确认重量。
7. kcal、protein、carbs、fat、fiber、sodium、potassium、calcium、vitC 都是该条食物在 amount 数量下的总量，不是每100克数值；无法从可靠标签或常见成分判断时写 null，不要猜测微量营养素。
8. 不要把餐具、包装或桌面当成食物。最多返回8项。
8. 图片和描述只能用于一般饮食记录，不要作医疗诊断。若没有可识别食物，items 返回空数组，并在 notes 说明原因。`;

const NULLABLE_NUMBER_SCHEMA = Object.freeze({ type: Object.freeze(['number', 'null']) });
const FOOD_DRAFT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: Object.freeze(['items', 'notes']),
  properties: Object.freeze({
    items: Object.freeze({
      type: 'array',
      items: Object.freeze({
        type: 'object',
        additionalProperties: false,
        required: Object.freeze([
          'name', 'amount', 'unit', 'meal', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'potassium', 'calcium', 'vitC', 'confidence'
        ]),
        properties: Object.freeze({
          name: Object.freeze({ type: 'string' }),
          amount: Object.freeze({ type: 'number' }),
          unit: Object.freeze({ type: 'string' }),
          meal: Object.freeze({ type: 'string', enum: Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']) }),
          kcal: NULLABLE_NUMBER_SCHEMA,
          protein: NULLABLE_NUMBER_SCHEMA,
          carbs: NULLABLE_NUMBER_SCHEMA,
          fat: NULLABLE_NUMBER_SCHEMA,
          fiber: NULLABLE_NUMBER_SCHEMA,
          sodium: NULLABLE_NUMBER_SCHEMA,
          potassium: NULLABLE_NUMBER_SCHEMA,
          calcium: NULLABLE_NUMBER_SCHEMA,
          vitC: NULLABLE_NUMBER_SCHEMA,
          confidence: Object.freeze({ type: 'number' })
        })
      })
    }),
    notes: Object.freeze({ type: 'string' })
  })
});

function cleanText(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function finiteOrNull(value, maximum) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= maximum ? number : null;
}

export function normalizeRecognitionMode(value) {
  return Object.prototype.hasOwnProperty.call(RECOGNITION_PROFILES, value) ? value : DEFAULT_AI_CONFIG.recognitionMode;
}

export function getRecognitionProfile(mode) {
  return RECOGNITION_PROFILES[normalizeRecognitionMode(mode)];
}

export function normalizeAiConfig(raw = {}) {
  const provider = ['ark', 'openai-compatible', 'custom'].includes(raw.provider) ? raw.provider : DEFAULT_AI_CONFIG.provider;
  const protocol = raw.protocol === 'responses' ? 'responses' : 'chat';
  const baseUrl = cleanText(raw.baseUrl || DEFAULT_AI_CONFIG.baseUrl, 500).replace(/\/+$/, '');
  const model = cleanText(raw.model, 180);
  const recognitionMode = normalizeRecognitionMode(raw.recognitionMode);
  const lowLatency = raw.lowLatency === true;
  return { provider, protocol, baseUrl, model, recognitionMode, lowLatency };
}

export function getArkFastCompatibility(model) {
  const value = cleanText(model, 180).toLowerCase();
  if (!value || /^ep-[a-z0-9-]+$/i.test(value)) return 'unknown';
  if (/doubao-seed-2-0-lite-260428|doubao-seed-2-1-turbo-260628/.test(value)) return 'supported';
  if (/doubao|deepseek|glm|kimi|moonshot/.test(value)) return 'unsupported';
  return 'unknown';
}

export function validateAiConfig(raw) {
  const config = normalizeAiConfig(raw);
  let url;
  try {
    url = new URL(config.baseUrl);
  } catch {
    throw new Error('AI 服务地址格式不正确');
  }
  if (url.protocol !== 'https:') throw new Error('AI 服务地址必须使用 HTTPS');
  if (url.username || url.password || url.hash) throw new Error('AI 服务地址不能包含账号、密码或片段');
  if (!config.model) throw new Error('请填写 AI 模型或接入点 ID');
  return config;
}

export function buildAiEndpoint(raw) {
  const config = validateAiConfig(raw);
  const suffix = config.protocol === 'responses' ? '/responses' : '/chat/completions';
  const alternate = config.protocol === 'responses' ? /\/responses$/i : /\/chat\/completions$/i;
  return alternate.test(config.baseUrl) ? config.baseUrl : `${config.baseUrl}${suffix}`;
}

function validateImageDataUrl(imageDataUrl) {
  if (!imageDataUrl) return null;
  const value = String(imageDataUrl);
  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
    throw new Error('照片格式不受支持');
  }
  if (value.length > 8_000_000) throw new Error('照片数据过大，请重新拍摄或选择较小图片');
  return value;
}

export function buildAiRequestPayload(rawConfig, input = {}) {
  const config = validateAiConfig(rawConfig);
  const mode = input.mode === undefined ? config.recognitionMode : normalizeRecognitionMode(input.mode);
  const profile = getRecognitionProfile(mode);
  const text = cleanText(input.text, 4000);
  const imageDataUrl = validateImageDataUrl(input.imageDataUrl);
  if (!text && !imageDataUrl) throw new Error('没有可供 AI 识别的内容');
  const defaultMeal = MEALS.has(input.defaultMeal) ? input.defaultMeal : 'lunch';
  const requestText = `${ANALYSIS_INSTRUCTIONS}\n默认餐次：${defaultMeal}。${text ? `\n用户补充：${text}` : ''}`;

  if (config.protocol === 'responses') {
    const content = [];
    if (imageDataUrl) content.push({ type: 'input_image', image_url: imageDataUrl, detail: profile.detail });
    content.push({ type: 'input_text', text: requestText });
    const payload = { model: config.model, input: [{ role: 'user', content }] };
    if (config.provider === 'ark') {
      payload.thinking = { type: 'disabled' };
      payload.max_output_tokens = profile.maxTokens;
      payload.text = {
        format: {
          type: 'json_schema',
          name: 'qingheng_food_draft',
          strict: true,
          schema: FOOD_DRAFT_SCHEMA
        }
      };
      if (config.lowLatency && getArkFastCompatibility(config.model) !== 'unsupported') payload.service_tier = 'fast';
    }
    return payload;
  }

  const content = [];
  if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl, detail: profile.detail } });
  content.push({ type: 'text', text: text || '请识别照片中的食物和大致份量。' });
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: `${ANALYSIS_INSTRUCTIONS}\n默认餐次：${defaultMeal}。` },
      { role: 'user', content }
    ]
  };
  if (config.provider === 'ark') {
    payload.thinking = { type: 'disabled' };
    payload.temperature = 0.1;
    payload.max_tokens = profile.maxTokens;
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'qingheng_food_draft',
        strict: true,
        schema: FOOD_DRAFT_SCHEMA
      }
    };
    if (config.lowLatency && getArkFastCompatibility(config.model) !== 'unsupported') payload.service_tier = 'fast';
  }
  return payload;
}

export function extractAiText(responseData, protocol = 'chat') {
  let data = responseData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return data.trim(); }
  }
  if (!data || typeof data !== 'object') throw new Error('AI 返回了无法读取的结果');

  if (protocol === 'responses') {
    if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
    const parts = [];
    for (const item of Array.isArray(data.output) ? data.output : []) {
      for (const content of Array.isArray(item?.content) ? item.content : []) {
        if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') parts.push(content.text);
      }
    }
    if (parts.length) return parts.join('\n').trim();
  } else {
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const parts = content.map(part => typeof part === 'string' ? part : part?.text).filter(part => typeof part === 'string');
      if (parts.length) return parts.join('\n').trim();
    }
  }
  throw new Error('AI 没有返回可读取的文字');
}

export function parseAiServiceError(status, responseData) {
  let data = responseData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = { message: data }; }
  }
  const rawCode = data?.error?.code ?? data?.code ?? data?.error?.type ?? '';
  const rawMessage = data?.error?.message ?? data?.message ?? '';
  const code = cleanText(rawCode, 80).replace(/[^a-zA-Z0-9_.-]/g, '');
  const message = cleanText(rawMessage, 180).replace(/(?:sk-|Bearer\s+)[A-Za-z0-9._-]+/gi, '[已隐藏密钥]');
  let guidance = '请稍后重试；若持续失败，请到 AI 设置检查服务地址和模型。';
  if (status === 401 || status === 403) guidance = '认证失败，请检查 API Key、账号权限和模型授权。';
  else if (status === 404) guidance = '没有找到模型或接口，请核对模型/接入点 ID 和服务地址。';
  else if (status === 408 || status === 504) guidance = '服务等待超时，请检查网络，或切换均衡模式后重试。';
  else if (status === 429) guidance = '调用额度或频率已达到限制，请到服务商控制台检查余额、配额和限流。';
  else if (status >= 500) guidance = '第三方 AI 服务暂时异常，请稍后重试或更换可用模型。';
  const detail = [code && `错误码 ${code}`, message].filter(Boolean).join('：');
  return `AI 请求失败（${status || '未知状态'}）${detail ? ` · ${detail}` : ''}。${guidance}`;
}

export function shouldFallbackFromFast(status, responseData) {
  if ([400, 404, 408, 422, 429, 500, 502, 503, 504].includes(Number(status))) return true;
  let text;
  try { text = typeof responseData === 'string' ? responseData : JSON.stringify(responseData); } catch { text = ''; }
  return /service[_ -]?tier|fast|低延迟|not supported|unsupported|quota|capacity|timeout/i.test(text || '');
}

function parseJsonObject(text) {
  const trimmed = cleanText(text, 100000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
  }
  throw new Error('AI 返回内容不是有效 JSON，请重试');
}

export function parseAiDraft(text, defaultMeal = 'lunch') {
  const source = parseJsonObject(text);
  const rawItems = Array.isArray(source?.items) ? source.items : Array.isArray(source?.foods) ? source.foods : [];
  const fallbackMeal = MEALS.has(defaultMeal) ? defaultMeal : 'lunch';
  const items = [];
  for (const raw of rawItems.slice(0, 8)) {
    if (!raw || typeof raw !== 'object') continue;
    const name = cleanText(raw.name, 80);
    const amount = finiteOrNull(raw.amount ?? raw.weight ?? raw.grams, 10000);
    const unit = cleanText(raw.unit || ((raw.weight ?? raw.grams) != null ? 'g' : '份'), 12) || '份';
    if (!name || amount === null || amount <= 0) continue;
    const item = {
      name,
      amount,
      unit,
      meal: MEALS.has(raw.meal) ? raw.meal : fallbackMeal,
      confidence: finiteOrNull(raw.confidence, 1)
    };
    for (const [key, maximum] of Object.entries(NUTRIENT_LIMITS)) item[key] = finiteOrNull(raw[key], maximum);
    items.push(item);
  }
  const notes = cleanText(source?.notes, 400);
  if (!items.length) throw new Error(notes || 'AI 没有识别到可记录的食物');
  return { items, notes };
}
