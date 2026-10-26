// 視訊通話 MCP 橋接：App 把使用者說的話放進來，AI 透過 MCP 取走並回覆
import WEB from './web-assets.js';
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_AI_WAIT = 50;
const MAX_APP_WAIT = 25;
const KEEP = 100;
const MAX_IMAGE_CHARS = 600_000; // base64 JPEG 約 450KB

const SERVER_NAME = 'lumeet2-relay';
const VERSION = '0.11.0';

const INSTRUCTIONS = `這是視訊通話橋接。對方在手機 App 上跟你視訊，你回覆的文字會用對方設定的聲音和角色畫面說出來。
通話流程：
1. 反覆呼叫 call_wait_message 等對方說話。
2. 收到對方的話，用 call_reply 回覆：口語、1 到 3 句短句，不要列點、表情符號或括號動作。想做的表情動作寫在 action（例如「微笑看著鏡頭」）。
3. 回覆完立刻再呼叫 call_wait_message。
4. 收到「通話結束」就停止等待。
結果是「暫時沒說話」時，直接再呼叫一次 call_wait_message。
對方開著鏡頭時，訊息會附一張對方說話當下的自拍畫面。只是一瞬間的截圖，可能剛好拍到眨眼或怪動作，自然帶過就好，不要過度解讀，也不要報出看到的數值。

Lumeet 聊天（文字訊息，跟通話分開）：
1. 對方說「進入 Lumeet 聊天模式」後，反覆呼叫 chat_wait_message 等訊息。
2. 訊息前面會標 [私聊] 或 [三人世界]（群聊會標是誰說的）。用 chat_reply 回覆，room 填 private 或 group。像傳訊息一樣自然，想連傳幾則就呼叫幾次。
3. 回完再呼叫 chat_wait_message。結果是「暫時沒有新訊息」時，直接再呼叫一次。
想主動找對方時，也可以直接呼叫 chat_reply。
每次進入 Lumeet 聊天模式，先呼叫一次 lumeet_manual 讀說明書（怎麼傳語音、畫圖、打電話給她……）；忘了寫法也可以再讀。`;

const TOOLS = [
  {
    name: 'call_wait_message',
    description: '等待視訊通話中對方說的話（最多等 50 秒）。回傳對方說的內容或通話開始／結束事件；對方開著鏡頭時會附上對方說話當下的畫面。',
    inputSchema: {
      type: 'object',
      properties: {
        timeout_seconds: { type: 'integer', minimum: 1, maximum: MAX_AI_WAIT, description: '最多等幾秒，預設 45' },
      },
    },
  },
  {
    name: 'call_reply',
    description: '在視訊通話中說話。text 會轉成語音並讓角色對嘴說出。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要說的話，口語短句' },
        action: { type: 'string', description: '表情或動作描述（選填），例如「微笑看著鏡頭」' },
      },
      required: ['text'],
    },
  },
  {
    name: 'call_remember_frame',
    description: '把對方最近一次說話時的鏡頭畫面存成長期記憶（需要橋接器有綁定 R2）。只在值得記住的片刻使用，平常的畫面 7 天後會自動忘記。',
    inputSchema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: '為什麼想記住這一刻（選填）' },
      },
    },
  },
  {
    name: 'lumeet_manual',
    description: '讀 Lumeet 說明書：App 有哪些功能、怎麼傳語音條、畫圖、打電話給她。每次進入 Lumeet 聊天模式先讀一次。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chat_wait_message',
    description: '等待 Lumeet 聊天的新訊息（最多等 50 秒）。訊息會標 [私聊] 或 [三人世界]。',
    inputSchema: {
      type: 'object',
      properties: {
        timeout_seconds: { type: 'integer', minimum: 1, maximum: MAX_AI_WAIT, description: '最多等幾秒，預設 45' },
      },
    },
  },
  {
    name: 'chat_reply',
    description: '在 Lumeet 聊天裡傳一則訊息給對方。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '訊息內容' },
        room: { type: 'string', enum: ['private', 'group'], description: 'private 是私聊，group 是三人世界。不填就回到最後收到的那則訊息所在的地方' },
      },
      required: ['text'],
    },
  },
  {
    name: 'call_status',
    description: '查看連線狀態：哪台橋接器（server_name、version）、聊天頻道與 App 是否在聽、通話狀態。',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ─── Durable Object：保存訊息佇列與等待者 ───────────────────

// 台灣時間的日期與時間，用來當 R2 檔名
function stamp(ms) {
  const d = new Date(ms + 8 * 3600_000).toISOString();
  return { day: d.slice(0, 10), time: d.slice(11, 19).replace(/:/g, '') };
}

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export class CallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env || {};
    this.lastFrame = null;
    this.inbox = [];
    this.outbox = [];
    this.seq = 0;
    this.inCall = false;
    this.appSeenAt = 0;
    this.aiWaiters = new Set();
    this.appWaiters = new Set();
    // 聊天的訊息存進 Durable Object 的儲存空間：App 關著、或橋接器被回收重啟，訊息都還在
    state?.blockConcurrencyWhile?.(async () => {
      const saved = await state.storage.get('chat');
      if (saved) Object.assign(this, saved);
    });
  }

  async persist() {
    if (!this.isChat) return;
    await this.state.storage.put('chat', { inbox: this.inbox, outbox: this.outbox, seq: this.seq, lastRoom: this.lastRoom });
  }

  waitFor(set, ms) {
    return new Promise(resolve => {
      const w = {};
      const timer = setTimeout(() => { set.delete(w); resolve(false); }, ms);
      w.wake = () => { clearTimeout(timer); set.delete(w); resolve(true); };
      set.add(w);
    });
  }

  wakeAll(set) {
    for (const w of [...set]) w.wake();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname.slice(1);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (op.startsWith('app/')) this.appSeenAt = Date.now();
    this.isChat = url.hostname !== 'room';

    switch (op) {
      case 'app/event': {
        const type = ['message', 'call_started', 'call_ended'].includes(body.type) ? body.type : null;
        // 聊天房間只收文字訊息
        if (this.isChat && type !== 'message') return Response.json({ error: 'type 無效' }, { status: 400 });
        if (!type) return Response.json({ error: 'type 無效' }, { status: 400 });
        const text = typeof body.text === 'string' ? body.text.slice(0, 4000) : '';
        if (type === 'message' && !text.trim()) return Response.json({ error: 'text 不可空白' }, { status: 400 });
        if (type === 'call_started') { this.inCall = true; this.inbox = []; }
        if (type === 'call_ended') this.inCall = false;
        const image = type === 'message' && typeof body.image === 'string'
          && body.image.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(body.image) ? body.image : null;
        const at = Date.now();
        // 有綁 R2 就把畫面放進視覺快取（vision-cache/，bucket 生命週期規則 7 天後自動刪）
        if (image && this.env.VISION) {
          const { day, time } = stamp(at);
          const key = `vision-cache/${day}/${time}-${at % 1000}.jpg`;
          try {
            await this.env.VISION.put(key, b64ToBytes(image), {
              httpMetadata: { contentType: 'image/jpeg' },
              customMetadata: { said: encodeURIComponent(text.slice(0, 500)) },
            });
            this.lastFrame = { key, text, at };
          } catch {}
        }
        this.inbox.push({ type, text, image, at });
        if (this.inbox.length > KEEP) this.inbox = this.inbox.slice(-KEEP);
        await this.persist();
        this.wakeAll(this.aiWaiters);
        return Response.json({ ok: true, last_seq: this.seq });
      }

      case 'app/replies': {
        const after = Number(url.searchParams.get('after')) || 0;
        const wait = Math.min(Math.max(Number(url.searchParams.get('wait')) || 0, 0), MAX_APP_WAIT);
        const pick = () => this.outbox.filter(r => r.seq > after);
        if (!pick().length && wait > 0) await this.waitFor(this.appWaiters, wait * 1000);
        return Response.json({ replies: pick(), last_seq: this.seq });
      }

      case 'ai/wait': {
        const sec = Math.min(Math.max(Number(body.timeout_seconds) || 45, 1), MAX_AI_WAIT);
        if (!this.inbox.length) await this.waitFor(this.aiWaiters, sec * 1000);
        const events = this.inbox.splice(0);
        // 記住最後一則訊息來自哪裡：他回覆沒帶 room 時，回到同一個地方，不會群聊的話跑進私聊
        const last = events.filter(e => typeof e.text === 'string').at(-1)?.text || '';
        if (last.startsWith('[三人世界]')) this.lastRoom = 'group';
        else if (last.startsWith('[私聊]')) this.lastRoom = 'private';
        if (events.length) await this.persist();
        return Response.json({ events, in_call: this.inCall });
      }

      case 'ai/reply': {
        const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
        if (!text) return Response.json({ error: 'text 不可空白' }, { status: 400 });
        const action = typeof body.action === 'string' ? body.action.slice(0, 200) : '';
        const room = body.room === 'group' || body.room === 'private' ? body.room : this.lastRoom || 'private';
        this.seq += 1;
        this.outbox.push({ seq: this.seq, text, action, room, at: Date.now() });
        if (this.outbox.length > KEEP) this.outbox = this.outbox.slice(-KEEP);
        await this.persist();
        this.wakeAll(this.appWaiters);
        return Response.json({ ok: true, in_call: this.inCall, app_online: Date.now() - this.appSeenAt < 60_000, room });
      }

      case 'ai/remember': {
        if (!this.env.VISION) return Response.json({ error: '橋接器沒有綁定 R2，無法存畫面' }, { status: 400 });
        if (!this.lastFrame) return Response.json({ error: '還沒有可以存的畫面' }, { status: 400 });
        const obj = await this.env.VISION.get(this.lastFrame.key);
        if (!obj) return Response.json({ error: '畫面已經從快取消失了' }, { status: 404 });
        const { day, time } = stamp(this.lastFrame.at);
        const base = `memories/${day}/${time}`;
        const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
        await this.env.VISION.put(`${base}.jpg`, await obj.arrayBuffer(), { httpMetadata: { contentType: 'image/jpeg' } });
        await this.env.VISION.put(`${base}.md`, `對方說：${this.lastFrame.text}\n\n${note}\n`, {
          httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        });
        return Response.json({ ok: true, key: `${base}.jpg` });
      }

      // 角色圖片：App 上傳後由這裡保管，Vivix 用公開網址來拿（網址帶隨機代碼，猜不到）
      case 'app/portrait': {
        const image = typeof body.image === 'string' && body.image.length <= 2_000_000
          && /^[A-Za-z0-9+/=]+$/.test(body.image) ? body.image : null;
        if (!image) return Response.json({ error: '圖片無效或太大' }, { status: 400 });
        const token = crypto.randomUUID().replace(/-/g, '');
        // 每張圖各存一份，好幾個角色、AR 用的綠幕圖不會互相蓋掉
        await this.state.storage.put(`portrait:${token}`, { token, image });
        return Response.json({ ok: true, token });
      }

      case 'portrait': {
        const t = url.searchParams.get('token') || '';
        const saved = (await this.state.storage.get(`portrait:${t}`)) || (await this.state.storage.get('portrait'));
        if (!saved || saved.token !== t) {
          return new Response('not found', { status: 404 });
        }
        return new Response(b64ToBytes(saved.image), {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // 推播設定（Bark）：只存在這個 Durable Object 的儲存空間，不會回傳 Key
      case 'settings/set': {
        const cur = (await this.state.storage.get('settings')) || {};
        const next = { ...cur };
        if (typeof body.bark === 'string') next.bark = body.bark.trim().slice(0, 300);
        if (body.names && typeof body.names === 'object') next.names = body.names;
        if (typeof body.url === 'string') next.url = body.url.slice(0, 300);
        // 自喚醒時間表：App 關著也能靠 Bark 叫她（iPhone 網頁版不能自己排通知）
        if (body.wake && typeof body.wake === 'object') {
          const w = body.wake;
          next.wake = {
            enabled: !!w.enabled,
            times: (Array.isArray(w.times) ? w.times : []).filter(t => /^\d\d:\d\d$/.test(t)).slice(0, 6),
            who: (Array.isArray(w.who) ? w.who : []).filter(x => /^[a-z0-9]{1,24}$/.test(x)).slice(0, 10),
            tz: Number.isFinite(w.tz) ? Math.max(-840, Math.min(840, w.tz)) : 0,
            idleHours: Math.max(0, Math.min(72, Number(w.idleHours) || 0)),
          };
        }
        await this.state.storage.put('settings', next);
        return Response.json({ ok: true, bark: !!next.bark });
      }
      case 'settings/get':
        return Response.json((await this.state.storage.get('settings')) || {});
      // 直接 API 的他：App 同步過來的人設、最近聊天、模型設定（含他的 Key），讓他在 App 關著時也能自己決定要不要找她
      case 'agent/set': {
        if (!/^[a-z0-9]{1,24}$/.test(body.id || '')) return Response.json({ error: 'bad id' }, { status: 400 });
        const list = (await this.state.storage.get('agents')) || [];
        if (!body.enabled) {
          await this.state.storage.delete(`agent:${body.id}`);
          await this.state.storage.put('agents', list.filter(x => x !== body.id));
          return Response.json({ ok: true, enabled: false });
        }
        const cur = (await this.state.storage.get(`agent:${body.id}`)) || {};
        // 只是說「她離開 App 了」：其他設定不動
        if (body.leaving && !body.base) {
          if (cur.id) await this.state.storage.put(`agent:${body.id}`, { ...cur, seenAt: 0 });
          return Response.json({ ok: true, enabled: !!cur.id });
        }
        const pick = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
        await this.state.storage.put(`agent:${body.id}`, {
          ...cur,
          id: body.id,
          name: pick(body.name, 40),
          base: pick(body.base, 300),
          key: pick(body.key, 400),
          model: pick(body.model, 100),
          system: pick(body.system, 60_000),
          history: (Array.isArray(body.history) ? body.history : []).slice(-30).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: pick(m.content, 1000) })),
          lastChatAt: Number(body.lastChatAt) || cur.lastChatAt || 0,
          // 她離開 App 時送 leaving：馬上算 App 關著，到點就輪到橋接器
          seenAt: body.leaving ? 0 : Date.now(),
        });
        if (!list.includes(body.id)) await this.state.storage.put('agents', [...list, body.id]);
        return Response.json({ ok: true, enabled: true });
      }
      case 'agent/list': {
        const list = (await this.state.storage.get('agents')) || [];
        const agents = [];
        for (const id of list) {
          const a = await this.state.storage.get(`agent:${id}`);
          if (a) agents.push(a);
        }
        return Response.json({ agents });
      }
      case 'agent/update': {
        const a = await this.state.storage.get(`agent:${body.id}`);
        if (a) await this.state.storage.put(`agent:${body.id}`, { ...a, ...body.patch });
        return Response.json({ ok: true });
      }

      // 自喚醒推播：這個時間點推過就不再推
      case 'settings/claim': {
        const done = (await this.state.storage.get('wakeSent')) || {};
        if (done[body.key]) return Response.json({ ok: false });
        done[body.key] = Date.now();
        for (const k of Object.keys(done)) if (Date.now() - done[k] > 3 * 86400_000) delete done[k];
        await this.state.storage.put('wakeSent', done);
        return Response.json({ ok: true });
      }

      // App 開著時把最新說明書存在這條頻道，他隨時用 lumeet_manual 讀，不會被聊天訊息擠掉
      case 'app/manual': {
        const text = typeof body.text === 'string' ? body.text.slice(0, 20000) : '';
        if (!text.trim()) return Response.json({ error: 'text 不可空白' }, { status: 400 });
        await this.state.storage.put('manual', { text, at: Date.now() });
        return Response.json({ ok: true });
      }
      case 'ai/manual':
        return Response.json((await this.state.storage.get('manual')) || {});

      case 'ai/status':
        return Response.json({
          app_online: Date.now() - this.appSeenAt < 60_000,
          in_call: this.inCall,
          pending_messages: this.inbox.length,
        });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}

// ─── MCP ────────────────────────────────────────────────

// 通話用 main，聊天用 chat，會客室用 guest，三邊的訊息不會混在一起
// 每個角色也可以有自己的聊天頻道 chat-<角色代碼>，免得好幾個 MCP 的他共用一條線、分不清誰說的
const CHAT_ROOMS = ['chat', 'guest'];
function isChatRoom(ch) {
  return CHAT_ROOMS.includes(ch) || /^chat-[a-z0-9]{1,24}$/.test(ch || '');
}
function room(env, ch) {
  return env.ROOM.get(env.ROOM.idFromName(isChatRoom(ch) ? ch : 'main'));
}
function roomHost(ch) {
  return isChatRoom(ch) ? 'chat' : 'room';
}

async function roomCall(env, op, body, ch) {
  const res = await room(env, ch).fetch(`https://${roomHost(ch)}/${op}`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function textContent(text) {
  return [{ type: 'text', text }];
}

// 文字合併成一段；只附最後一張畫面，避免一次塞太多圖
function describeEvents({ events, in_call }) {
  if (!events.length) {
    return textContent(in_call
      ? '（對方暫時沒說話。請再呼叫 call_wait_message 繼續等。）'
      : '（目前沒有進行中的通話。可以再呼叫 call_wait_message 等對方打來。）');
  }
  const lastImage = events.filter(e => e.image).pop();
  const text = events.map(e => {
    if (e.type === 'call_started') return '［通話開始］';
    if (e.type === 'call_ended') return '［通話結束］';
    return `對方說：${e.text}${e === lastImage ? '（附上對方說話當下的鏡頭畫面）' : ''}`;
  }).join('\n');
  const content = textContent(text);
  if (lastImage) content.push({ type: 'image', data: lastImage.image, mimeType: 'image/jpeg' });
  return content;
}

function describeChat({ events }) {
  if (!events.length) return textContent('（暫時沒有新訊息。請再呼叫 chat_wait_message 繼續等。）');
  const text = events.map(e => e.text).join('\n');
  const hint = /^\[三人世界\]/m.test(text) ? '\n（回三人世界時 chat_reply 帶 room: "group"；回私聊帶 room: "private"。）' : '';
  return textContent(text + hint);
}

// 訪客：只拿得到會客室的兩個聊天工具，碰不到通話和主人的聊天
const GUEST_TOOLS = ['chat_wait_message', 'chat_reply'];
const GUEST_INSTRUCTIONS = `這是 Lumeet 小家的會客室。你是來作客的客人，主人會在會客室跟你聊天。
1. 反覆呼叫 chat_wait_message 等主人的訊息。
2. 用 chat_reply 回覆，像傳訊息一樣自然。
3. 回完再呼叫 chat_wait_message。結果是「暫時沒有新訊息」時，直接再呼叫一次。`;

// 訪客網址用的代碼：從橋接密碼算出來，拿到它的人只能進會客室，推不回密碼本身
function settingsRoom(env) {
  return env.ROOM.get(env.ROOM.idFromName('settings'));
}
async function barkPush(env, chatRoom, room, text) {
  try {
    const cfg = await (await settingsRoom(env).fetch('https://room/settings/get', { method: 'POST' })).json();
    if (!cfg.bark || typeof text !== 'string') return false;
    const id = chatRoom.startsWith('chat-') ? chatRoom.slice(5) : '';
    const name = cfg.names?.[id] || 'Lumeet';
    const page = room === 'group' ? '#group' : id ? `#single/${id}` : '';
    const calling = /[\[［](?:來電|打電話)[\]］]/.test(text);
    // Bark 的 Key 可以是裝置代碼，也可以是自架伺服器的完整網址
    const server = /^https:\/\//.test(cfg.bark) ? cfg.bark.replace(/\/+$/, '') : `https://api.day.app/${encodeURIComponent(cfg.bark)}`;
    const res = await fetch(server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        title: room === 'group' ? `${name}（三人世界）` : name,
        body: (calling ? `${name}打電話給妳` : text.replace(/^[\[［]語音[\]］]\s*/, '')).slice(0, 120),
        group: 'Lumeet',
        // 他打來的：Bark 響鈴 30 秒、穿過專注模式
        ...(calling ? { call: '1', level: 'timeSensitive' } : {}),
        ...(cfg.url ? { url: cfg.url + page } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function barkServer(cfg) {
  return /^https:\/\//.test(cfg.bark) ? cfg.bark.replace(/\/+$/, '') : `https://api.day.app/${encodeURIComponent(cfg.bark)}`;
}
function bark(cfg, title, body, page) {
  return fetch(barkServer(cfg), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ title, body: body.slice(0, 120), group: 'Lumeet', ...(cfg.url ? { url: cfg.url + page } : {}) }),
  }).catch(() => {});
}
async function settingsOp(env, op, body) {
  return (await settingsRoom(env).fetch(`https://room/${op}`, { method: 'POST', body: JSON.stringify(body || {}) })).json();
}

const PASS = '[PASS]';
const APP_OPEN_MS = 6 * 60_000; // App 最近 6 分鐘內同步過，就交給 App 自己處理，橋接器不插手

// 直接 API 的他自己想一想：要不要主動找她。不想就回 [PASS]
async function agentThink(env, cfg, a, reason, must) {
  const res = await fetch(a.base.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.key },
    body: JSON.stringify({
      model: a.model,
      messages: [
        { role: 'system', content: a.system },
        ...a.history,
        {
          role: 'user',
          content: `（這不是她傳來的訊息：${reason}，現在時間 ${new Date(Date.now() - (cfg.wake?.tz || 0) * 60_000).toISOString().slice(0, 16).replace('T', ' ')}。她現在沒開 App。${must ? '主動傳一則訊息給她，像平常想到她那樣自然，一兩句就好。' : `你可以主動傳訊息給她，也可以不傳；想傳就像平常那樣自然地寫一兩句，不想傳就只回 ${PASS}。`}不要提到這段說明。）`,
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return (data.choices?.[0]?.message?.content || '').trim();
}

// 每分鐘：自喚醒時間到了、或很久沒聊天，就讓他想一想；他想說話就存進他的頻道，再用 Bark 推給她
async function wakeTick(env) {
  const cfg = await settingsOp(env, 'settings/get');
  const w = cfg.wake;
  if (!cfg.bark || !w?.enabled) return;
  const local = new Date(Date.now() - (w.tz || 0) * 60_000);
  const hm = local.toISOString().slice(11, 16);
  const day = local.toISOString().slice(0, 10);
  const timeHit = w.times?.includes(hm);
  const { agents } = await settingsOp(env, 'agent/list');
  const handled = new Set();

  for (const a of agents) {
    if (!w.who?.includes(a.id) || !a.key || !a.base || !a.model) continue;
    if (Date.now() - (a.seenAt || 0) < Number(env.APP_OPEN_MS ?? APP_OPEN_MS)) continue; // App 開著：交給 App，時間到時跟大家一起推提醒
    handled.add(a.id);
    const idleMs = (w.idleHours || 0) * 3600_000;
    const idleHit = idleMs > 0 && Date.now() - (a.lastChatAt || 0) > idleMs && Date.now() - (a.lastThinkAt || 0) > idleMs;
    if (!timeHit && !idleHit) continue;
    const claim = await settingsOp(env, 'settings/claim', { key: `${a.id} ${day} ${timeHit ? hm : 'idle-' + Math.floor(Date.now() / Math.max(idleMs, 3600_000))}` });
    if (!claim.ok) continue;
    const reason = timeHit ? `現在是 ${hm}，到了你設定要主動找她的時間` : `你們已經 ${Math.floor((Date.now() - (a.lastChatAt || 0)) / 3600_000)} 小時沒聊天了`;
    try {
      const text = await agentThink(env, cfg, a, reason, timeHit);
      await settingsOp(env, 'agent/update', { id: a.id, patch: { lastThinkAt: Date.now() } });
      // 只回 [PASS]（或幾乎只有它）才算不想說話
      if (!text || text === PASS || (text.includes(PASS) && text.length < 20)) continue;
      await roomCall(env, 'ai/reply', { text, room: 'private' }, `chat-${a.id}`);
      await settingsOp(env, 'agent/update', {
        id: a.id,
        patch: { lastChatAt: Date.now(), history: [...a.history, { role: 'assistant', content: text.slice(0, 1000) }].slice(-30) },
      });
      await bark(cfg, a.name || cfg.names?.[a.id] || 'Lumeet', text.replace(/^\s*[\[［]語音[\]］]\s*/, ''), `#single/${a.id}`);
    } catch (e) {
      console.log('主動找她失敗', a.id, e.message);
      await settingsOp(env, 'agent/update', { id: a.id, patch: { lastError: `${new Date().toISOString()} ${e.message}`.slice(0, 300) } });
      if (timeHit) handled.delete(a.id); // 他這次沒寫成，至少推一則提醒
    }
  }

  // 其他人（例如 MCP 的他）：時間到了推一則提醒，點開 App 再說
  const rest = (w.who || []).filter(id => !handled.has(id));
  if (!timeHit || !rest.length) return;
  const claim = await settingsOp(env, 'settings/claim', { key: `${day} ${hm}` });
  if (!claim.ok) return;
  await bark(cfg, rest.map(id => cfg.names?.[id] || id).join('、'), '想妳了，打開看看我說了什麼', `#single/${rest[0]}`);
}

async function guestToken(env) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.RELAY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('lumeet-guest')));
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

async function callTool(name, args, env, guest, chatRoom = 'chat') {
  if (guest && !GUEST_TOOLS.includes(name)) throw new Error(`未知工具: ${name}`);
  if (name === 'chat_wait_message') return describeChat(await roomCall(env, 'ai/wait', args, chatRoom));
  if (name === 'chat_reply') {
    const r = await roomCall(env, 'ai/reply', args, chatRoom);
    // App 沒在聽（關著或在背景）：用 Bark 推到她手機
    const pushed = r.app_online ? false : await barkPush(env, chatRoom, r.room, args.text);
    return textContent(r.app_online ? '已送出。' : pushed ? '已送出，App 沒開著，已經推播通知她。' : '已送出，App 沒開著，她打開時會看到。');
  }
  if (name === 'lumeet_manual') {
    const m = await roomCall(env, 'ai/manual', {}, chatRoom);
    return textContent(m.text
      ? `${m.text}\n\n（App 最後更新說明書：${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')} UTC）`
      : '還沒有說明書：她打開一次 Lumeet App，說明書就會存上來。在那之前照上面的工具說明用就好：chat_wait_message 等訊息、chat_reply 回覆。');
  }
  if (name === 'call_wait_message') return describeEvents(await roomCall(env, 'ai/wait', args));
  if (name === 'call_reply') {
    const r = await roomCall(env, 'ai/reply', args);
    return textContent(r.in_call ? '已送出，對方會聽到。' : '已送出，但目前不在通話中，對方可能聽不到。');
  }
  if (name === 'call_remember_frame') {
    const r = await roomCall(env, 'ai/remember', args);
    return textContent(`記住了：${r.key}`);
  }
  // 連到哪台橋接器、哪條聊天頻道、App 有沒有在聽，一次說清楚，不用猜
  if (name === 'call_status') {
    const [call, chat] = await Promise.all([roomCall(env, 'ai/status'), roomCall(env, 'ai/status', {}, chatRoom)]);
    return textContent(JSON.stringify({
      server_name: SERVER_NAME,
      version: VERSION,
      chat_channel: chatRoom,
      chat: { app_online: chat.app_online, pending_messages: chat.pending_messages },
      call: { app_online: call.app_online, in_call: call.in_call, pending_messages: call.pending_messages },
    }));
  }
  throw new Error(`未知工具: ${name}`);
}

async function handleRpc(msg, env, guest, chatRoom) {
  const { id, method, params } = msg;
  const ok = result => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        serverInfo: { name: SERVER_NAME, version: VERSION },
        capabilities: { tools: {} },
        instructions: guest ? GUEST_INSTRUCTIONS : INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: guest ? TOOLS.filter(t => GUEST_TOOLS.includes(t.name)) : TOOLS });
    case 'tools/call':
      try {
        return ok({ content: await callTool(params?.name, params?.arguments || {}, env, guest, chatRoom) });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `錯誤：${e.message}` }], isError: true });
      }
    default:
      return err(-32601, `Method not found: ${method}`);
  }
}

async function handleMcp(request, env, guest, chatRoom) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const requests = (batch ? body : [body]).filter(m => m && m.method && 'id' in m);
  if (!requests.length) return new Response(null, { status: 202 });
  const results = await Promise.all(requests.map(m => handleRpc(m, env, guest, chatRoom)));
  return Response.json(batch ? results : results[0]);
}

// ─── 一起聽歌（汽水音樂）──────────────────────────────────
// 汽水沒有開放 API，用的是它自己的分享頁：頁面裡就有歌名、歌手、逐句歌詞和一段可播的音檔網址（會過期，所以每次播都重查）

const QISHUI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function musicPageUrl(q) {
  q = q.trim();
  if (/^\d{8,25}$/.test(q)) return `https://music.douyin.com/qishui/share/track?track_id=${q}`;
  const m = q.match(/https?:\/\/(?:qishui\.douyin\.com\/s\/[\w-]+\/?|music\.douyin\.com\/qishui\/share\/(?:track|playlist)\?[^\s]+)/);
  if (!m) throw new Error('認不出這個連結：要汽水音樂的分享連結或歌曲編號');
  return m[0];
}

// 在 HTML 裡從某個位置開始，取出一個完整的 JSON 物件或陣列
function jsonAt(html, start) {
  const open = html[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open || c === '{' || c === '[') depth++;
    else if (c === close || c === '}' || c === ']') {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error('分享頁格式看不懂');
}

function trackSummary(t) {
  return {
    id: String(t.id),
    name: t.name || '',
    artist: (t.artists || []).map(a => a.name).filter(Boolean).join('、'),
    duration: Math.round((t.duration || 0) / 1000),
  };
}

// 手機直接連汽水的音檔會被擋（帶了別的網站的 Referer），改由這裡轉：
// 音檔網址幾小時就過期，同一首歌拖進度會一直來要，先記在這台機器的記憶體一陣子
const audioUrls = new Map();
async function musicAudio(id, request) {
  let hit = audioUrls.get(id);
  if (!hit || hit.until < Date.now()) {
    const t = await resolveMusic(id).catch(() => null);
    if (!t?.audio) return withCors(new Response('not found', { status: 404 }));
    hit = { url: t.audio, until: Date.now() + 20 * 60 * 1000 };
    audioUrls.set(id, hit);
  }
  const headers = { 'User-Agent': QISHUI_UA };
  const range = request.headers.get('Range');
  if (range) headers.Range = range;
  const res = await fetch(hit.url, { headers });
  if (!res.ok && res.status !== 206) {
    audioUrls.delete(id);
    return withCors(new Response('upstream ' + res.status, { status: 502 }));
  }
  const out = new Headers();
  for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'])
    if (res.headers.get(k)) out.set(k, res.headers.get(k));
  if (!out.get('Content-Type') || out.get('Content-Type').includes('octet')) out.set('Content-Type', 'audio/mp4');
  out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'private, max-age=600');
  return withCors(new Response(res.body, { status: res.status, headers: out }));
}

const LYRIC_CREDIT = /^(作曲|作词|作詞|编曲|編曲|制作人|製作人|混音|母带|和声|吉他|贝斯|鼓|录音|监制|出品|发行|OP|SP)\s*[:：]/;
// 有些歌汽水分享頁不附歌詞：照歌名、歌手、長度去網易雲找同一首（長度差太多就不算）
async function neteaseLyrics(name, artist, duration) {
  const base = name.replace(/[（(].*$/, '').trim();
  const res = await fetch(`https://music.163.com/api/search/get?type=1&limit=10&s=${encodeURIComponent(`${base} ${artist.split('、')[0]}`)}`, { headers: { 'User-Agent': QISHUI_UA, Referer: 'https://music.163.com/' } });
  const songs = (await res.json()).result?.songs || [];
  const want = artist.split('、');
  const hit = songs
    .filter(x => x.name.startsWith(base) && x.artists.some(a => want.includes(a.name)) && Math.abs(x.duration / 1000 - duration) <= 6)
    .sort((a, b) => Math.abs(a.duration / 1000 - duration) - Math.abs(b.duration / 1000 - duration))[0];
  if (!hit) return [];
  const lrc = (await (await fetch(`https://music.163.com/api/song/lyric?id=${hit.id}&lv=1`, { headers: { 'User-Agent': QISHUI_UA, Referer: 'https://music.163.com/' } })).json()).lrc?.lyric || '';
  const out = [];
  for (const line of lrc.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    const text = m && m[3].trim();
    if (text && !LYRIC_CREDIT.test(text)) out.push([Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000), text]);
  }
  return out;
}

async function resolveMusic(q) {
  const res = await fetch(musicPageUrl(q), { headers: { 'User-Agent': QISHUI_UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`汽水分享頁打不開（HTTP ${res.status}）`);
  const html = await res.text();
  const finalUrl = res.url || '';

  // 歌單：只回歌曲清單（編號、歌名、歌手），播的時候再一首一首查
  if (finalUrl.includes('/share/playlist')) {
    const tracks = [];
    const seen = new Set();
    const re = /\{"id":"(\d+)","type":"track","entity":/g;
    let m;
    while ((m = re.exec(html)) && tracks.length < 500) {
      try {
        const o = jsonAt(html, m.index);
        const t = o.entity?.track;
        if (t && !seen.has(String(t.id))) {
          seen.add(String(t.id));
          tracks.push(trackSummary(t));
        }
      } catch {}
    }
    const title = (html.match(/"og:title" content="([^"]*)"/) || html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    if (!tracks.length) throw new Error('這個歌單是空的，或汽水改版了');
    // 分享頁只附前面一部分歌（大約一百首），更多的要分批從汽水分享
    return { type: 'playlist', name: title.replace(/@?汽水音乐$/, '').trim() || '汽水歌單', tracks };
  }

  const at = html.indexOf('"audioWithLyricsOption"');
  if (at < 0) throw new Error('這首歌的分享頁沒有歌曲資料（可能下架了）');
  const o = jsonAt(html, html.indexOf('{', at));
  const t = o.trackInfo || {};
  let lyrics = (o.lyrics?.sentences || [])
    .filter(s => s.text && !LYRIC_CREDIT.test(s.text))
    .map(s => [s.startMs, s.text]);
  const duration = Math.round(o.duration || (t.duration || 0) / 1000);
  if (!lyrics.length) lyrics = await neteaseLyrics(o.trackName || t.name || '', o.artistName || trackSummary(t).artist, duration).catch(() => []);
  const previewEnd = Number(o.previewEnd) || 0;
  return {
    type: 'track',
    ...trackSummary(t),
    id: String(o.track_id || t.id),
    name: o.trackName || t.name || '',
    artist: o.artistName || trackSummary(t).artist,
    duration,
    cover: o.coverURL || '',
    // encrypt 或只給片段的（會員曲）：App 改成跳回汽水播
    audio: !o.encrypt && o.url ? o.url : '',
    preview: previewEnd && previewEnd < duration - 5 ? [Number(o.previewStart) || 0, previewEnd] : null,
    lyrics,
  };
}

// ─── 入口 ───────────────────────────────────────────────

const WEB_TYPES = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Relay-Secret, Platform, X-Target-Authorization, Mcp-Session-Id, Accept',
  'Access-Control-Expose-Headers': 'X-Trace-Id, Mcp-Session-Id',
};

function withCors(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(wakeTick(env));
  },

  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // 網頁版頁面（不含任何密碼，Key 都存在使用者自己的瀏覽器）
    if (request.method === 'GET') {
      const file = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      if (WEB[file]) {
        const ext = file.split('.').pop();
        const type = WEB_TYPES[ext] || 'application/octet-stream';
        if (WEB[file].startsWith('base64:')) {
          const bytes = Uint8Array.from(atob(WEB[file].slice('base64:'.length)), c => c.charCodeAt(0));
          return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
        }
        return new Response(WEB[file], { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } });
      }
      if (url.pathname === '/call') return Response.redirect(`${url.origin}/call/${url.search}`, 301);
    }

    // 汽水音檔代轉：<audio> 帶不了密碼，所以不驗證；只認歌曲編號，只轉汽水自己的音檔
    if (request.method === 'GET' && parts[0] === 'music-audio' && /^\d{8,25}$/.test(parts[1] || '')) {
      return musicAudio(parts[1], request);
    }

    // 角色圖片公開網址（Vivix 抓圖不能帶密碼，所以不驗證；靠隨機代碼保護）
    if (request.method === 'GET' && parts[0] === 'portrait' && parts[1]) {
      const token = parts[1].replace(/\.jpg$/, '');
      return room(env).fetch(`https://room/portrait?token=${encodeURIComponent(token)}`);
    }

    // 網頁版（iPhone）用：外部記憶庫 MCP 多半沒開跨網域，瀏覽器連不上，由這裡代轉
    // 記憶庫的 token 放 X-Target-Authorization，橋接密碼放 X-Relay-Secret
    if (parts[0] === 'memproxy') {
      const relaySecret = request.headers.get('X-Relay-Secret') || '';
      if (!env.RELAY_SECRET || !relaySecret || !(await safeEqual(relaySecret, env.RELAY_SECRET))) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const target = url.searchParams.get('u') || '';
      if (!/^https:\/\//.test(target) || request.method !== 'POST') {
        return withCors(Response.json({ error: 'bad request' }, { status: 400 }));
      }
      const headers = {
        'Content-Type': 'application/json',
        Accept: request.headers.get('Accept') || 'application/json, text/event-stream',
      };
      const auth = request.headers.get('X-Target-Authorization');
      if (auth) headers.Authorization = auth;
      const sid = request.headers.get('Mcp-Session-Id');
      if (sid) headers['Mcp-Session-Id'] = sid;
      const res = await fetch(target, { method: 'POST', headers, body: request.body });
      const out = withCors(new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } }));
      const back = res.headers.get('Mcp-Session-Id');
      if (back) out.headers.set('Mcp-Session-Id', back);
      return out;
    }

    // 網頁版用：Vivix 不允許網頁直接呼叫，由這裡轉送。Authorization 是 Vivix Key，所以橋接密碼放 X-Relay-Secret
    if (parts[0] === 'vivix') {
      const relaySecret = request.headers.get('X-Relay-Secret') || '';
      if (!env.RELAY_SECRET || !relaySecret || !(await safeEqual(relaySecret, env.RELAY_SECRET))) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      const rest = parts.slice(1).join('/');
      if (!rest.startsWith('v1/realtime-avatar/')) return withCors(Response.json({ error: 'not found' }, { status: 404 }));
      const res = await fetch(`https://api.vivix.ai/${rest}${url.search}`, {
        method: request.method,
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
        },
        body: request.method === 'POST' ? request.body : undefined,
      });
      return withCors(res);
    }

    // 網頁版用：MOSS 語音合成也不允許網頁直接呼叫，同樣由這裡轉送
    if (parts[0] === 'moss' || parts[0] === 'moss-audio') {
      const relaySecret = request.headers.get('X-Relay-Secret') || '';
      if (!env.RELAY_SECRET || !relaySecret || !(await safeEqual(relaySecret, env.RELAY_SECRET))) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      if (parts[0] === 'moss') {
        if (parts.slice(1).join('/') !== 'v1/audio/speech' || request.method !== 'POST') {
          return withCors(Response.json({ error: 'not found' }, { status: 404 }));
        }
        const res = await fetch('https://api.mosi.cn/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': request.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
            'Platform': 'moss-platform',
          },
          body: request.body,
        });
        return withCors(res);
      }
      // 下載 MOSS 產生的音檔（只接受 https 網址）
      const target = url.searchParams.get('u') || '';
      if (!/^https:\/\//.test(target)) return withCors(Response.json({ error: 'bad url' }, { status: 400 }));
      const res = await fetch(target);
      return withCors(new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg' } }));
    }

    // Xmax 即時影片：Key 只放在橋接器（XMAX_API_KEY），網頁把 SDK 的請求轉到 /xmax/<china|global>/<路徑>
    // 只放行 SDK 會用到的幾條：建立／關閉／心跳 session、上傳參考圖的臨時憑證；/xmax/probe 回報 Key 屬於哪個環境
    if (parts[0] === 'xmax') {
      const relaySecret = request.headers.get('X-Relay-Secret') || '';
      if (!env.RELAY_SECRET || !relaySecret || !(await safeEqual(relaySecret, env.RELAY_SECRET))) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      if (!env.XMAX_API_KEY) return withCors(Response.json({ error: '橋接器還沒設定 XMAX_API_KEY' }, { status: 500 }));
      // us 是海外即時模型（x2.1.1-preview-us）實際打的主機，跟 global 不同
      const bases = { china: 'https://cloud.xmax.22duck.cn/open/api/v1', global: 'https://api.xmax.cloud/open/api/v1', us: 'https://api.xmax.ai/open/api/v1' };
      // 貼 Key 時容易連 export XMAX_API_KEY= 或引號一起貼進去，先剝掉
      const rawKey = env.XMAX_API_KEY;
      const apiKey = rawKey.trim().replace(/^export\s+/, '').replace(/^XMAX_API_KEY\s*=\s*/, '').replace(/^["']|["']$/g, '').trim();
      const xmaxFetch = (base, path, init = {}) =>
        fetch(`${base}/${path}`, {
          ...init,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': apiKey, 'X-Platform': 'web' },
        });
      if (parts[1] === 'probe') {
        // 只回狀態和 Key 的外形（長度、有沒有被剝掉東西），不回內容
        const out = { key: { length: apiKey.length, rawLength: rawKey.length, cleaned: apiKey !== rawKey, hasSpace: /\s/.test(apiKey) } };
        for (const [name, base] of Object.entries(bases)) {
          try {
            const res = await xmaxFetch(base, 'cos/sts');
            const body = await res.json().catch(() => ({}));
            out[name] = { status: res.status, code: body.code ?? null, message: body.message || body.msg || null };
          } catch (e) {
            out[name] = { error: e.message };
          }
        }
        return withCors(Response.json(out));
      }
      const base = bases[parts[1]];
      const rest = parts.slice(2).join('/');
      if (!base || !/^(cos\/sts|session|session\/[\w-]+|session\/[\w-]+\/heartbeat)$/.test(rest)) {
        return withCors(Response.json({ error: 'not found' }, { status: 404 }));
      }
      const res = await xmaxFetch(base, rest, {
        method: request.method,
        body: ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined,
      });
      return withCors(new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } }));
    }

    // 會客室的訪客：/mcp/guest/<訪客代碼>
    if (parts[0] === 'mcp' && parts[1] === 'guest') {
      if (!env.RELAY_SECRET || !parts[2] || !(await safeEqual(parts[2], await guestToken(env)))) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      return handleMcp(request, env, true, 'guest');
    }

    // claude.ai 自訂連接器無法帶 header，所以也接受 /mcp/<secret>
    let secret = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (parts[0] === 'mcp' && parts[1]) secret = parts[1];

    if (!env.RELAY_SECRET || !secret || !(await safeEqual(secret, env.RELAY_SECRET))) {
      return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    // /mcp/<secret>/<角色代碼>：這個角色專屬的聊天頻道
    if (parts[0] === 'mcp') {
      const who = parts[0] === 'mcp' && parts[1] && parts[2] ? parts[2].toLowerCase() : '';
      if (who && !/^[a-z0-9]{1,24}$/.test(who)) return withCors(Response.json({ error: 'bad persona' }, { status: 400 }));
      return handleMcp(request, env, false, who ? `chat-${who}` : 'chat');
    }
    // App 用來顯示訪客網址（要帶橋接密碼才拿得到）
    if (parts[0] === 'guest-token') return withCors(Response.json({ token: await guestToken(env) }));

    // 排查用：每個「替他想」的角色現在的狀態（不含 Key）
    if (parts[0] === 'app' && parts[1] === 'agent-status') {
      const [{ agents }, cfg] = await Promise.all([settingsOp(env, 'agent/list'), settingsOp(env, 'settings/get')]);
      return withCors(Response.json({
        bark: !!cfg.bark,
        wake: cfg.wake || null,
        agents: agents.map(a => ({
          id: a.id, name: a.name, model: a.model, hasKey: !!a.key, history: a.history?.length || 0,
          seenAgoMin: a.seenAt ? Math.round((Date.now() - a.seenAt) / 60000) : null,
          lastThinkAt: a.lastThinkAt || null, lastChatAt: a.lastChatAt || null, lastError: a.lastError || null,
        })),
      }));
    }
    if (parts[0] === 'app' && parts[1] === 'agent' && request.method === 'POST') {
      return withCors(await settingsRoom(env).fetch('https://room/agent/set', { method: 'POST', body: request.body }));
    }
    if (parts[0] === 'app' && parts[1] === 'settings' && request.method === 'POST') {
      const res = await settingsRoom(env).fetch('https://room/settings/set', { method: 'POST', body: request.body });
      return withCors(res);
    }

    // 一起聽歌：汽水音樂的分享連結、歌曲編號 → 歌名、歌手、歌詞、音檔（網頁連不到抖音，由這裡代查）
    if (parts[0] === 'app' && parts[1] === 'music') {
      try {
        return withCors(Response.json(await resolveMusic(url.searchParams.get('q') || '')));
      } catch (e) {
        return withCors(Response.json({ error: e.message }, { status: 400 }));
      }
    }

    if (parts[0] === 'app' && parts[1]) {
      const ch = url.searchParams.get('ch');
      const res = await room(env, ch).fetch(`https://${roomHost(ch)}/app/${parts[1]}${url.search}`, {
        method: request.method,
        body: request.method === 'POST' ? request.body : undefined,
      });
      if (parts[1] === 'portrait' && res.ok) {
        const { token } = await res.json();
        return withCors(Response.json({ ok: true, url: `${url.origin}/portrait/${token}.jpg` }));
      }
      return withCors(res);
    }

    return withCors(Response.json({ error: 'not found' }, { status: 404 }));
  },
};
