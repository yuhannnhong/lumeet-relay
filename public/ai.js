'use strict';
// 跟 AI 說話的兩種接法：
// api：直接打 OpenAI 相容的 /chat/completions（官方或中轉站）
// mcp：訊息丟進使用者自己的 mcp-relay，住在 Claude / ChatGPT 裡的他用 chat_wait_message 取走、chat_reply 回覆
const HISTORY_LIMIT = 40;

// 家人（不含會客室的訪客）
function memberIds() {
  return Object.keys(saved.personas).filter((id) => id !== 'guest');
}
// 群聊名字她可以自己改，沒改就叫三人世界（橋接器上的 [三人世界] 標記是給 AI 看的格式，不跟著改）
function groupName() {
  return saved.groupName || '三人世界';
}
// 群聊的成員：新增的角色預設不進群，要在他的面板裡勾
function groupIds() {
  return memberIds().filter((id) => saved.personas[id].inGroup !== false);
}
function rooms() {
  return [...memberIds(), 'group', 'guest'];
}
function personaName(id) {
  return id === 'me' ? saved.profile.name : saved.personas[id]?.name || id;
}
function systemPrompt(id, room) {
  const p = saved.personas[id],
    me = saved.profile.name;
  const others = groupIds()
    .filter((x) => x !== id)
    .map(personaName);
  return [
    `你是${p.name}。`,
    p.persona,
    p.memory && `你記得的事：\n${p.memory}`,
    room === 'group'
      ? `現在在群聊「${groupName()}」，成員有${me}、${others.join('、')}和你。別人的訊息前面標了是誰說的。你只代表${p.name}自己說話：不要替別人回答，也不要用${me}或其他人的口吻說話，回覆前面不用加名字。`
      : room === 'guest'
        ? `你是來 Lumeet 小家作客的客人，現在在會客室跟${me}聊天。`
        : room === 'home'
          ? `現在在你們的小家（App 裡一起生活的空間）。`
          : `現在在跟${me}私聊。`,
    todayMood() && `${me}今天的心情：${todayMood()}`,
    periodNote(),
    aiManual(id),
    '這是手機聊天，像傳訊息一樣自然、簡短。想分幾則說就換行，每一行會變成一則訊息泡泡，一則不要太長。',
    `現在時間：${new Date().toLocaleString('zh-TW', { hour12: false })}`,
    // 放最後面，最不會被忽略
    room !== 'group' && p.inGroup !== false && groupDigest(id),
  ]
    .filter(Boolean)
    .join('\n\n');
}
// 私聊時也讓他知道群聊最近在聊什麼（他也是群裡的人，問起來不會說看不到）
function groupDigest(id) {
  const recent = (saved['msgs:group'] || []).slice(-12);
  if (!recent.length) return '';
  const lines = recent.map((m) => `${m.from === id ? '你' : personaName(m.from)}：${m.text.replace(/\s+/g, ' ').slice(0, 80)}`);
  return `【群聊同步】你也在群聊「${groupName()}」裡。下面是群裡最新的對話，App 每次都會即時附上給你（就算你之前說過看不到，現在已經看得到了）。${saved.profile.name}問起群裡的事，就照這裡回答，不要說沒收到：\n${lines.join('\n')}`;
}
// 聊天紀錄轉成 API 的 messages：自己說的是 assistant，其他人（含群聊裡的另一個他）都是 user
function historyFor(id, room, images = true) {
  const list = saved['msgs:' + room].slice(-HISTORY_LIMIT);
  const conn = saved.personas[id].conn;
  // 看得懂圖的他，最近幾張照片直接附圖；其他的用識圖模型寫好的描述
  const recent = new Set(
    images && conn.mode !== 'mcp' && seesImages(conn)
      ? list.filter((m) => m.image && m.from !== id && !m.sticker).slice(-IMAGE_LIMIT)
      : [],
  );
  return list.map((m) => {
    const text = room === 'group' && m.from !== id ? `${personaName(m.from)}：${m.text}` : m.text;
    // 他自己寫記憶、用記憶庫的結果附在他的話後面，讓他知道有沒有寫成功
    const done = m.from === id && m.noted?.length ? `\n［系統回報：${m.noted.join('；')}］` : '';
    return {
      role: m.from === id ? 'assistant' : 'user',
      content: mediaContent(id, m, text + done, recent.has(m)),
    };
  });
}
async function askApiRaw(conn, system, messages, tools) {
  const res = await fetch(conn.base.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + conn.key },
    body: JSON.stringify({
      model: conn.model,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(tools ? { tools } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(data.error?.message || `HTTP ${res.status}`), { status: res.status });
  return data.choices?.[0]?.message || {};
}
async function askApi(conn, system, messages) {
  const text = (await askApiRaw(conn, system, messages)).content?.trim();
  if (!text) throw new Error('AI 回了空白');
  return text;
}
// 以某個角色的身分問：帶上他的記憶；接了記憶庫 MCP 的話，讓他可以自己呼叫記憶庫的工具
async function askAs(id, system, messages, ctx) {
  delete noted[id];
  const conn = saved.personas[id].conn;
  const mem = await memoryContext(id);
  const sys = mem ? `${system}\n\n${mem}` : system;
  const tools = [...builtinToolSpecs(), ...((await memoryToolSpecs(id)) || [])];
  if (!tools.length) return takeMemories(id, await askApi(conn, sys, messages));
  const msgs = [...messages];
  for (let round = 0; round < 4; round++) {
    let msg;
    try {
      msg = await askApiRaw(conn, sys, msgs, tools);
    } catch (e) {
      // 有些模型或中轉站不支援工具，退回一般聊天
      if (e.status === 400 && round === 0) return takeMemories(id, await askApi(conn, sys, messages));
      throw e;
    }
    if (!msg.tool_calls?.length) {
      const text = msg.content?.trim();
      if (!text) throw new Error('AI 回了空白');
      return takeMemories(id, text);
    }
    msgs.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      let out;
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        out = await runBuiltinTool(id, call.function.name, args, ctx);
        if (out === null) {
          out = await runMemoryTool(id, call.function.name, args);
          (noted[id] ||= []).push(`✓ ${call.function.name}`);
        }
      } catch (e) {
        out = '錯誤：' + e.message;
        (noted[id] ||= []).push(`✗ ${call.function.name}：${e.message}`);
        logError(`${personaName(id)}・${call.function.name}`, e.message);
      }
      msgs.push({ role: 'tool', tool_call_id: call.id, content: out || '（沒有內容）' });
    }
  }
  return takeMemories(id, await askApi(conn, sys, msgs));
}
function relayFetch(conn, path, body) {
  return fetch(conn.relay.replace(/\/+$/, '') + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + conn.secret },
    body: body && JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 401 ? '橋接密碼不對' : data.error || `HTTP ${res.status}`);
    return data;
  });
}
// 會客室的訪客走橋接器的 guest 頻道，跟家人的 chat 頻道分開
// 頻道直接由角色代碼決定（chat-<代碼>），不靠存著的設定，舊設定也不會跑回共用的 chat
function relayChannel(conn) {
  const id =
    Object.keys(saved.personas).find((k) => saved.personas[k].conn === conn) ??
    (typeof editingPersona === 'string' ? editingPersona : null);
  if (id === 'guest' || conn.channel === 'guest') return 'guest';
  return id ? `chat-${id}` : conn.channel || 'chat';
}
function relayPost(conn, text) {
  return relayFetch(conn, `/app/event?ch=${relayChannel(conn)}`, { type: 'message', text });
}

// MCP 的他隨時可能傳訊息來（包括主動找妳），所以 App 開著就一直收
const listening = new Set();
async function listenRelay(id) {
  if (listening.has(id)) return;
  listening.add(id);
  // 住在 Claude／ChatGPT 的他看不到這邊的系統提示：開 App 時把最新說明書存到他的頻道，他用 lumeet_manual 隨時讀
  const conn0 = saved.personas[id].conn;
  relayFetch(conn0, `/app/manual?ch=${relayChannel(conn0)}`, { text: aiManual(id) }).catch(() => {});
  let failures = 0;
  while (saved.personas[id]?.conn.mode === 'mcp') {
    const conn = saved.personas[id].conn;
    try {
      // 編號跟著頻道記：換頻道就從頭收，App 關著時他傳的話也會補進來（橋接器會留著）
      const key = `seq:${id}:${relayChannel(conn)}`;
      const after = saved[key] ?? 0;
      const data = await relayFetch(conn, `/app/replies?ch=${relayChannel(conn)}&after=${after}&wait=25`);
      failures = 0;
      // 橋接器重置過，編號會從 0 重新算
      if (data.last_seq < after) {
        saved[key] = 0;
        continue;
      }
      for (const r of data.replies) {
        const room = r.room === 'group' ? 'group' : id;
        await personaSay(room, id, r.text, { at: r.at });
        if (room === 'group') {
          forwardToRelays(id, r.text);
          // MCP 的他自己在群裡開口：直接 API 的他也有一次機會接話（他可以選擇不接）
          followUpsLeft = Math.max(followUpsLeft, 1);
          groupFollowUp(id);
        }
      }
      if (data.last_seq !== after) {
        saved[key] = data.last_seq;
        save(key);
      }
    } catch {
      failures++;
      await new Promise((r) => setTimeout(r, Math.min(failures, 6) * 5000));
    }
  }
  listening.delete(id);
}
// 群聊裡別人說的話，也轉給 MCP 的他，讓他知道群裡在聊什麼
function forwardToRelays(from, text) {
  for (const id of groupIds()) {
    const conn = saved.personas[id].conn;
    if (id !== from && conn.mode === 'mcp')
      relayPost(conn, `[三人世界] ${personaName(from)}：${text}`).catch(() => {});
  }
}

function connReady(conn) {
  return conn.mode === 'mcp' ? !!(conn.relay && conn.secret) : !!(conn.base && conn.key && conn.model);
}
// 妳傳了訊息之後，誰該回、怎麼回
// 群聊裡他們互相接話：妳說一句之後，他們之間最多再多接 FOLLOW_UPS 句，不會聊到停不下來
const FOLLOW_UPS = 2;
const PASS = '[PASS]';
let followUpsLeft = 0,
  groupBusy = false;
async function groupFollowUp(lastFrom) {
  if (groupBusy) return;
  groupBusy = true;
  try {
    let from = lastFrom;
    while (followUpsLeft > 0) {
      const next = groupIds().find(
        (id) => id !== from && saved.personas[id].conn.mode === 'api' && connReady(saved.personas[id].conn),
      );
      if (!next) break;
      followUpsLeft--;
      if (!(await replyViaApi(next, 'group', true))) break;
      from = next;
    }
  } finally {
    groupBusy = false;
  }
}

// 等妳說完再回：妳連傳好幾則時，停手幾秒才一起讀、一起回，只叫一次 AI（省 token，也比較像真人）
// 只管直接接 API 的；MCP 的他自己決定什麼時候讀
const REPLY_WAIT_DEFAULT = 6;
const REPLY_WAIT_CHOICES = [0, 3, 6, 10, 20];
const pendingReplies = {};
function replyWaitSeconds() {
  return saved.replyWait ?? REPLY_WAIT_DEFAULT;
}
function laterReply(room, fn) {
  clearTimeout(pendingReplies[room]?.timer);
  const ms = replyWaitSeconds() * 1000;
  if (!ms) {
    delete pendingReplies[room];
    return fn();
  }
  const run = () => {
    delete pendingReplies[room];
    fn();
  };
  pendingReplies[room] = { fn: run, timer: setTimeout(run, ms) };
}
// 她還在打字：再等一下，別打斷她
function stillTyping(room) {
  const p = pendingReplies[room];
  if (!p) return;
  clearTimeout(p.timer);
  p.timer = setTimeout(p.fn, replyWaitSeconds() * 1000);
}

async function respond(room, text) {
  if (room === 'group') {
    followUpsLeft = FOLLOW_UPS;
    forwardToRelays('me', text);
    laterReply('group', async () => {
      groupBusy = true;
      let last = null;
      try {
        for (const id of groupIds()) {
          const conn = saved.personas[id].conn;
          if (conn.mode === 'api' && connReady(conn) && (await replyViaApi(id, room))) last = id;
        }
      } finally {
        groupBusy = false;
      }
      if (last) groupFollowUp(last);
    });
    if (!groupIds().some((id) => connReady(saved.personas[id].conn)))
      toast('還沒有人接上 AI，到設定裡幫他們接上');
    return;
  }
  const conn = saved.personas[room].conn;
  if (!connReady(conn)) {
    toast(`${personaName(room)}還沒接上 AI，到設定 → 角色 → 他的頁面選怎麼接進來`);
    return;
  }
  if (conn.mode === 'mcp') {
    relayPost(conn, `${room === 'guest' ? '[會客室]' : '[私聊]'} ${text}`).catch((e) => {
      logError(`${personaName(room)}・橋接器`, e.message);
      toast('傳不到橋接器：' + e.message);
    });
    listenRelay(room);
  } else laterReply(room, () => replyViaApi(room, room));
}
// 回傳有沒有真的說話。optional：群裡別人剛說完，他可以選擇不接
async function replyViaApi(id, room, optional = false) {
  showTyping(room, id);
  try {
    const system =
      systemPrompt(id, room) +
      (optional ? `\n\n剛剛是群裡其他人在說話。想接就自然接一句；沒什麼好接的，就只回 ${PASS}。` : '');
    let text;
    try {
      text = await askAs(id, system, historyFor(id, room), { room });
    } catch (e) {
      // 模型其實看不懂圖：拿掉附圖、改用文字描述再問一次
      const hist = historyFor(id, room);
      if (e.status !== 400 || !hist.some((m) => Array.isArray(m.content))) throw e;
      text = await askAs(id, system, historyFor(id, room, false), { room });
    }
    if (optional && text.includes(PASS)) return false;
    await personaSay(room, id, text);
    if (room === 'group') forwardToRelays(id, text);
    return true;
  } catch (e) {
    logError(`${personaName(id)}・聊天`, e.message);
    toast(`${personaName(id)}沒回成：${e.message}`);
    return false;
  } finally {
    hideTyping(room, id);
  }
}
async function testConn(conn) {
  if (conn.mode === 'mcp') {
    const s = await relayFetch(conn, `/app/replies?ch=${relayChannel(conn)}&after=999999999&wait=0`);
    return `橋接器連上了（目前訊息編號 ${s.last_seq}）。記得跟他說「進入 Lumeet 聊天模式」`;
  }
  const reply = await askApi(conn, '用一句話打招呼。', [{ role: 'user', content: '測試連線' }]);
  return '連上了：' + reply.slice(0, 60);
}
