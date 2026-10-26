'use strict';
// 記憶庫：每個角色各自設定，兩種接法
// local：本地 warmup，記憶存在這支手機。聊天時帶給他，他用［記住：…］／［短記：…］自己寫新的
// mcp：外部記憶庫（MCP 網址＋token）。開聊先呼叫它的 warmup，聊天中他也能自己呼叫記憶庫的工具
const SHORT_DAYS = 7;
const REMEMBER = /^[［\[](記住|短記)[：:]\s*(.+?)[］\]]\s*$/gm;

function memoryMode(p) {
  return p.memoryMode || 'local';
}
function liveMemories(p) {
  const cutoff = Date.now() - SHORT_DAYS * DAY;
  return (p.memories || []).filter((m) => m.kind === 'long' || m.at > cutoff);
}

// ─── 外部記憶庫（MCP Streamable HTTP） ────────────
// App 裡用原生 HTTP，不受瀏覽器跨網域限制；網頁版只能連有開 CORS 的記憶庫
// 網頁版代轉用的橋接器：優先用跟這個網頁同一台的，沒有就用任何一個填了橋接密碼的角色
function memoryRelay() {
  const conns = Object.values(saved.personas)
    .map((p) => p.conn)
    .filter((c) => c.relay && c.secret);
  const same = conns.find((c) => c.relay.replace(/\/+$/, '') === location.origin);
  const c = same || conns[0];
  return c && { url: c.relay.replace(/\/+$/, ''), secret: c.secret };
}
async function mcpPost(mem, body, sessionId) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (mem.token) headers.Authorization = 'Bearer ' + mem.token;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.CapacitorHttp;
  let status, text, sid;
  if (http) {
    const r = await http.request({ url: mem.url, method: 'POST', headers, data: body, responseType: 'text' });
    status = r.status;
    text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    sid = r.headers?.['Mcp-Session-Id'] || r.headers?.['mcp-session-id'];
  } else {
    // 網頁版：記憶庫多半不准網頁直接連，交給自己的橋接器代轉
    const relay = memoryRelay();
    const r = relay
      ? await fetch(`${relay.url}/memproxy?u=${encodeURIComponent(mem.url)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: headers.Accept,
            'X-Relay-Secret': relay.secret,
            ...(headers.Authorization ? { 'X-Target-Authorization': headers.Authorization } : {}),
            ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
          },
          body: JSON.stringify(body),
        })
      : await fetch(mem.url, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => ({
          status: 0,
          text: async () => '',
          headers: new Headers(),
        }));
    status = r.status;
    text = await r.text();
    sid = r.headers.get('Mcp-Session-Id');
  }
  if (status === 0) throw new Error('網頁版連不到記憶庫：先在任一角色填好橋接網址和密碼，讓橋接器代轉');
  if (status === 401 || status === 403) throw new Error('記憶庫拒絕連線，token 不對');
  if (status === 404) throw new Error('記憶庫網址不對（HTTP 404），網址結尾通常要有 /mcp');
  if (status >= 400) throw new Error(`記憶庫回了 HTTP ${status}`);
  // 回應可能是 JSON，也可能是 SSE（data: 開頭的一行行）
  const json = text.trim().startsWith('{')
    ? text
    : text
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5))
        .pop();
  const data = json ? JSON.parse(json) : {};
  if (data.error) throw new Error(data.error.message || '記憶庫回報錯誤');
  return { result: data.result, sid };
}
const mcpSessions = {};
async function mcpCall(mem, method, params) {
  const key = mem.url;
  let sid = mcpSessions[key];
  if (sid === undefined) {
    const init = await mcpPost(mem, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'lumeet', version: '2.0' },
      },
    });
    sid = mcpSessions[key] = init.sid || null;
    await mcpPost(mem, { jsonrpc: '2.0', method: 'notifications/initialized' }, sid).catch(() => {});
  }
  try {
    return (await mcpPost(mem, { jsonrpc: '2.0', id: Date.now(), method, params }, sid)).result;
  } catch (e) {
    delete mcpSessions[key]; // session 過期就下次重來
    throw e;
  }
}
const toolCache = {};
async function memoryTools(mem) {
  toolCache[mem.url] ||= mcpCall(mem, 'tools/list', {}).then((r) => r?.tools || []);
  try {
    return await toolCache[mem.url];
  } catch (e) {
    delete toolCache[mem.url];
    throw e;
  }
}
function toolText(result) {
  // 記憶庫自己回報失敗（例如它後面的資料庫連不上），要當成錯誤，不能當成記憶內容
  if (result?.isError)
    throw new Error('記憶庫回報失敗：' + (result.content || []).map((c) => c.text).join(' '));
  // 有些記憶庫把內容放在 resource 或 structuredContent，不只 text，一起收進來
  const parts = (result?.content || []).map((c) =>
    c.type === 'text' ? c.text : c.type === 'resource' ? c.resource?.text || '' : '',
  );
  if (result?.structuredContent) parts.push(JSON.stringify(result.structuredContent, null, 1));
  return parts.filter(Boolean).join('\n');
}
// warmup 的結果留 10 分鐘，不用每句話都重讀
const warmupCache = {};
async function mcpWarmup(id) {
  const mem = saved.personas[id].memMcp;
  const hit = warmupCache[id];
  if (hit && Date.now() - hit.at < 10 * 60000) return hit.text;
  const tools = await memoryTools(mem);
  const warm = tools.find((t) => /warmup/i.test(t.name));
  const text = warm ? toolText(await mcpCall(mem, 'tools/call', { name: warm.name, arguments: {} })) : '';
  warmupCache[id] = { text, at: Date.now() };
  return text;
}

// ─── 給聊天用 ─────────────────────────────────
async function memoryContext(id) {
  const p = saved.personas[id];
  if (memoryMode(p) === 'local') {
    const list = liveMemories(p);
    return [
      list.length &&
        `你自己記下的事：\n${list.map((m) => `- ${m.text}${m.kind === 'short' ? '（最近）' : ''}`).join('\n')}`,
      '想記住重要的事，就在回覆最後另起一行寫［記住：內容］；只是這幾天的事就寫［短記：內容］。這行不會給她看到。',
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  if (memoryMode(p) === 'mcp' && p.memMcp?.url) {
    try {
      const text = await mcpWarmup(id);
      return text && `以下是你從自己的記憶庫讀到的內容（warmup）：\n${text}`;
    } catch (e) {
      logError(`${personaName(id)}・記憶庫 warmup`, e.message);
      toast(`${personaName(id)}的記憶庫讀不到：${e.message}`);
      return `【記憶庫連不上】${e.message}。這一輪讀不到也寫不進記憶庫，需要的話跟${saved.profile.name}說一聲，不要假裝記得。`;
    }
  }
  return '';
}
// 把回覆裡的［記住：…］收進本地記憶，回傳給她看的乾淨文字
// 這一輪他寫進記憶的事，跟著訊息顯示出來，下一輪他也看得到有沒有寫成功
const noted = {};
function takeNoted(id) {
  const list = noted[id] || [];
  delete noted[id];
  return list;
}
function takeMemories(id, text) {
  const p = saved.personas[id];
  if (memoryMode(p) !== 'local') return text;
  let found = false;
  const clean = text.replace(REMEMBER, (_, kind, body) => {
    (p.memories ||= []).push({
      id: crypto.randomUUID(),
      text: body.trim(),
      kind: kind === '記住' ? 'long' : 'short',
      at: Date.now(),
    });
    found = true;
    (noted[id] ||= []).push(`已寫入${kind === '記住' ? '長期記憶' : '短期記憶'}：${body.trim()}`);
    return '';
  });
  if (found) save('personas');
  return clean.trim();
}
// 外部記憶庫的工具交給模型（OpenAI 相容的 tools）
async function memoryToolSpecs(id) {
  const p = saved.personas[id];
  if (memoryMode(p) !== 'mcp' || !p.memMcp?.url) return null;
  try {
    const tools = await memoryTools(p.memMcp);
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
    }));
  } catch {
    return null;
  }
}
function runMemoryTool(id, name, args) {
  return mcpCall(saved.personas[id].memMcp, 'tools/call', { name, arguments: args }).then(
    (r) => toolText(r) || '成功（記憶庫沒有回傳內容）',
  );
}

// ─── 設定面板 ─────────────────────────────────
let memoryEditing = null;
function openMemorySettings(id) {
  memoryEditing = id;
  const p = saved.personas[id],
    mode = memoryMode(p),
    mem = p.memMcp || {};
  const list = liveMemories(p).slice().reverse();
  openSheet(
    '記憶庫',
    `<label class="field">角色<select id="mem-persona" class="form-input">${[...memberIds(), 'guest'].map((k) => `<option value="${k}" ${k === id ? 'selected' : ''}>${escapeHTML(personaName(k))}</option>`).join('')}</select></label>
<div class="field">記憶接法<div class="sheet-grid conn-mode"><button data-mem-mode="local" aria-pressed="${mode === 'local'}">本地 warmup</button><button data-mem-mode="mcp" aria-pressed="${mode === 'mcp'}">記憶庫 MCP</button></div></div>
<div id="mem-local" class="${mode === 'local' ? '' : 'hide'}"><p class="sheet-note">記憶存在這支手機。聊天時自動帶給他，他也會自己記下新的事；短期記憶 ${SHORT_DAYS} 天後自動忘記。</p><div class="row" style="gap:6px;margin-top:8px"><input id="mem-new" class="form-input" placeholder="幫他記一件事"><select id="mem-kind" class="form-input" style="width:auto"><option value="long">長期</option><option value="short">短期</option></select></div><button class="primary-action" data-action="mem-add">記下來</button>${list.map((m) => `<div class="record row"><div class="grow">${escapeHTML(m.text)}<small>${m.kind === 'long' ? '長期' : '短期'}・${ago(m.at)}</small></div><button class="round" data-mem-delete="${m.id}" aria-label="刪除">${icon('trash')}</button></div>`).join('') || '<p class="sheet-note">還沒有記憶。</p>'}</div>
<div id="mem-mcp" class="${mode === 'mcp' ? '' : 'hide'}">${field('mem-url', 'MCP 網址', mem.url, 'url', 'https://…/mcp')}${field('mem-token', 'Token（沒有就留空）', mem.token, 'password')}<p class="sheet-note">直接 API 的他：開聊前會先跑記憶庫的 warmup，聊天中也能自己用記憶庫的工具。住在 Claude、ChatGPT 的他（MCP 橋接）：記憶庫請加在那一邊。</p><p id="mem-result" class="sheet-note"></p><div class="sheet-grid"><button data-action="mem-test">測試連線</button><button class="gold" data-action="mem-save">儲存</button></div></div>`,
  );
}
function memMode() {
  return document.querySelector('[data-mem-mode][aria-pressed="true"]').dataset.memMode;
}
async function memTest() {
  const out = document.querySelector('#mem-result');
  const mem = {
    url: document.querySelector('#mem-url').value.trim(),
    token: document.querySelector('#mem-token').value.trim(),
  };
  if (!mem.url) {
    out.textContent = '先填網址';
    return;
  }
  out.textContent = '測試中…';
  delete mcpSessions[mem.url];
  delete toolCache[mem.url];
  try {
    const tools = await memoryTools(mem);
    out.textContent = `連上了，有 ${tools.length} 個工具：${tools.map((t) => t.name).join('、')}`;
    // 連線通了不代表記憶庫後面的資料庫也通，實際跑一次 warmup
    const warm = tools.find((t) => /warmup/i.test(t.name));
    if (warm) {
      out.textContent += '。正在試讀記憶…';
      try {
        const text = toolText(await mcpCall(mem, 'tools/call', { name: warm.name, arguments: {} }));
        out.textContent = out.textContent.replace('正在試讀記憶…', `試讀成功（${text.length} 字）`);
      } catch (e) {
        out.textContent = out.textContent.replace('正在試讀記憶…', `但試讀失敗：${e.message}`);
      }
    }
  } catch (e) {
    out.textContent =
      '沒連上：' +
      (e.message === 'Failed to fetch'
        ? '網址打不開，或這個記憶庫不允許網頁直接連（App 版可以）'
        : e.message);
  }
}
function memSave() {
  const p = saved.personas[memoryEditing];
  p.memoryMode = memMode();
  if (p.memoryMode === 'mcp')
    p.memMcp = {
      url: document.querySelector('#mem-url').value.trim(),
      token: document.querySelector('#mem-token').value.trim(),
    };
  delete warmupCache[memoryEditing];
  save('personas');
  toast('記憶庫設定存好了');
  openMemorySettings(memoryEditing);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mem-mode],[data-mem-delete]');
  if (!b) return;
  if (b.dataset.memMode) {
    document.querySelectorAll('[data-mem-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    document.querySelector('#mem-local').classList.toggle('hide', b.dataset.memMode !== 'local');
    document.querySelector('#mem-mcp').classList.toggle('hide', b.dataset.memMode !== 'mcp');
    // 本地模式不用按儲存，切過去就生效
    if (b.dataset.memMode === 'local') {
      saved.personas[memoryEditing].memoryMode = 'local';
      save('personas');
    }
  } else {
    const p = saved.personas[memoryEditing];
    p.memories = (p.memories || []).filter((m) => m.id !== b.dataset.memDelete);
    save('personas');
    openMemorySettings(memoryEditing);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'mem-persona') openMemorySettings(e.target.value);
});
