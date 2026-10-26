'use strict';
// 本機自喚醒：到了設定的時間，或很久沒聊天，他會主動傳訊息來。
// App 沒開的時候手機不能跑 AI，所以到時間先跳一則系統通知；點開 App 時，他才把真正的訊息寫好傳來。
// App 開著的話每分鐘檢查一次，到時間直接傳。
const WAKE_STALE_HOURS = 3; // 錯過太久的時間點就算了，不補傳
const NOTIFY_BASE = 7100; // 通知 id 的起點，跟其他通知分開

function wakeCfg() {
  return (saved.wake ||= { enabled: false, times: ['08:30', '22:30'], who: [], idleHours: 0, done: {} });
}
function wakeWho() {
  const w = wakeCfg();
  return w.who.filter((id) => saved.personas[id] && connReady(saved.personas[id].conn));
}
function hm(date) {
  return date.toTimeString().slice(0, 5);
}

// 他主動傳一則訊息
async function wakeUp(id, reason) {
  const p = saved.personas[id];
  const me = saved.profile.name;
  const hint = `（這不是${me}傳來的訊息：${reason}。主動傳一則訊息給${me}，像平常想到她那樣自然，一兩句就好。不要提到這段說明。）`;
  if (p.conn.mode === 'mcp') {
    relayPost(p.conn, `[自喚醒] ${reason}，可以主動用 chat_reply 找${me}。`).catch(() => {});
    return;
  }
  try {
    const text = await askAs(
      id,
      systemPrompt(id, id),
      [...historyFor(id, id), { role: 'user', content: hint }],
      {
        room: id,
      },
    );
    await personaSay(id, id, text, { via: 'wake' });
  } catch (e) {
    toast(`${personaName(id)}想找妳但沒連上：${e.message}`);
  }
}

let waking = false;
async function checkWake() {
  const w = wakeCfg();
  if (!w.enabled || waking) return;
  waking = true;
  try {
    const now = new Date(),
      day = today();
    for (const time of w.times) {
      const [h, m] = time.split(':').map(Number);
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      const key = `${day} ${time}`;
      if (at > now || w.done[key] || now - at > WAKE_STALE_HOURS * 3600000) continue;
      w.done[key] = Date.now();
      save('wake');
      for (const id of wakeWho()) await wakeUp(id, `現在是 ${time}，到了你設定要主動找她的時間`);
    }
    // 很久沒聊天：從最後一則訊息算起
    if (w.idleHours > 0) {
      for (const id of wakeWho()) {
        const last = saved['msgs:' + id].at(-1)?.at || 0;
        const idleKey = `idle:${id}`;
        if (last && Date.now() - last > w.idleHours * 3600000 && (w.done[idleKey] || 0) < last) {
          w.done[idleKey] = Date.now();
          save('wake');
          await wakeUp(id, `你們已經 ${Math.floor((Date.now() - last) / 3600000)} 小時沒聊天了`);
        }
      }
    }
    // 只留這個月的紀錄
    for (const k of Object.keys(w.done))
      if (!k.startsWith('idle:') && k.slice(0, 10) < today().slice(0, 8) + '01') delete w.done[k];
  } finally {
    waking = false;
  }
}

// App 關著時的系統通知（只有 App 版才有）
function notifier() {
  return window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.LocalNotifications;
}
async function scheduleWakeNotifications() {
  const ln = notifier();
  if (!ln) return;
  const w = wakeCfg();
  try {
    const pending = await ln.getPending();
    const ours = pending.notifications.filter((n) => n.id >= NOTIFY_BASE && n.id < NOTIFY_BASE + 100);
    if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    const who = wakeWho();
    if (!w.enabled || !who.length) return;
    if ((await ln.requestPermissions()).display !== 'granted') {
      toast('沒有通知權限，App 關著的時候他叫不醒妳');
      return;
    }
    const names = who.map(personaName).join('、');
    await ln.schedule({
      notifications: w.times.map((time, i) => {
        const [hour, minute] = time.split(':').map(Number);
        return {
          id: NOTIFY_BASE + i,
          title: names,
          body: '想妳了，打開看看我說了什麼',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        };
      }),
    });
  } catch (e) {
    toast('通知排不進去：' + e.message);
  }
}

// ─── 設定面板 ─────────────────────────────────
function openWakeSettings() {
  const w = wakeCfg();
  const people = memberIds();
  openSheet(
    '自喚醒',
    `<label class="field row" style="gap:8px"><input id="wake-on" type="checkbox" ${w.enabled ? 'checked' : ''}>開啟自喚醒</label>
<div class="field">誰會主動找妳${people.map((id) => `<label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" data-wake-who="${id}" ${w.who.includes(id) ? 'checked' : ''}>${avatar(id, 26)}${escapeHTML(personaName(id))}${connReady(saved.personas[id].conn) ? '' : '<small class="muted">（還沒接上 AI）</small>'}</label>`).join('')}</div>
<div class="field">每天固定時間<div class="wake-times">${[0, 1, 2].map((i) => `<input class="form-input" type="time" data-wake-time value="${w.times[i] || ''}">`).join('')}</div><small class="muted">留空的不算</small></div>
<label class="field">很久沒聊天就主動找妳（小時，0 是關掉）<input id="wake-idle" class="form-input" type="number" min="0" max="72" value="${w.idleHours}"></label>
<div class="setting-title">Bark 推播（iPhone 用）</div><label class="field">Bark Key<input id="wake-bark" class="form-input" type="password" autocomplete="off" placeholder="${w.barkSet ? '已設定，要換才填；清空請填 -' : 'Bark App 裡網址中間那一段'}"></label><p class="sheet-note">填了之後：到了上面設定的時間，就算 App 關著，橋接器也會推「想妳了」到妳的 iPhone，點開 App 他才把真正的話寫好傳來；用 MCP 橋接的他在 App 沒開著時傳訊息，也會推給妳。直接 API 的他：App 關著時橋接器會替他想要不要找妳（到了上面的時間、或很久沒聊天），想說話就寫好推過來；為此他的 Key、人設和最近聊天會存一份在妳自己的橋接器上。</p>
<p class="sheet-note">App 開著時，到時間他會直接傳訊息來。App 關著時會先跳通知，點開之後他才寫好傳來。用 MCP 橋接的他，會收到「可以主動找妳」的提醒，由他自己決定說什麼。</p><button class="primary-action gold" data-action="wake-save">存好</button>`,
  );
}
function saveWake() {
  const w = wakeCfg();
  w.enabled = document.querySelector('#wake-on').checked;
  w.who = [...document.querySelectorAll('[data-wake-who]:checked')].map((x) => x.dataset.wakeWho);
  w.times = [...document.querySelectorAll('[data-wake-time]')]
    .map((x) => x.value)
    .filter(Boolean)
    .sort();
  w.idleHours = Math.max(0, Math.min(72, Number(document.querySelector('#wake-idle').value) || 0));
  save('wake');
  scheduleWakeNotifications();
  saveBark(document.querySelector('#wake-bark').value.trim());
  closeSheet();
  render(page);
  toast(w.enabled ? '自喚醒開好了' : '自喚醒關掉了');
}
// Bark Key 交給自己的橋接器保管，App 不留；順便告訴它每個人的名字和 App 網址，推播才知道標題和要打開哪裡
async function saveBark(key) {
  const relay = memoryRelay();
  if (!key && !relay) return;
  if (!relay) {
    toast('要先有一個角色填好橋接網址和密碼，才能設定 Bark');
    return;
  }
  const names = Object.fromEntries(Object.keys(saved.personas).map((id) => [id, personaName(id)]));
  const url = window.Capacitor?.isNativePlatform?.() ? relay.url + '/' : location.origin + location.pathname;
  try {
    const res = await fetch(relay.url + '/app/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + relay.secret },
      body: JSON.stringify({
        names,
        url,
        // 時間表也交給橋接器：iPhone 的 App 關著時，由它到點推 Bark
        wake: {
          enabled: wakeCfg().enabled,
          times: wakeCfg().times,
          who: wakeWho(),
          idleHours: wakeCfg().idleHours,
          tz: new Date().getTimezoneOffset(),
        },
        ...(key ? { bark: key === '-' ? '' : key } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    wakeCfg().barkSet = data.bark;
    save('wake');
    syncAgents();
    if (key) toast(data.bark ? 'Bark 設好了' : 'Bark 已清除');
  } catch (e) {
    toast('Bark 沒設定成功：' + e.message);
  }
}
function wakeSummary() {
  const w = wakeCfg();
  if (!w.enabled) return '關閉';
  const who = wakeWho().map(personaName).join('、') || '還沒選人';
  return `${who}・${w.times.join('、') || '不定時'}${w.idleHours ? `・${w.idleHours} 小時沒聊就找妳` : ''}`;
}

setInterval(checkWake, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkWake();
});

// ─── App 關著時也能主動找妳（直接 API 的他） ──────────
// 把他的人設、記憶、最近聊天和模型設定同步到自己的橋接器；App 關著時橋接器替他想要不要找妳，想說話就推 Bark
function agentIds() {
  const w = wakeCfg();
  return w.enabled && w.barkSet ? wakeWho().filter((id) => saved.personas[id].conn.mode === 'api') : [];
}
async function syncAgents(leaving = false) {
  const relay = memoryRelay();
  if (!relay) return;
  const on = agentIds();
  const post = (body) =>
    fetch(relay.url + '/app/agent', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + relay.secret },
      body: JSON.stringify(body),
    }).catch(() => {});
  // 離開 App 時手機隨時會把頁面停掉，只送一句「她走了」，不等記憶庫
  if (leaving) {
    for (const id of on) post({ id, enabled: true, leaving: true });
    return;
  }
  for (const id of Object.keys(saved.personas)) {
    const c = saved.personas[id].conn;
    if (!on.includes(id)) {
      if (c.mode === 'api') post({ id, enabled: false });
      continue;
    }
    let mem = '';
    try {
      mem = await memoryContext(id);
    } catch {}
    const history = historyFor(id, id, false)
      .slice(-20)
      .map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 500) : '' }));
    post({
      id,
      enabled: true,
      name: personaName(id),
      base: c.base,
      key: c.key,
      model: c.model,
      system: systemPrompt(id, id) + (mem ? `\n\n${mem}` : ''),
      history,
      lastChatAt: saved['msgs:' + id].at(-1)?.at || 0,
    });
  }
}
// 他在 App 關著時寫的話，打開 App 時收進聊天室
async function pullAgentMessages() {
  const relay = memoryRelay();
  if (!relay) return;
  for (const id of agentIds()) {
    const key = `seq:${id}:chat-${id}`;
    const after = saved[key] ?? 0;
    try {
      const res = await fetch(`${relay.url}/app/replies?ch=chat-${id}&after=${after}&wait=0`, {
        headers: { Authorization: 'Bearer ' + relay.secret },
      });
      const data = await res.json();
      if (data.last_seq < after) {
        saved[key] = 0;
        continue;
      }
      for (const r of data.replies || []) await personaSay(id, id, r.text, { at: r.at, via: 'wake' });
      if (data.last_seq !== after) {
        saved[key] = data.last_seq;
        save(key);
      }
    } catch {}
  }
}
setInterval(syncAgents, 5 * 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) syncAgents(true);
  else pullAgentMessages();
});
