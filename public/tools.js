'use strict';
// 他們自己會用的工具：網路搜尋、生圖（Nano Banana、GPT Image 或 Qwen）。Key 在設定「共用的 Key」裡，大家共用
// 這些服務多半不讓網頁直接連，App 版走原生 HTTP；網頁版可能連不上

function toolCfg() {
  return (saved.tools ||= {
    searchProvider: 'tavily',
    searchKey: '',
    qwenKey: '',
    qwenRegion: 'cn',
    qwenModel: 'qwen-image',
    visionModel: 'qwen-vl-max',
    imageProvider: 'qwen',
    geminiKey: '',
    geminiImageModel: 'gemini-2.5-flash-image',
    gptImageBase: 'https://api.openai.com/v1',
    gptImageKey: '',
    gptImageModel: 'gpt-image-2',
  });
}

// 原生 HTTP（App 版不受跨網域限制），網頁版退回 fetch
async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.CapacitorHttp;
  if (http) {
    const r = await http.request({
      url,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      data: body,
    });
    const data = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data;
    return { status: r.status, data };
  }
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function httpDataUrl(url) {
  const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.CapacitorHttp;
  if (http) {
    const r = await http.request({ url, method: 'GET', responseType: 'blob' });
    return `data:image/png;base64,${r.data}`;
  }
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ─── 搜尋 ─────────────────────────────────────
async function webSearch(query) {
  const t = toolCfg();
  if (!t.searchKey) throw new Error('還沒填搜尋的 Key');
  if (t.searchProvider === 'bocha') {
    const { status, data } = await httpJson('https://api.bochaai.com/v1/web-search', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t.searchKey },
      body: { query, summary: true, count: 5 },
    });
    if (status >= 400) throw new Error(data.message || `搜尋失敗 HTTP ${status}`);
    const items = data.data?.webPages?.value || [];
    return (
      items.map((x) => `${x.name}\n${x.summary || x.snippet || ''}\n${x.url}`).join('\n\n') || '沒有找到結果'
    );
  }
  const { status, data } = await httpJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t.searchKey },
    body: { query, max_results: 5, include_answer: true },
  });
  if (status >= 400) throw new Error(data.detail?.error || data.error || `搜尋失敗 HTTP ${status}`);
  return (
    [data.answer, ...(data.results || []).map((x) => `${x.title}\n${x.content}\n${x.url}`)]
      .filter(Boolean)
      .join('\n\n') || '沒有找到結果'
  );
}

// ─── Qwen 生圖（阿里雲百煉 DashScope，非同步任務） ─────
async function qwenImage(prompt) {
  const t = toolCfg();
  if (!t.qwenKey) throw new Error('還沒填百煉（DashScope）的 Key');
  const host =
    t.qwenRegion === 'intl' ? 'https://dashscope-intl.aliyuncs.com' : 'https://dashscope.aliyuncs.com';
  const headers = { Authorization: 'Bearer ' + t.qwenKey };
  const start = await httpJson(`${host}/api/v1/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: { ...headers, 'X-DashScope-Async': 'enable' },
    body: { model: t.qwenModel || 'qwen-image', input: { prompt }, parameters: { size: '1328*1328', n: 1 } },
  });
  if (start.status >= 400) throw new Error(start.data.message || `生圖失敗 HTTP ${start.status}`);
  const taskId = start.data.output?.task_id;
  if (!taskId) throw new Error('生圖沒有拿到任務編號');
  // 每 3 秒問一次，最多等兩分鐘
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data } = await httpJson(`${host}/api/v1/tasks/${taskId}`, { headers });
    const status = data.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = data.output.results?.[0]?.url;
      if (!url) throw new Error('生圖成功但沒有圖片網址');
      return shrinkImage(await httpDataUrl(url));
    }
    if (status === 'FAILED' || status === 'CANCELED') throw new Error(data.output?.message || '生圖失敗');
  }
  throw new Error('生圖等太久了，晚點再試');
}
// ─── Nano Banana（Google Gemini 生圖）。Key 沒填就用「聽語氣」那把 Gemini Key ─────
function geminiImageKey() {
  return toolCfg().geminiKey || saved.callShared?.toneKey || '';
}
async function geminiImage(prompt) {
  const t = toolCfg(),
    key = geminiImageKey();
  if (!key) throw new Error('還沒填 Gemini 的 Key');
  const model = t.geminiImageModel || 'gemini-2.5-flash-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `生圖失敗 HTTP ${res.status}`);
  const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  const img = part?.inlineData || part?.inline_data;
  if (!img?.data) throw new Error(data.candidates?.[0]?.finishReason ? `沒有畫出來（${data.candidates[0].finishReason}）` : '沒有拿到圖片');
  return shrinkImage(`data:${img.mimeType || img.mime_type || 'image/png'};base64,${img.data}`);
}
// ─── GPT Image（OpenAI 的 /images/generations，也可以填相容的轉發網址） ─────
async function gptImage(prompt) {
  const t = toolCfg();
  if (!t.gptImageKey) throw new Error('還沒填 OpenAI 的 Key');
  const base = (t.gptImageBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(base + '/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.gptImageKey },
    body: JSON.stringify({ model: t.gptImageModel || 'gpt-image-2', prompt, size: '1024x1024', n: 1 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `生圖失敗 HTTP ${res.status}`);
  const item = data.data?.[0];
  if (item?.b64_json) return shrinkImage('data:image/png;base64,' + item.b64_json);
  if (item?.url) return shrinkImage(await httpDataUrl(item.url));
  throw new Error('沒有拿到圖片');
}
// 用哪家畫：照設定選的；選的那家沒 Key，就換一家有 Key 的
const IMAGE_MAKERS = {
  gemini: { ready: () => !!geminiImageKey(), run: (p) => geminiImage(p) },
  gpt: { ready: () => !!toolCfg().gptImageKey, run: (p) => gptImage(p) },
  qwen: { ready: () => !!toolCfg().qwenKey, run: (p) => qwenImage(p) },
};
function imageReady() {
  return Object.values(IMAGE_MAKERS).some((m) => m.ready());
}
function makeImage(prompt) {
  const pick = IMAGE_MAKERS[toolCfg().imageProvider];
  const maker = pick?.ready() ? pick : Object.values(IMAGE_MAKERS).find((m) => m.ready()) || IMAGE_MAKERS.qwen;
  return maker.run(prompt);
}
// 存進手機前縮小，圖片網址 24 小時後會失效，所以一定要存下來
async function shrinkImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

// ─── 交給模型的工具 ───────────────────────────
function builtinToolSpecs() {
  const t = toolCfg(),
    specs = [];
  if (t.searchKey)
    specs.push({
      type: 'function',
      function: {
        name: 'web_search',
        description: '上網搜尋最新資訊（新聞、天氣、店家、知識）。',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '要搜尋的內容' } },
          required: ['query'],
        },
      },
    });
  if (imageReady())
    specs.push({
      type: 'function',
      function: {
        name: 'generate_image',
        description: '畫一張圖傳給她。prompt 用詳細的畫面描述。',
        parameters: {
          type: 'object',
          properties: { prompt: { type: 'string', description: '畫面描述' } },
          required: ['prompt'],
        },
      },
    });
  return specs;
}
async function runBuiltinTool(id, name, args, ctx) {
  if (name === 'web_search') return webSearch(String(args.query || ''));
  if (name === 'generate_image') {
    if (!ctx?.room) return '這裡不能傳圖片';
    showTyping(ctx.room, id);
    try {
      const image = await makeImage(String(args.prompt || ''));
      addMessage(ctx.room, { from: id, text: `[圖片] ${args.prompt}`, image, at: Date.now() });
      return '圖片已經傳給她了，接著自然地說一兩句就好，不用描述圖片網址。';
    } finally {
      hideTyping(ctx.room, id);
    }
  }
  return null; // 不是內建工具
}

// ─── 翻譯（給她用：點泡泡） ─────────────────────
function translator() {
  return memberIds().find(
    (id) => saved.personas[id].conn.mode === 'api' && connReady(saved.personas[id].conn),
  );
}
async function translateText(text) {
  const id = translator();
  if (!id) throw new Error('要先有一個用直接 API 的角色才能翻譯');
  return askApi(
    saved.personas[id].conn,
    '你是翻譯。原文是中文就翻成英文，其他語言一律翻成繁體中文。只回譯文，不要解釋。',
    [{ role: 'user', content: text }],
  );
}
let menuMessage = null;
function openMessageMenu(room, index) {
  const m = saved['msgs:' + room]?.[index];
  if (!m) return;
  menuMessage = m;
  openSheet(
    m.image ? '圖片' : '這則訊息',
    `${m.image ? `<img src="${m.image}" alt="" style="width:100%;border-radius:12px">` : `<p class="msg-preview">${escapeHTML(m.text)}</p>`}<div class="sheet-grid">${m.image ? `<button data-action="msg-save-album">${icon('camera')}存進相簿</button>` : `<button data-action="msg-translate">翻譯</button>`}<button data-action="msg-copy">複製文字</button></div><p id="msg-translation" class="msg-translation"></p>`,
  );
}
async function translateMenuMessage() {
  const out = document.querySelector('#msg-translation');
  out.textContent = '翻譯中…';
  try {
    out.textContent = await translateText(menuMessage.text);
  } catch (e) {
    out.textContent = '翻譯失敗：' + e.message;
  }
}

// ─── 設定（在「共用的 Key」裡） ─────────────────
function toolFields() {
  const t = toolCfg();
  const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  return `<details class="api-config-section api-fold"><summary><h3>網路搜尋（選填）</h3>${icon('chevron')}</summary><label class="field">搜尋服務<select id="tool-searchProvider" class="form-input">${opt('tavily', 'Tavily（海外，有免費額度）', t.searchProvider)}${opt('bocha', '博查（大陸可直連）', t.searchProvider)}</select></label>${field('tool-searchKey', 'API Key', t.searchKey, 'password')}</details>
<details class="api-config-section api-fold"><summary><h3>生圖・識圖（選填）</h3>${icon('chevron')}</summary><label class="field">生圖用哪家<select id="tool-imageProvider" class="form-input">${opt('gemini', 'Nano Banana（Google Gemini）', t.imageProvider)}${opt('gpt', 'GPT Image（OpenAI）', t.imageProvider)}${opt('qwen', 'Qwen（阿里雲百煉）', t.imageProvider)}</select></label><h4>Nano Banana：Google Gemini</h4><p class="sheet-note">Key 跟「聽語氣」同一把，那邊填過這裡可以留空。每張圖會從 AI Studio 的額度扣一點錢。模型名稱 Google 常改，畫不出來就換成 AI Studio 上看到的生圖模型。</p>${field('tool-geminiKey', 'Gemini API Key（留空用聽語氣那把）', t.geminiKey, 'password')}${field('tool-geminiImageModel', '生圖模型', t.geminiImageModel, 'text', 'gemini-2.5-flash-image')}<h4>GPT Image：OpenAI</h4><p class="sheet-note">OpenAI 的生圖模型可能要先在後台完成組織驗證才能用。用轉發站的話，Base URL 換成轉發站的網址。</p>${field('tool-gptImageBase', 'Base URL', t.gptImageBase, 'url', 'https://api.openai.com/v1')}${field('tool-gptImageKey', 'API Key', t.gptImageKey, 'password')}${field('tool-gptImageModel', '生圖模型', t.gptImageModel, 'text', 'gpt-image-2')}<h4>Qwen：阿里雲百煉 DashScope</h4><p class="sheet-note">生圖要另外接百煉的 Key，跟聊天用的 API 分開。同一把 Key 也拿來幫看不懂圖的模型（例如 DeepSeek）看照片。</p><label class="field">地區<select id="tool-qwenRegion" class="form-input">${opt('cn', '中國大陸（北京）', t.qwenRegion)}${opt('intl', '國際（新加坡）', t.qwenRegion)}</select></label>${field('tool-qwenKey', 'API Key', t.qwenKey, 'password')}${field('tool-qwenModel', '生圖模型', t.qwenModel, 'text', 'qwen-image')}${field('tool-visionModel', '識圖模型', t.visionModel || 'qwen-vl-max', 'text', 'qwen-vl-max')}<p class="sheet-note">填好之後，直接 API 的他聊天時就會自己搜尋、自己畫圖、看妳傳的照片。App 版才連得上，網頁版可能被擋。</p></details>`;
}
function saveToolFields() {
  const t = toolCfg();
  for (const k of ['searchProvider', 'searchKey', 'qwenKey', 'qwenRegion', 'qwenModel', 'visionModel', 'imageProvider', 'geminiKey', 'geminiImageModel', 'gptImageBase', 'gptImageKey', 'gptImageModel'])
    t[k] = document.querySelector('#tool-' + k).value.trim();
  save('tools');
}
