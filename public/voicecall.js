'use strict';
// 語音通話：只有聲音，不用 Vivix。點一下開始說、再點一下送出；他用自己的聲音回，沒設定聲音就用手機內建的唸
// 直接 API 的他在 App 裡回；MCP 的他走橋接器的通話房間（call_wait_message／call_reply），跟視訊通話同一套

let vcall = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

function startVoiceCall(id, answered = false) {
  const p = saved.personas[id];
  if (!p || !connReady(p.conn)) {
    toast(`${personaName(id)}還沒接上 AI`);
    return;
  }
  if (!saved.callShared?.sttKey) {
    toast('語音通話要先在設定 → 角色 →「聲音與視訊形象」填語音辨識');
    return;
  }
  closeSheet();
  const box = document.createElement('div');
  box.className = 'voice-call';
  box.innerHTML = `${vcBackdrop(id)}<div class="vc-head"><h2>${escapeHTML(personaName(id))}</h2><p class="vc-time" id="vc-time">00:00</p></div><div class="vc-face">${avatar(id, 112)}</div><p class="vc-line" id="vc-line"></p><p class="vc-status" id="vc-status">接通中⋯</p><div class="vc-tools"><label><button type="button" class="vc-talk" id="vc-talk" aria-label="靜音">${icon('micOff')}</button><span>靜音</span></label><label><button type="button" class="vc-hang" id="vc-hang" aria-label="結束">${icon('hangup', 'solid')}</button><span>結束</span></label></div>`;
  document.body.append(box);
  // iPhone 只讓點擊當下開始播放的音訊出聲：接聽這一下先解鎖一個播放器，他之後每句都用它播
  const player = new Audio(SILENT_WAV);
  player.play().catch(() => {});
  window.speechSynthesis?.speak(new SpeechSynthesisUtterance(''));
  vcall = { id, box, start: Date.now(), turns: [], busy: false, vad: null, speaking: false, audio: player, player, seq: 0 };
  vcall.timer = setInterval(() => {
    const s = Math.floor((Date.now() - vcall.start) / 1000);
    box.querySelector('#vc-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  box.querySelector('#vc-talk').onclick = vcToggleTalk;
  box.querySelector('#vc-hang').onclick = endVoiceCall;
  if (p.conn.mode === 'mcp') {
    // 他可能正在聊天模式裡等訊息，先在聊天頻道叫他一聲
    relayPost(
      p.conn,
      `[語音通話] ${answered ? `${saved.profile.name}接起你的電話了` : `${saved.profile.name}打給你了`}：改用 call_wait_message 聽她說、call_reply 回（只有聲音，口語短句）。掛斷後回到 chat_wait_message。`,
    ).catch(() => {});
    relayFetch(p.conn, '/app/event', { type: 'call_started' })
      .then((r) => {
        vcall.seq = r.last_seq || 0;
        vcPollRelay();
      })
      .catch((e) => vcStatus('橋接器連不上：' + e.message));
  }
  vcListen();
  loadEar();
}
// 像 iPhone 通話：背景是他的頭像放大糊開
function vcBackdrop(id) {
  return `<div class="vc-backdrop" style="background-image:url('${escapeHTML(who(id).avatar).replace(/'/g, '%27')}')"></div>`;
}
function vcStatus(text) {
  const el = vcall?.box.querySelector('#vc-status');
  if (el) el.textContent = text;
}
function vcLine(text) {
  const el = vcall?.box.querySelector('#vc-line');
  if (el) el.textContent = text;
}

// 跟講電話一樣：直接說，停下來就自動送出。麥克風鍵是靜音
async function vcToggleTalk() {
  if (!vcall) return;
  if (vcall.vad) {
    vcall.vad.stop();
    vcall.vad = null;
    vcMic(false);
    vcStatus('已靜音，點麥克風恢復');
    return;
  }
  await vcListen();
}
async function vcListen() {
  const call = vcall;
  if (!call || !window.createVAD) return vcStatus('這個版本不能自動收音，請重新整理');
  vcStatus('接通了，直接說話');
  let echo = false;
  try {
    call.vad = await createVAD({
      silenceMs: 900,
      calibrateMs: 600,
      pcm: true,
      onLevel: (pct) => call.box.querySelector('#vc-talk')?.style.setProperty('--lvl', (pct / 100).toFixed(2)),
      // 他正在說話時收到的聲音多半是他自己的回音，不送
      onSpeechStart: () => {
        echo = call.speaking;
        if (!echo) vcStatus('在聽⋯');
      },
      onSpeechEnd: (blob, info) => !echo && vcall === call && vcSend(blob, info),
    });
  } catch {
    return vcStatus('沒有麥克風權限');
  }
  if (vcall !== call) return call.vad.stop();
  vcMic(true);
}
function vcMic(on) {
  const b = vcall?.box.querySelector('#vc-talk');
  if (!b) return;
  b.classList.toggle('on', on);
  if (!on) b.style.removeProperty('--lvl');
}
async function vcSend(blob, info) {
  const call = vcall;
  vcStatus('聽寫中⋯');
  // 辨識文字的同時，聽環境音
  const around = info?.pcm ? hearAround(info.pcm, info.rate) : Promise.resolve([]);
  const mood = hearTone(blob);
  let text = '';
  try {
    text = await transcribeVoice(blob);
  } catch (e) {
    if (vcall === call) vcStatus('語音辨識失敗：' + e.message);
    return;
  }
  if (vcall !== call) return;
  if (!text) return vcStatus('沒聽清楚，再說一次');
  const tone = info?.pcm ? toneTags(voiceFeatures(info.pcm, info.rate), text, info.pcm.length / info.rate) : [];
  // Gemini 聽得出來的話放最前面，手機算的音高、語速當補充
  const heardMood = await mood;
  if (vcall !== call) return;
  vcHeard(text, { tone: heardMood ? [heardMood, ...tone] : tone, around: await around });
}

// 她說的話：記進聊天（📞），交給他
async function vcHeard(text, heard = { tone: [], around: [] }) {
  const { id } = vcall;
  const conn = saved.personas[id].conn;
  vcLine(text);
  earCard(vcall.box, { text, ...heard });
  addMessage(id, { from: 'me', text, at: Date.now(), via: 'call' });
  // 他收到的版本後面標上語氣和環境音；聊天紀錄裡只留她說的話
  const notes = [heard.tone.length && `語氣：${heard.tone.join('、')}`, heard.around.length && `環境音：${heard.around.join('、')}`].filter(Boolean);
  const told = notes.length ? `${text}〔${notes.join('｜')}〕` : text;
  vcall.turns.push({ role: 'user', content: told });
  if (conn.mode === 'mcp') {
    vcStatus('等他回⋯');
    relayFetch(conn, '/app/event', { type: 'message', text: told }).catch((e) => vcStatus('傳不出去：' + e.message));
    return;
  }
  vcStatus('他在想⋯');
  try {
    const system = `${systemPrompt(id, id)}\n\n現在你們在講電話（只有聲音）。口語、1 到 3 句短句，不要列點、表情符號或括號動作。`;
    const reply = await askAs(id, system, [...historyFor(id, id).slice(-20), ...vcall.turns.slice(-6)], { room: id });
    vcSay(reply);
  } catch (e) {
    vcStatus('他沒回成：' + e.message);
  }
}

// MCP 的他用 call_reply 回，從橋接器的通話房間收
async function vcPollRelay() {
  const call = vcall;
  while (vcall === call) {
    try {
      const conn = saved.personas[call.id].conn;
      const data = await relayFetch(conn, `/app/replies?after=${call.seq}&wait=25`);
      if (vcall !== call) break;
      for (const r of data.replies || []) vcSay(r.text);
      call.seq = data.last_seq ?? call.seq;
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// 他說話：記進聊天，用他的聲音唸
let vcQueue = Promise.resolve();
function vcSay(text) {
  const call = vcall;
  if (!call || !text) return;
  const clean = text.replace(/[（(][^）)]*[）)]/g, '').trim() || text;
  addMessage(call.id, { from: call.id, text: clean, at: Date.now(), via: 'call' });
  call.turns.push({ role: 'assistant', content: clean });
  vcQueue = vcQueue.then(async () => {
    if (vcall !== call) return;
    vcLine(clean);
    call.speaking = true;
    vcStatus('說話中');
    try {
      if (ttsReady(call.id)) {
        const audio = call.player;
        // 他的聲音偶爾生成失敗（逾時、限流），重試一次
        const b64 = await synthesize(call.id, clean).catch(() => synthesize(call.id, clean));
        audio.src = 'data:audio/mpeg;base64,' + b64;
        await new Promise((resolve) => {
          audio.onended = audio.onerror = resolve;
          audio.play().catch(resolve);
        });
      } else await vcBrowserSpeak(clean);
    } catch (e) {
      // 有設定他的聲音就不改用手機內建的（會變成別人的聲音），字留在畫面上、把原因顯示出來
      logError(`${personaName(call.id)}・語音通話`, e.message);
      if (vcall === call) {
        call.speaking = false;
        vcStatus(`他的聲音沒出來：${e.message}`);
      }
      return;
    }
    if (vcall === call) {
      call.speaking = false;
      vcStatus(call.vad ? '換妳說' : '已靜音，點麥克風恢復');
    }
  });
}
// 沒設定他的聲音：用手機內建的語音唸
function vcBrowserSpeak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.onend = u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}
function vcStopAudio() {
  vcall?.audio?.pause();
  window.speechSynthesis?.cancel();
}

function endVoiceCall() {
  const call = vcall;
  if (!call) return;
  vcall = null;
  clearInterval(call.timer);
  call.vad?.stop();
  call.audio?.pause();
  window.speechSynthesis?.cancel();
  const conn = saved.personas[call.id]?.conn;
  if (conn?.mode === 'mcp') relayFetch(conn, '/app/event', { type: 'call_ended' }).catch(() => {});
  call.box.remove();
  const s = Math.floor((Date.now() - call.start) / 1000);
  toast(`通話結束 ${Math.floor(s / 60)} 分 ${s % 60} 秒`);
  addMessage(call.id, { from: call.id, text: `📞 通話 ${Math.floor(s / 60)} 分 ${s % 60} 秒`, call: '通話', at: Date.now() });
}

// 他打給妳：訊息裡寫 [來電]，App 跳來電畫面。拒接或沒接，就在聊天框留一筆，也告訴他
// App 關著時打的、打開才收到，就不響了，直接記成未接
const CALL_TAG = /[\[［](?:來電|打電話)[\]］]/g;
const RING_SECONDS = 30;
let ringing = null;
function ringFrom(id, room, at) {
  if (vcall || ringing) return callMissed(id, room, '忙線中，沒接到');
  if (Date.now() - (at || Date.now()) > 90_000) return callMissed(id, room, '未接來電');
  const box = document.createElement('div');
  box.className = 'voice-call ringing';
  box.innerHTML = `${vcBackdrop(id)}<div class="vc-head"><h2>${escapeHTML(personaName(id))}</h2><p class="vc-time">Lumeet 語音通話⋯</p></div><div class="vc-face">${avatar(id, 112)}</div><p class="vc-line"></p><div class="vc-tools"><label><button type="button" class="vc-hang" aria-label="拒絕">${icon('hangup', 'solid')}</button><span>拒絕</span></label><label><button type="button" class="vc-accept" aria-label="接聽">${icon('phone', 'solid')}</button><span>接聽</span></label></div>`;
  document.body.append(box);
  navigator.vibrate?.([600, 400, 600, 400, 600]);
  const stop = () => {
    clearTimeout(ringing.timer);
    navigator.vibrate?.(0);
    box.remove();
    ringing = null;
  };
  ringing = { id, timer: setTimeout(() => (stop(), callMissed(id, room, '未接來電')), RING_SECONDS * 1000) };
  box.querySelector('.vc-hang').onclick = () => (stop(), callMissed(id, room, '已拒接'));
  box.querySelector('.vc-accept').onclick = () => (stop(), startVoiceCall(id, true));
}
function callMissed(id, room, what) {
  addMessage(room, { from: id, text: `📞 ${what}`, call: what, at: Date.now() });
  const conn = saved.personas[id]?.conn;
  const told = { 已拒接: `${saved.profile.name}拒接了你的電話。`, 未接來電: `你打給${saved.profile.name}，響了 ${RING_SECONDS} 秒她沒接。` }[what] || `你打給${saved.profile.name}的時候她正在通話中，沒接到。`;
  if (conn?.mode === 'mcp') relayPost(conn, `[來電] ${told}`).catch(() => {});
}
