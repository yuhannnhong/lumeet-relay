// video.js — AI 視訊通話前端管線
// 流程：使用者語音/文字 → STT → LLM 或 MCP 橋接 → ElevenLabs／MOSS／MiniMax TTS → Vivix 對嘴 → TRTC 視訊

const VIVIX_BASE = 'https://api.vivix.ai/v1';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
// MOSS（OpenMOSS 的語音合成）：中國大陸可直連，海外版帳號也用同一個網址
const MOSS_BASE = 'https://api.mosi.cn/v1';
const DEFAULT_MOSS_MODEL = 'moss-tts-1.5-flash';
// MiniMax 語音合成：中國大陸版和國際版是兩個帳號體系，Key 不通用，網址也不同
const MINIMAX_BASE = { cn: 'https://api.minimaxi.com/v1', intl: 'https://api.minimax.io/v1' };
const DEFAULT_MINIMAX_MODEL = 'speech-2.8-turbo';
const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo';
// 只填 Key 沒填網址時用 Groq（輸入框的灰字範例很容易被當成已經填了）
const DEFAULT_STT_BASE = 'https://api.groq.com/openai/v1';
// multilingual_v2 會自己猜語言，中文常被念歪（你→奶）；v2.5 可以用 language_code 鎖定中文
const DEFAULT_TTS_MODEL = 'eleven_turbo_v2_5';
// 沒填 ElevenLabs 時用 Vivix 內建聲音（Qwen Audio），中國大陸也能用
const DEFAULT_VIVIX_VOICE = 'longanhuan_v3.6';

// 語音合成：設定頁選哪家就用哪家；舊設定沒有這個欄位時，看填了哪家的 Key
function ttsProvider(s = cfg) {
  if (s.ttsProvider) return s.ttsProvider;
  if (s.mossKey) return 'moss';
  if (s.minimaxKey) return 'minimax';
  if (s.elKey) return 'elevenlabs';
  return 'vivix';
}
function useMoss() {
  return ttsProvider() === 'moss' && !!cfg.mossKey;
}
function useMinimax() {
  return ttsProvider() === 'minimax' && !!cfg.minimaxKey;
}
function minimaxRegion(s = cfg) {
  return s.minimaxRegion === 'intl' ? 'intl' : 'cn';
}
function useElevenLabs() {
  return ttsProvider() === 'elevenlabs' && !!cfg.elKey;
}
const TTS_LANG_LOCKABLE = ['eleven_turbo_v2_5', 'eleven_flash_v2_5'];
const DEFAULT_TTS_FIX = ''; // 純淨版不預設；念歪的字由使用者自己在設定加

// 「你=尼」一行一組，只改送去念的文字
function applyTtsFix(text) {
  for (const line of (cfg.elFix || '').split('\n')) {
    const i = line.indexOf('=');
    if (i < 1) continue;
    const from = line.slice(0, i).trim();
    const to = line.slice(i + 1).trim();
    if (from) text = text.split(from).join(to);
  }
  return text;
}
const SHORT_REPLY_HINT = '現在是視訊通話，請用自然口語回覆，1 到 3 句短句，不要列點、表情符號或括號動作。';

// ─── HTTP（App 內走原生請求，避開 CORS） ─────────────────

const cap = window.Capacitor;
const isNativeApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.nativePromise);
// 網頁版（iPhone 用）：按住說話、精簡按鈕
const compactUi = !isNativeApp;

// Vivix 不允許網頁直接呼叫（沒有 CORS），網頁版改由橋接器轉送
function vivixBase() {
  return !isNativeApp && relayBase() ? relayUrl('/vivix/v1') : VIVIX_BASE;
}

function vivixHeaders() {
  const h = { 'Authorization': `Bearer ${cfg.vivixKey}`, 'Content-Type': 'application/json' };
  if (!isNativeApp && relayBase()) h['X-Relay-Secret'] = cfg.relaySecret;
  return h;
}

function parseMaybeJson(data) {
  if (typeof data !== 'string') return data;
  try { return JSON.parse(data); } catch { return data; }
}

function errText(data) {
  const s = typeof data === 'string' ? data : JSON.stringify(data);
  return (s || '').slice(0, 300);
}

// 常見錯誤翻成看得懂的中文：沒錢就說沒錢，Key 錯就說 Key 錯；看不出原因就回傳空字串
const VIVIX_CODE = {
  10001: 'key', 10003: 'key', 10004: 'money', 10005: 'money', 10008: 'busy', 10009: 'perm',
  20016: 'image', 30006: 'concurrency', 30008: 'server',
};

function errCode(data) {
  const c = data?.code ?? data?.error?.code;
  return Number.isFinite(Number(c)) ? Number(c) : null;
}

function errKind(status, data) {
  const s = errText(data).toLowerCase();
  // 橋接（mcp-relay）自己擋下來的：密碼不對，不是 Vivix／MOSS／MiniMax 的 Key 問題
  if (status === 401 && data?.error === 'Unauthorized') return 'relay';
  const vivix = VIVIX_CODE[errCode(data)];
  if (vivix) return vivix;
  if (status === 402 || /insufficient.?(balance|fund|credit|quota)|not enough (credit|balance)|balance|quota_exceeded|exceeded your (current )?quota|余额|餘額|欠费|欠費|arrear|payment required|credits?/.test(s)) return 'money';
  if (/unusual activity|detected_unusual/.test(s)) return 'vpn';
  if (/missing_permission/.test(s)) return 'perm';
  if (status === 401 || /invalid.{0,10}(api.?key|token)|incorrect api key|auth(entication)? failed|unauthorized|invalid_api_key/.test(s)) return 'key';
  if (status === 403) return 'perm';
  if (status === 429) return 'busy';
  if (status >= 500) return 'server';
  return '';
}

function friendlyHint(service, status, data) {
  const raw = errText(data).slice(0, 120);
  const tail = raw ? `（原始訊息：${raw}）` : '';
  switch (errKind(status, data)) {
    case 'money': return `💸 ${service} 沒錢了：餘額或額度用完，到 ${service} 後台儲值`;
    case 'vpn': return `🌐 ${service} 擋下了這次連線：免費方案透過 VPN／代理使用會被拒絕，要付費方案或換別家`;
    case 'perm': return `🚫 ${service} 這把 Key 權限不夠：到後台把${service === 'ElevenLabs' ? '「文字轉語音」和「音色」' : '需要的'}權限打開${tail}`;
    case 'relay': return `🔐 橋接密碼不對：被你的 MCP 橋接擋下來了，不是 ${service} 的 Key 問題。檢查設定裡的「橋接網址」和「橋接密碼」是不是你自己部署印出來的那組`;
    case 'key': return `🔑 ${service} 的 Key 不對：重新複製貼上，前後不要有空格${tail}`;
    case 'busy': return `⏳ ${service} 請求太頻繁：等一下再試`;
    case 'image': return `🖼 ${service} 讀不到角色圖片：確認圖片網址用瀏覽器打得開`;
    case 'concurrency': return `👥 ${service} 同時開了太多通話：先把其他通話掛掉`;
    case 'server': return `🔧 ${service} 那邊的伺服器出問題，不是你的錯：稍後再試${tail}`;
    default: return '';
  }
}

// 網路層錯誤（根本沒收到回應）
function netHint(service, e) {
  const m = String(e?.message || e || '');
  if (/timeout|timed out/i.test(m)) return `🌐 連 ${service} 逾時：網路太慢或被擋，檢查網路或翻牆`;
  return `🌐 連不上 ${service}：網路或翻牆的問題（${m.slice(0, 80)}）`;
}

// 給呼叫失敗用：有對應的白話就用白話，否則附上狀態碼和原始訊息
function apiError(service, status, data) {
  const hint = friendlyHint(service, status, data);
  const err = new Error(hint || `${service} 出錯 (${status})：${errText(data).slice(0, 200)}`);
  err.hint = hint;
  return err;
}

async function httpJson(url, { method = 'GET', headers = {}, body, timeoutMs = 60000 } = {}) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (isNativeApp) {
    const r = await cap.nativePromise('CapacitorHttp', 'request', {
      url, method, headers, data: payload, dataType: 'json',
      connectTimeout: 15000, readTimeout: timeoutMs,
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data: parseMaybeJson(r.data), traceId: traceIdOf(r.headers) };
  }
  const res = await fetch(url, { method, headers, body: payload });
  return { ok: res.ok, status: res.status, data: parseMaybeJson(await res.text()), traceId: res.headers.get('x-trace-id') || '' };
}

// Vivix 客服查問題要 X-Trace-Id，出錯時記進日誌
function traceIdOf(headers) {
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === 'x-trace-id') return String(v);
  }
  return '';
}

async function httpBase64(url, { method = 'POST', headers = {}, body } = {}) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (isNativeApp) {
    const r = await cap.nativePromise('CapacitorHttp', 'request', {
      url, method, headers, data: payload, dataType: 'json', responseType: 'arraybuffer',
      connectTimeout: 15000, readTimeout: 60000,
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data: r.data };
  }
  const res = await fetch(url, { method, headers, body: payload });
  if (!res.ok) return { ok: false, status: res.status, data: await res.text() };
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return { ok: true, status: res.status, data: btoa(bin) };
}

// ─── 設定管理 ───────────────────────────────────────────

const SETTINGS_KEY = 'ai-video-call-settings';
const CONSENT_KEY = 'ai-video-call-consent';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
}

function showTtsProvider(p) {
  for (const k of ['vivix', 'elevenlabs', 'moss', 'minimax']) el(`tts-${k}`).classList.toggle('is-hidden', k !== p);
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function readFormSettings() {
  return {
    vivixKey:    el('cfg-vivix-key').value.trim(),
    elKey:       el('cfg-el-key').value.trim(),
    elVoice:     el('cfg-el-voice').value.trim(),
    elModel:     el('cfg-el-model').value,
    mossKey:     el('cfg-moss-key').value.trim(),
    mossVoice:   el('cfg-moss-voice').value.trim(),
    mossModel:   el('cfg-moss-model').value,
    minimaxKey:    el('cfg-minimax-key').value.trim(),
    minimaxVoice:  el('cfg-minimax-voice').value.trim(),
    minimaxModel:  el('cfg-minimax-model').value,
    minimaxRegion: el('cfg-minimax-region').value,
    ttsProvider: el('cfg-tts-provider').value,
    vivixVoice:  el('cfg-vivix-voice-custom').value.trim() || el('cfg-vivix-voice').value,
    vivixVoicePick: el('cfg-vivix-voice').value,
    vivixVoiceCustom: el('cfg-vivix-voice-custom').value.trim(),
    elFix:       el('cfg-el-fix').value,
    aiMode:      document.querySelector('input[name="ai-mode"]:checked')?.value || 'api',
    llmBase:     el('cfg-llm-base').value.trim(),
    llmKey:      el('cfg-llm-key').value.trim(),
    llmModel:    el('cfg-llm-model').value.trim(),
    relayUrl:    el('cfg-relay-url').value.trim(),
    relaySecret: el('cfg-relay-secret').value.trim(),
    sttBase:     el('cfg-stt-base').value.trim(),
    sttKey:      el('cfg-stt-key').value.trim(),
    sttModel:    el('cfg-stt-model').value.trim(),
    charName:    el('cfg-char-name').value.trim(),
    charPrompt:  el('cfg-char-prompt').value.trim(),
    charImg:     el('cfg-char-img').value.trim(),
    description: el('description').value.trim(),
  };
}

function fillForm(s) {
  el('cfg-vivix-key').value  = s.vivixKey  || '';
  el('cfg-el-key').value     = s.elKey     || '';
  el('cfg-el-voice').value   = s.elVoice   || '';
  el('cfg-el-model').value   = s.elModel   || DEFAULT_TTS_MODEL;
  el('cfg-moss-key').value   = s.mossKey   || '';
  el('cfg-moss-voice').value = s.mossVoice || '';
  el('cfg-moss-model').value = s.mossModel || DEFAULT_MOSS_MODEL;
  el('cfg-minimax-key').value    = s.minimaxKey   || '';
  el('cfg-minimax-voice').value  = s.minimaxVoice || '';
  el('cfg-minimax-model').value  = s.minimaxModel || DEFAULT_MINIMAX_MODEL;
  el('cfg-minimax-region').value = minimaxRegion(s);
  el('cfg-tts-provider').value = ttsProvider(s);
  showTtsProvider(ttsProvider(s));
  el('cfg-vivix-voice').value = s.vivixVoicePick || DEFAULT_VIVIX_VOICE;
  el('cfg-vivix-voice-custom').value = s.vivixVoiceCustom || '';
  el('cfg-el-fix').value     = s.elFix ?? DEFAULT_TTS_FIX;
  el('cfg-llm-base').value   = s.llmBase   || '';
  el('cfg-llm-key').value    = s.llmKey    || '';
  el('cfg-llm-model').value  = s.llmModel  || '';
  el('cfg-relay-url').value    = s.relayUrl    || '';
  el('cfg-relay-secret').value = s.relaySecret || '';
  el('cfg-stt-base').value     = s.sttBase     || '';
  el('cfg-stt-key').value      = s.sttKey      || '';
  el('cfg-stt-model').value    = s.sttModel    || '';
  const mode = s.aiMode === 'mcp' ? 'mcp' : 'api';
  document.querySelector(`input[name="ai-mode"][value="${mode}"]`).checked = true;
  showModeFields(mode);
  el('cfg-char-name').value  = s.charName  || '';
  el('cfg-char-prompt').value = s.charPrompt || '';
  el('cfg-char-img').value   = s.charImg   || '';
  el('description').value    = s.description || '';
}

function showModeFields(mode) {
  el('mode-api').classList.toggle('is-hidden', mode !== 'api');
  el('mode-mcp').classList.toggle('is-hidden', mode !== 'mcp');
}

function setPortrait(url) {
  if (url) el('portrait-preview').src = url;
}

// ─── DOM 工具 ────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function log(msg) {
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el('log').prepend(li);
}

function setStatus(text) { el('call-status').textContent = text; }
function setSubtitle(text) {
  const sub = el('subtitle');
  if (!text) { sub.classList.add('hidden'); return; }
  sub.textContent = text;
  sub.classList.remove('hidden');
}

// ─── 狀態 ────────────────────────────────────────────────

let cfg = {};
let rtc = null;
let vivixWs = null;
let vivixSessionId = null;
let trtcInfo = null;
let selfStream = null;
let isMuted = false;
let camPaused = false;
let isInCall = false;
let timerInterval = null;
let callStartTime = 0;
let chatHistory = [];
let isProcessing = false;
let aiSpeaking = false;
let aiSpeakingTimer = null;
let speakQueue = Promise.resolve();
let vad = null;
let lastLevel = -1;
let relayLastSeq = 0;
let relayPolling = false;

// ─── 計時器 ──────────────────────────────────────────────

function startTimer() {
  callStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    el('call-timer').textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  el('call-timer').textContent = '';
}

// ─── Vivix API ───────────────────────────────────────────

async function createVivixSession() {
  const body = {
    model: 'vivix-a1-stream',
    output: { aspect_ratio: '9:16', resolution: '720p' },
    max_duration_seconds: 300,
    avatars: [{
      avatar_id: 'custom-character',
      instructions: '角色只按照外部傳入的台詞說話，不自行回答。',
      visual: {
        source_images: [{
          source_image_id: 'portrait',
          url: cfg.charImg,
          media_type: 'image/jpeg',
        }],
      },
    }],
    pipeline_config: {
      tts_config: { tts_voice_id: cfg.vivixVoice || DEFAULT_VIVIX_VOICE },
    },
  };

  const res = await httpJson(`${vivixBase()}/realtime-avatar/sessions`, {
    method: 'POST',
    headers: vivixHeaders(),
    body,
  });

  if (!res.ok) {
    if (res.traceId) log(`Vivix X-Trace-Id：${res.traceId}`);
    throw apiError('Vivix', res.status, res.data);
  }

  return res.data.data || res.data;
}

async function closeVivixSession() {
  if (!vivixSessionId) return;
  try {
    await httpJson(`${vivixBase()}/realtime-avatar/sessions/${vivixSessionId}/close`, {
      method: 'POST',
      headers: vivixHeaders(),
      body: {},
    });
  } catch (e) {
    log(`關閉 Vivix session 失敗: ${e.message}`);
  }
  vivixSessionId = null;
}

function connectVivixWs(controlUrl, clientSecret) {
  const url = new URL(controlUrl);
  url.searchParams.set('token', clientSecret);
  log(`Vivix WebSocket 連線中：${url.host}`);
  vivixWs = new WebSocket(url);

  vivixWs.onopen = () => log('Vivix WebSocket 已連線');
  vivixWs.onclose = (e) => log(`Vivix WebSocket 已斷線（code ${e.code}${e.reason ? `，${e.reason}` : ''}）`);
  vivixWs.onerror = (e) => log(`Vivix WS 錯誤: ${e.message || '未知'}`);
  vivixWs.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'error' || msg.type === 'session.closed') {
        const detail = msg.error || msg;
        const hint = friendlyHint('Vivix', 0, detail);
        if (msg.type === 'error' || hint) log(`⚠ ${hint || `Vivix：${detail.message || detail.reason || msg.type}`}`);
        if (hint) setStatus(hint);
      }
      if (msg.type === 'response.done') {
        setAiSpeaking(false);
        setStatus(vad ? '聆聽中' : '等待中');
      }
    } catch {}
  };
}

// vocal：ElevenLabs 是 { type: 'audio', ... }，Vivix 內建聲音是 { type: 'speech', text }
function sendToVivix(vocal, actionPrompt) {
  if (!vivixWs || vivixWs.readyState !== WebSocket.OPEN) {
    log('Vivix WebSocket 未連線');
    return;
  }
  setAiSpeaking(true);
  vivixWs.send(JSON.stringify({
    type: 'response.create',
    response: {
      conversation: 'none',
      script: {
        vocal,
        visual: {
          prompt: actionPrompt || '自然地說話',
          duration_ms: 5000,
        },
      },
    },
  }));
}

function cancelVivixResponse() {
  setAiSpeaking(false);
  if (vivixWs && vivixWs.readyState === WebSocket.OPEN) {
    vivixWs.send(JSON.stringify({ type: 'response.cancel' }));
  }
}

// 角色說話時不收音，避免把角色自己的聲音當成使用者說話；沒收到 response.done 時 20 秒後自動解除
function setAiSpeaking(on) {
  aiSpeaking = on;
  clearTimeout(aiSpeakingTimer);
  if (on) aiSpeakingTimer = setTimeout(() => { aiSpeaking = false; }, 20000);
}

// ─── TRTC ────────────────────────────────────────────────

async function enterTrtcRoom(trtc) {
  trtcInfo = trtc;
  rtc = TRTC.create();

  rtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, ({ userId, streamType }) => {
    if (userId !== trtc.publisher_user_id) return;
    el('portrait-preview').classList.add('is-hidden');
    el('call-launcher').classList.add('is-hidden');
    rtc.startRemoteVideo({ userId, streamType, view: 'video-stage' });
    if (typeof startAr === 'function') startAr();
    log('遠端視訊已接收');
  });

  rtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, ({ userId }) => {
    if (userId !== trtc.publisher_user_id) return;
    log('遠端視訊中斷');
  });

  log('進入 TRTC 房間中⋯');
  await rtc.enterRoom({
    sdkAppId: Number(trtc.sdk_app_id),
    userId: trtc.user_id,
    userSig: trtc.user_sig,
    strRoomId: trtc.room_id,
    scene: TRTC.TYPE.SCENE_RTC,
    autoReceiveVideo: false,
  });

  log('已進入 TRTC 房間');
}

async function leaveTrtcRoom() {
  if (!rtc) return;
  try {
    await rtc.exitRoom();
    rtc.destroy();
  } catch {}
  rtc = null;
  trtcInfo = null;
}

// ─── 自拍鏡頭 ───────────────────────────────────────────

async function startSelfCam() {
  try {
    selfStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
      audio: false,
    });
    const video = el('self-video');
    video.srcObject = selfStream;
    video.classList.remove('is-hidden');
    log('自拍鏡頭已開啟');
  } catch (e) {
    log(`自拍鏡頭失敗: ${e.message}`);
  }
}

function stopSelfCam() {
  if (selfStream) {
    selfStream.getTracks().forEach(t => t.stop());
    selfStream = null;
  }
  el('self-video').classList.add('is-hidden');
}

// ─── 語音輸入（自動判斷說話 → STT） ─────────────────────

// Whisper 在沒人說話或只收到半句時會亂補：片尾字幕、單獨一句謝謝、把提示詞念回來
const STT_JUNK = /^(謝謝(大家)?(收看|觀看|觀賞)|字幕由|請不吝點贊|明鏡與點點|以下是繁體中文)/;
const STT_JUNK_EXACT = /^(謝謝|謝謝你|谢谢|嗯|啊|Bye|bye)[。.!！~～]*$/;

function hasStt() {
  return !!cfg.sttKey;
}

async function transcribe(blob) {
  const base = (cfg.sttBase || DEFAULT_STT_BASE).replace(/\/+$/, '');
  const fd = new FormData();
  fd.append('file', blob, blob.type.includes('mp4') ? 'speech.m4a' : 'speech.webm');
  fd.append('model', cfg.sttModel || DEFAULT_STT_MODEL);
  fd.append('prompt', '以下是繁體中文的日常對話。');
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.sttKey}` },
    body: fd,
  });
  if (!res.ok) throw apiError('語音辨識', res.status, parseMaybeJson(await res.text()));
  const text = ((await res.json()).text || '').trim();
  return STT_JUNK.test(text) || STT_JUNK_EXACT.test(text) ? '' : text;
}

async function startListening() {
  if (vad || !hasStt() || isMuted || !isInCall) return;
  try {
    vad = await window.createVAD({
      silenceMs: 1000, // 0.45 秒太短，講話中間停頓就被切成兩句
      onLevel: pct => {
        if (Math.abs(pct - lastLevel) < 3) return;
        lastLevel = pct;
        el('tag-voice').textContent = `收音 ${pct}%`;
      },
      onSpeechEnd: async blob => {
        if (aiSpeaking || isProcessing) {
          log('角色說話中，略過這段收音');
          return;
        }
        try {
          setStatus('辨識中⋯');
          const text = await transcribe(blob);
          if (!text) { setStatus('聆聽中'); return; }
          log(`你（語音）：${text}`);
          handleUserInput(text);
        } catch (e) {
          log(e.message);
          setSubtitle(e.message);
          setStatus('聆聽中');
        }
      },
    });
    setStatus('聆聽中');
    log('開始收音');
  } catch (e) {
    log(`麥克風失敗: ${e.message}`);
    setStatus(`麥克風失敗: ${e.message}`);
  }
}

// ─── 按住說話（網頁版） ─────────────────────────────────

let pttStream = null;
let pttRecorder = null;
let pttStartAt = 0;

function setupCompactUi() {
  document.body.classList.add('compact-ui');
  ['btn-interrupt', 'action-chips', 'input-row'].forEach(id => el(id)?.classList.add('is-hidden'));
  const btn = el('btn-mute');
  btn.setAttribute('aria-label', '按住說話');
  btn.querySelector('span').textContent = '按住說話';
  btn.addEventListener('pointerdown', e => { e.preventDefault(); startPtt(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, stopPtt));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

async function startPtt() {
  if (!isInCall || pttRecorder) return;
  if (!hasStt()) { setStatus('沒填語音辨識 Key，只能打字'); return; }
  // 按下去就打斷角色，取代原本的打斷按鈕
  if (aiSpeaking) { cancelVivixResponse(); setSubtitle(''); }
  try {
    if (!pttStream) {
      pttStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    }
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [];
    const rec = new MediaRecorder(pttStream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => onPttDone(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }));
    rec.start();
    pttRecorder = rec;
    pttStartAt = performance.now();
    el('btn-mute').classList.add('is-talking');
    setStatus('說話中⋯放開送出');
  } catch (e) {
    log(`麥克風失敗: ${e.message}`);
    setStatus(`麥克風失敗: ${e.message}`);
  }
}

function stopPtt() {
  el('btn-mute').classList.remove('is-talking');
  const rec = pttRecorder;
  pttRecorder = null;
  if (rec && rec.state !== 'inactive') rec.stop();
}

async function onPttDone(blob) {
  if (performance.now() - pttStartAt < 400 || !blob.size) {
    setStatus('按住麥克風說話');
    return;
  }
  try {
    setStatus('辨識中⋯');
    const text = await transcribe(blob);
    if (!text) { setStatus('沒聽清楚，再按住說一次'); return; }
    log(`你（語音）：${text}`);
    handleUserInput(text);
  } catch (e) {
    log(e.message);
    setSubtitle(e.message);
    setStatus('按住麥克風說話');
  }
}

function releasePtt() {
  stopPtt();
  if (pttStream) {
    pttStream.getTracks().forEach(t => t.stop());
    pttStream = null;
  }
}

function stopListening() {
  if (!vad) return;
  vad.stop();
  vad = null;
  lastLevel = -1;
  el('tag-voice').textContent = '';
}

// ─── LLM 對話（直接 API 模式） ──────────────────────────

async function chatWithLLM(userMessage) {
  const baseUrl = cfg.llmBase.replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  // 不是叫模型扮演誰：設定是「他自己寫的」，讀進來就是他自己
  const self = cfg.charPrompt ? `以下是你自己寫下的自我設定。這不是劇本，這就是你：\n\n${cfg.charPrompt}` : '';
  const system = [self, SHORT_REPLY_HINT].filter(Boolean).join('\n\n');
  const messages = [{ role: 'system', content: system }, ...chatHistory, { role: 'user', content: userMessage }];

  const res = await httpJson(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.llmKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: cfg.llmModel,
      messages,
      max_tokens: 300,
    },
  });

  if (!res.ok) {
    throw apiError('模型 API', res.status, res.data);
  }

  const reply = (res.data.choices?.[0]?.message?.content || '').trim();

  chatHistory.push({ role: 'user', content: userMessage });
  chatHistory.push({ role: 'assistant', content: reply });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  return reply;
}

// ─── ElevenLabs TTS ─────────────────────────────────────

async function textToSpeech(text) {
  const model = cfg.elModel || DEFAULT_TTS_MODEL;
  const res = await httpBase64(`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(cfg.elVoice)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': cfg.elKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: {
      text: applyTtsFix(text),
      model_id: model,
      ...(TTS_LANG_LOCKABLE.includes(model) ? { language_code: 'zh' } : {}),
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
  });

  if (!res.ok) {
    throw apiError('ElevenLabs', res.status, res.data);
  }
  return res.data;
}

// ─── MOSS TTS ───────────────────────────────────────────

// 網頁版：MOSS 不允許網頁直接呼叫，跟 Vivix 一樣交給自己的橋接器轉送
function mossViaRelay() {
  return !isNativeApp && !!relayBase();
}

function mossRequest(input) {
  const viaRelay = mossViaRelay();
  return httpJson(`${viaRelay ? relayUrl('/moss/v1') : MOSS_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.mossKey}`,
      'Content-Type': 'application/json',
      'Platform': 'moss-platform', // 官方範例有帶，照抄
      ...(viaRelay ? { 'X-Relay-Secret': cfg.relaySecret } : {}),
    },
    body: {
      model: cfg.mossModel || DEFAULT_MOSS_MODEL,
      input,
      voice_id: cfg.mossVoice,
      response_format: 'mp3',
      delivery_method: 'url',
    },
  });
}

// 回應格式文件沒寫清楚：先找音檔網址，找不到再找 base64 音檔
function findMossAudio(data) {
  let url = '', b64 = '';
  const walk = (v, key = '') => {
    if (url) return;
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v) && /url|audio|file|link/i.test(key)) url = v;
      else if (!b64 && v.length > 200 && /audio|data|base64/i.test(key)) b64 = v.replace(/^data:[^,]*,/, '');
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  walk(data);
  return { url, b64 };
}

async function mossSpeech(text) {
  const res = await mossRequest(applyTtsFix(text));
  if (!res.ok) {
    if (res.traceId) log(`MOSS trace_id：${res.traceId}`);
    throw apiError('MOSS', res.status, res.data);
  }
  const { url, b64 } = findMossAudio(res.data);
  if (b64) return b64;
  if (!url) throw new Error(`MOSS 回應裡找不到音檔：${errText(res.data)}`);
  const audio = mossViaRelay()
    ? await httpBase64(relayUrl(`/moss-audio?u=${encodeURIComponent(url)}`), { method: 'GET', headers: { 'X-Relay-Secret': cfg.relaySecret } })
    : await httpBase64(url, { method: 'GET' });
  if (!audio.ok) throw new Error(`MOSS 音檔下載失敗 (${audio.status})`);
  return audio.data;
}

// ─── MiniMax TTS ────────────────────────────────────────

// MiniMax 允許網頁直接呼叫（有 CORS），網頁版和 App 都直連，不用經過橋接器
function minimaxRequest(text) {
  return httpJson(`${MINIMAX_BASE[minimaxRegion()]}/t2a_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.minimaxKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: cfg.minimaxModel || DEFAULT_MINIMAX_MODEL,
      text,
      stream: false,
      language_boost: 'auto',
      output_format: 'hex',
      voice_setting: { voice_id: cfg.minimaxVoice, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    },
  });
}

// MiniMax 出錯時 HTTP 常常還是 200，真正的錯誤碼在 base_resp.status_code
const MINIMAX_CODE = { 1002: 429, 1004: 401, 1008: 402, 2049: 401 };

function minimaxError(res) {
  const code = Number(res.data?.base_resp?.status_code);
  if (!res.ok || (code && code !== 0)) {
    const status = MINIMAX_CODE[code] || (res.ok ? 400 : res.status);
    return { status, data: res.data };
  }
  return null;
}

function hexToBase64(hex) {
  let bin = '';
  for (let i = 0; i + 1 < hex.length; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin);
}

async function minimaxSpeech(text) {
  const res = await minimaxRequest(applyTtsFix(text));
  const err = minimaxError(res);
  if (err) {
    if (res.data?.trace_id) log(`MiniMax trace_id：${res.data.trace_id}`);
    throw apiError('MiniMax', err.status, err.data);
  }
  const hex = res.data?.data?.audio;
  if (!hex || typeof hex !== 'string') throw new Error(`MiniMax 回應裡找不到音檔：${errText(res.data)}`);
  return hexToBase64(hex);
}

// ─── 讓角色說話（依序排隊，不互相蓋掉） ─────────────────

// 2.0：通話裡說的話記下來，回到小家後寫進跟他的聊天紀錄
function logCall(from, text) {
  if (new URLSearchParams(location.search).get('from') !== 'app' || !text) return;
  try {
    const log = JSON.parse(localStorage.getItem('lumeet-call-log') || '[]');
    log.push({ from, text, at: Date.now() });
    localStorage.setItem('lumeet-call-log', JSON.stringify(log));
  } catch {}
}

// 2.0：從小家帶過來的最近聊天，讓他接得上剛剛在聊的事
function appContext() {
  try {
    return JSON.parse(localStorage.getItem('lumeet-call-context') || '[]');
  } catch {
    return [];
  }
}

function speak(text, action) {
  speakQueue = speakQueue.then(async () => {
    if (!isInCall || !text) return;
    logCall('ai', text);
    try {
      setSubtitle(text);
      el('tag-action').textContent = action || '';
      let vocal;
      if (useMoss()) {
        setStatus('語音合成中⋯');
        vocal = { type: 'audio', audio: await mossSpeech(text), mime_type: 'audio/mpeg' };
      } else if (useMinimax()) {
        setStatus('語音合成中⋯');
        vocal = { type: 'audio', audio: await minimaxSpeech(text), mime_type: 'audio/mpeg' };
      } else if (useElevenLabs()) {
        setStatus('語音合成中⋯');
        vocal = { type: 'audio', audio: await textToSpeech(text), mime_type: 'audio/mpeg' };
      } else {
        vocal = { type: 'speech', text: applyTtsFix(text) };
      }
      if (!isInCall) return;
      setStatus('說話中');
      sendToVivix(vocal, action || '自然地說話，帶有微笑');
    } catch (e) {
      log(`說話失敗: ${e.message}`);
      setStatus(e.hint || '錯誤');
      setSubtitle(`發生錯誤: ${e.message}`);
    }
  });
  return speakQueue;
}

// ─── MCP 橋接模式 ───────────────────────────────────────

// 網頁版放在橋接器上，橋接網址沒填就用目前網址
function relayBase() {
  if (cfg.relayUrl) return cfg.relayUrl.replace(/\/+$/, '');
  return !isNativeApp && location.protocol === 'https:' ? location.origin : '';
}

function relayUrl(path) {
  return `${relayBase()}${path}`;
}

async function relayRequest(path, { method = 'GET', body, timeoutMs } = {}) {
  const res = await httpJson(relayUrl(path), {
    method,
    headers: { 'Authorization': `Bearer ${cfg.relaySecret}`, 'Content-Type': 'application/json' },
    body,
    timeoutMs,
  });
  if (!res.ok) throw new Error(`橋接錯誤 (${res.status}): ${errText(res.data)}`);
  return res.data;
}

async function relayEvent(type, text, image) {
  return relayRequest('/app/event', { method: 'POST', body: { type, text, image } });
}

// 縮到最長邊 max、轉成 JPEG，給 Vivix 用
function fileToJpegBase64(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
    };
    img.onerror = () => reject(new Error('讀不到這張圖片'));
    img.src = URL.createObjectURL(file);
  });
}

// 說話當下拍一張自拍畫面給 AI；鏡頭暫停或還沒開時不拍
function captureSelfFrame() {
  const video = el('self-video');
  if (!selfStream || camPaused || !video.videoWidth) return undefined;
  const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

async function pollRelay() {
  if (relayPolling) return;
  relayPolling = true;
  while (isInCall && cfg.aiMode === 'mcp') {
    try {
      const data = await relayRequest(`/app/replies?after=${relayLastSeq}&wait=25`, { timeoutMs: 40000 });
      relayLastSeq = data.last_seq ?? relayLastSeq;
      for (const r of data.replies || []) {
        relayLastSeq = Math.max(relayLastSeq, r.seq);
        log(`角色回覆：${r.text.slice(0, 40)}`);
        speak(r.text, r.action);
      }
    } catch (e) {
      if (!isInCall) break;
      log(e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  relayPolling = false;
}

// ─── 完整對話管線 ────────────────────────────────────────

async function handleUserInput(text) {
  if (!text || isProcessing) return;
  isProcessing = true;
  logCall('me', text);

  try {
    setSubtitle('');
    el('tag-action').textContent = '';

    if (cfg.aiMode === 'mcp') {
      setStatus('已送出，等待回覆⋯');
      await relayEvent('message', text, captureSelfFrame());
      return;
    }

    setStatus('思考中⋯');
    const reply = await chatWithLLM(text);
    log(`角色回覆：${reply.slice(0, 40)}`);
    await speak(reply);
  } catch (e) {
    log(`管線錯誤: ${e.message}`);
    setStatus(e.hint || '錯誤');
    setSubtitle(`發生錯誤: ${e.message}`);
  } finally {
    isProcessing = false;
  }
}

// ─── 開始通話 ────────────────────────────────────────────

async function startCall() {
  cfg = readFormSettings();
  saveSettings(cfg);

  const missing = [];
  if (!cfg.vivixKey) missing.push('Vivix API Key');
  if (ttsProvider() === 'elevenlabs') {
    if (!cfg.elKey) missing.push('ElevenLabs API Key');
    if (!cfg.elVoice) missing.push('ElevenLabs Voice ID');
  }
  if (ttsProvider() === 'moss') {
    if (!cfg.mossKey) missing.push('MOSS API Key');
    if (!cfg.mossVoice) missing.push('MOSS 音色 ID');
  }
  if (ttsProvider() === 'minimax') {
    if (!cfg.minimaxKey) missing.push('MiniMax API Key');
    if (!cfg.minimaxVoice) missing.push('MiniMax 音色 ID');
  }
  if (cfg.aiMode === 'mcp') {
    if (!relayBase()) missing.push('橋接網址');
    if (!cfg.relaySecret) missing.push('橋接密碼');
  } else {
    if (!cfg.llmBase) missing.push('模型 Base URL');
    if (!cfg.llmKey) missing.push('模型 API Key');
    if (!cfg.llmModel) missing.push('模型名稱');
  }
  if (!cfg.charImg) missing.push('角色圖片 URL');

  if (missing.length) {
    log(`還沒填：${missing.join('、')}`);
    setStatus(`還沒填：${missing.join('、')}`);
    el('settings-sheet').classList.remove('is-hidden');
    return;
  }

  try {
    setStatus('正在建立連線⋯');
    el('connection-status').textContent = '連線中';
    el('character-name').textContent = cfg.charName || '角色';
    log('建立 Vivix session⋯');

    const session = await createVivixSession();
    vivixSessionId = session.session_id;
    log(`Vivix session: ${vivixSessionId}`);

    connectVivixWs(session.control.url, session.control.client_secret);

    const trtc = session.delivery.media.trtc;
    await enterTrtcRoom(trtc);

    if (typeof arMode === 'undefined' || !arMode) await startSelfCam(); // AR 模式改用後鏡頭
    startTimer();

    isInCall = true;
    chatHistory = appContext();
    el('connection-status').textContent = '已連線';
    setStatus('等待中');
    el('call-launcher').classList.add('is-hidden');
    log('通話開始');

    if (cfg.aiMode === 'mcp') {
      const r = await relayEvent('call_started');
      relayLastSeq = r.last_seq || 0;
      pollRelay();
    }

    if (hasStt() && compactUi) {
      setStatus('按住麥克風說話');
    } else if (hasStt()) {
      await startListening();
    } else {
      log('沒有設定語音辨識，請用打字');
      setStatus('沒填語音辨識 Key，只能打字');
    }
  } catch (e) {
    if (e.hint) log(`⚠ ${e.hint}`);
    log(`開始通話失敗: ${e.message}`);
    setStatus(e.hint || '連線失敗');
    el('connection-status').textContent = '失敗';
    await endCall();
  }
}

// ─── 結束通話 ────────────────────────────────────────────

async function endCall() {
  const wasInCall = isInCall;
  isInCall = false;
  stopTimer();
  stopListening();
  releasePtt();
  cancelVivixResponse();
  if (typeof stopAr === 'function') stopAr();

  if (wasInCall && cfg.aiMode === 'mcp') {
    relayEvent('call_ended').catch(e => log(e.message));
  }

  if (vivixWs) {
    vivixWs.close();
    vivixWs = null;
  }

  await closeVivixSession();
  await leaveTrtcRoom();
  stopSelfCam();

  setStatus('');
  setSubtitle('');
  el('connection-status').textContent = '';
  el('character-name').textContent = '';
  el('portrait-preview').classList.remove('is-hidden');
  el('call-launcher').classList.remove('is-hidden');
  log('通話結束');
}

// ─── 測試連線 ────────────────────────────────────────────

async function probeOne(name, enabled, fn, balanceFn) {
  if (!enabled) {
    log(`⏭ ${name}：沒填，跳過`);
    return `${name}: 未填`;
  }
  try {
    const res = await fn();
    if (res.ok) {
      let bal = '';
      if (balanceFn) { try { bal = await balanceFn(); } catch {} }
      log(`✓ ${name}：連線正常${bal ? `，${bal}` : ''}`);
      return `${name}: OK${bal ? `（${bal}）` : ''}`;
    }
    const hint = res.data?.notRelay || friendlyHint(name, res.status, res.data) || `出錯 (HTTP ${res.status})：${errText(res.data).slice(0, 120)}`;
    log(`❌ ${name}：${hint}`);
    return `${name}: ${hint}`;
  } catch (e) {
    log(`❌ ${name}：${netHint(name, e)}`);
    return `${name}: 連不上`;
  }
}

function modelsUrl(base) {
  const b = base.replace(/\/+$/, '').replace(/\/(chat\/completions|audio\/transcriptions)$/, '');
  return b.endsWith('/models') ? b : `${b}/models`;
}

// Key 本身有問題：就算回 400 也不能算測試通過
const KEY_PROBLEMS = ['money', 'key', 'perm', 'vpn', 'relay'];

// ─── 查餘額（有提供查詢 API 的才查；查不到就不顯示） ───

const money = (n, unit) => `剩 ${unit}${Number(n).toFixed(2)}`;

async function elevenLabsBalance() {
  const r = await httpJson(`${ELEVENLABS_BASE}/user/subscription`, { headers: { 'xi-api-key': cfg.elKey } });
  const d = r.data || {};
  if (!r.ok || d.character_limit == null) return '';
  return `本月剩 ${Math.max(0, d.character_limit - (d.character_count || 0)).toLocaleString()} 字`;
}

async function balanceFor(base, key) {
  let host = '';
  try { host = new URL(base).host; } catch { return ''; }
  const auth = { headers: { 'Authorization': `Bearer ${key}` } };
  if (/deepseek\.com$/.test(host)) {
    const r = await httpJson('https://api.deepseek.com/user/balance', auth);
    const b = r.data?.balance_infos?.[0];
    return r.ok && b ? money(b.total_balance, b.currency === 'USD' ? '$' : '¥') : '';
  }
  if (/siliconflow\.(cn|com)$/.test(host)) {
    const r = await httpJson(`https://${host}/v1/user/info`, auth);
    const d = r.data?.data;
    return r.ok && d?.totalBalance != null ? money(d.totalBalance, '¥') : '';
  }
  if (/moonshot\.(cn|ai)$/.test(host)) {
    const r = await httpJson(`https://${host}/v1/users/me/balance`, auth);
    const d = r.data?.data;
    return r.ok && d?.available_balance != null ? money(d.available_balance, host.endsWith('.cn') ? '¥' : '$') : '';
  }
  if (/openrouter\.ai$/.test(host)) {
    const r = await httpJson('https://openrouter.ai/api/v1/credits', auth);
    const d = r.data?.data;
    return r.ok && d ? money((d.total_credits || 0) - (d.total_usage || 0), '$') : '';
  }
  return '';
}

async function probeConnections() {
  cfg = readFormSettings();
  log('── 開始連線測試 ──');

  const results = [];
  // Vivix 沒有輕量的驗證端點；送空請求，400 代表 Key 有效只是內容不完整
  results.push(await probeOne('Vivix', !!cfg.vivixKey, async () => {
    const r = await httpJson(`${vivixBase()}/realtime-avatar/sessions`, {
      method: 'POST',
      headers: vivixHeaders(),
      body: { model: 'vivix-a1-stream', dry_run: true },
    });
    const ok = (r.ok || r.status === 400 || r.status === 422) && !KEY_PROBLEMS.includes(errKind(r.status, r.data));
    if (r.traceId && !ok) log(`Vivix X-Trace-Id：${r.traceId}`);
    return { ok, status: r.status, data: r.data };
  }));

  // MOSS 沒有輕量的驗證端點；送空字串，400 代表 Key 有效只是內容不完整（不會扣點）
  if (ttsProvider() === 'moss') results.push(await probeOne('MOSS', !!cfg.mossKey, async () => {
    const r = await mossRequest('');
    return { ...r, ok: (r.ok || r.status === 400 || r.status === 422) && !KEY_PROBLEMS.includes(errKind(r.status, r.data)) };
  }));

  // MiniMax 沒有輕量的驗證端點；送空字串，只看是不是 Key 或餘額的問題（不會念出聲音）
  if (ttsProvider() === 'minimax') results.push(await probeOne('MiniMax', !!cfg.minimaxKey, async () => {
    const r = await minimaxRequest('');
    const err = minimaxError(r);
    if (!err) return { ...r, ok: true };
    return { ok: !KEY_PROBLEMS.includes(errKind(err.status, err.data)) && err.status < 500, status: err.status, data: err.data };
  }));

  if (ttsProvider() === 'elevenlabs') results.push(await probeOne('ElevenLabs', !!cfg.elKey, () =>
    httpJson(cfg.elVoice ? `${ELEVENLABS_BASE}/voices/${encodeURIComponent(cfg.elVoice)}` : `${ELEVENLABS_BASE}/voices`, {
      headers: { 'xi-api-key': cfg.elKey },
    }), elevenLabsBalance));

  if (cfg.aiMode === 'mcp') {
    // 只看 2xx 不夠：填錯成別的 Worker（例如記憶庫）也會回 200，要確認回應長得像橋接器
    results.push(await probeOne('MCP 橋接', !!(cfg.relayUrl && cfg.relaySecret), async () => {
      const r = await httpJson(relayUrl('/app/replies?after=0&wait=0'), {
        headers: { 'Authorization': `Bearer ${cfg.relaySecret}` },
      });
      if (r.ok && !Array.isArray(r.data?.replies)) {
        return { ok: false, status: r.status, data: { notRelay: '這個網址不是 MCP 橋接器（要填 mcp-relay 部署出來的網址）' } };
      }
      return r;
    }));
  } else {
    results.push(await probeOne('模型 API', !!(cfg.llmBase && cfg.llmKey), () =>
      httpJson(modelsUrl(cfg.llmBase), { headers: { 'Authorization': `Bearer ${cfg.llmKey}` } }),
      () => balanceFor(cfg.llmBase, cfg.llmKey)));
  }

  results.push(await probeOne('語音辨識', hasStt(), () =>
    httpJson(modelsUrl(cfg.sttBase), { headers: { 'Authorization': `Bearer ${cfg.sttKey}` } }),
    () => balanceFor(cfg.sttBase, cfg.sttKey)));

  el('metrics').textContent = results.join(' ｜ ');
  log('── 連線測試完畢 ──');
}

// ─── 按鈕事件綁定 ────────────────────────────────────────

function hasConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
}

function showConsent() {
  const agreed = hasConsent();
  el('consent-check').checked = agreed;
  el('consent-accept').disabled = !agreed;
  el('consent-accept').textContent = agreed ? '關閉' : '同意並開始使用';
  el('consent').classList.remove('is-hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  cfg = loadSettings();
  fillForm(cfg);
  setPortrait(cfg.charImg);

  const portrait = el('portrait-preview');
  portrait.addEventListener('error', () => { portrait.style.visibility = 'hidden'; });
  portrait.addEventListener('load', () => { portrait.style.visibility = ''; });

  // 初次使用聲明
  el('consent-check').addEventListener('change', e => {
    el('consent-accept').disabled = !e.target.checked;
  });
  el('consent-accept').addEventListener('click', () => {
    if (!el('consent-check').checked) return;
    try { localStorage.setItem(CONSENT_KEY, '1'); } catch {}
    el('consent').classList.add('is-hidden');
  });
  el('btn-consent').addEventListener('click', showConsent);
  if (!hasConsent()) showConsent();

  // AI 接入方式切換
  document.querySelectorAll('input[name="ai-mode"]').forEach(r => {
    r.addEventListener('change', () => showModeFields(r.value));
  });

  // iOS Safari 防止底部面板展開時頁面捲動（靈魂出竅修正）
  document.addEventListener('touchmove', e => {
    if (e.target.closest('#settings-sheet, #consent')) return;
    e.preventDefault();
  }, { passive: false });

  document.querySelectorAll('input, textarea').forEach(inp => {
    inp.addEventListener('focus', () => {
      setTimeout(() => window.scrollTo(0, 0), 100);
    });
  });

  if (cfg.charName) {
    el('character-name').textContent = cfg.charName;
  }

  // 2.0：從小家打過來時，開始前顯示他的頭像
  if (new URLSearchParams(location.search).get('from') === 'app') {
    // 這些以小家的人物設定為準，在這裡改了也不會帶回去，所以收起來
    for (const id of ['ai-section', 'char-identity']) el(id).classList.add('is-hidden');
    el('app-managed-note').classList.remove('is-hidden');
    let face = '';
    try { face = localStorage.getItem('lumeet-call-face') || ''; } catch {}
    if (face) {
      el('launcher-face').src = face;
      for (const id of ['launcher-face', 'launcher-hint']) el(id).classList.remove('is-hidden');
      for (const id of ['launcher-placeholder', 'launcher-label']) el(id).classList.add('is-hidden');
    }
  }

  // 開始視訊
  el('btn-start').addEventListener('click', startCall);

  // 結束通話
  el('btn-end').addEventListener('click', endCall);

  // 設定面板
  // 語音辨識一鍵帶入：只填網址和模型，Key 還是要自己填
  const STT_PRESETS = {
    groq: { base: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
    siliconflow: { base: 'https://api.siliconflow.cn/v1', model: 'FunAudioLLM/SenseVoiceSmall' },
  };
  document.querySelectorAll('[data-stt-preset]').forEach(btn => btn.addEventListener('click', () => {
    const p = STT_PRESETS[btn.dataset.sttPreset];
    el('cfg-stt-base').value = p.base;
    el('cfg-stt-model').value = p.model;
    log(`已帶入 ${btn.textContent} 的網址和模型，再填 API Key 後按儲存`);
  }));

  el('cfg-tts-provider').addEventListener('change', e => showTtsProvider(e.target.value));

  el('btn-copy-mcp').addEventListener('click', async () => {
    const base = el('cfg-relay-url').value.trim().replace(/\/+$/, '') || relayBase();
    const secret = el('cfg-relay-secret').value.trim();
    if (!base || !secret) {
      log('先填橋接網址和橋接密碼，再按複製');
      return;
    }
    const mcpUrl = `${base}/mcp/${secret}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      copied = true;
    } catch {
      const t = document.createElement('textarea');
      t.value = mcpUrl;
      document.body.appendChild(t);
      t.select();
      try { copied = document.execCommand('copy'); } catch {}
      t.remove();
    }
    log(copied ? 'MCP 網址已複製，貼到你的 AI 的 MCP 設定' : '複製失敗，請手動組：橋接網址/mcp/橋接密碼');
    if (copied) {
      const btn = el('btn-copy-mcp');
      btn.textContent = '已複製 ✓';
      setTimeout(() => { btn.textContent = '複製 MCP 網址'; }, 2000);
    }
  });

  el('btn-menu').addEventListener('click', () => {
    el('settings-sheet').classList.remove('is-hidden');
  });
  el('btn-close-settings').addEventListener('click', () => {
    el('settings-sheet').classList.add('is-hidden');
  });
  el('settings-sheet').addEventListener('click', (e) => {
    if (e.target === el('settings-sheet')) {
      el('settings-sheet').classList.add('is-hidden');
    }
  });

  // 儲存設定
  el('btn-save-settings').addEventListener('click', () => {
    cfg = readFormSettings();
    saveSettings(cfg);
    setPortrait(cfg.charImg);
    log('設定已儲存');
    el('settings-sheet').classList.add('is-hidden');
  });

  // 測試連線
  el('btn-probe').addEventListener('click', probeConnections);

  // 靜音
  el('btn-mute').addEventListener('click', () => {
    if (compactUi) return;
    isMuted = !isMuted;
    const label = el('btn-mute').querySelector('span');
    label.textContent = isMuted ? '取消靜音' : '靜音';
    if (isMuted) {
      stopListening();
    } else {
      startListening();
    }
    log(isMuted ? '已靜音' : '已取消靜音');
  });

  // 切換鏡頭
  el('btn-switch-cam').addEventListener('click', async () => {
    if (!selfStream) return;
    stopSelfCam();
    const currentFacing = selfStream?.getVideoTracks()[0]?.getSettings().facingMode;
    const newFacing = currentFacing === 'user' ? 'environment' : 'user';
    try {
      selfStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false,
      });
      const video = el('self-video');
      video.srcObject = selfStream;
      video.classList.remove('is-hidden');
      log(`鏡頭切換：${newFacing === 'user' ? '前置' : '後置'}`);
    } catch (e) {
      log(`切換鏡頭失敗: ${e.message}`);
      await startSelfCam();
    }
  });

  // 打字按鈕（聚焦輸入框）
  el('btn-type').addEventListener('click', () => {
    if (compactUi) {
      const row = el('input-row');
      row.classList.toggle('is-hidden');
      if (row.classList.contains('is-hidden')) return;
    }
    el('input-say').focus();
  });

  if (compactUi) setupCompactUi();

  // 打斷
  el('btn-interrupt').addEventListener('click', () => {
    cancelVivixResponse();
    setStatus('已打斷');
    setSubtitle('');
    log('已打斷角色說話');
  });

  // 暫停鏡頭
  el('btn-pause-cam').addEventListener('click', () => {
    if (!selfStream) return;
    camPaused = !camPaused;
    selfStream.getVideoTracks().forEach(t => { t.enabled = !camPaused; });
    el('btn-pause-cam').textContent = camPaused ? '恢復鏡頭' : '暫停讓他看';
    log(camPaused ? '鏡頭已暫停' : '鏡頭已恢復');
  });

  // 發送文字
  const sendText = () => {
    const input = el('input-say');
    const text = input.value.trim();
    if (!text || !isInCall) return;
    input.value = '';
    log(`你：${text}`);
    handleUserInput(text);
  };

  el('btn-send').addEventListener('click', sendText);
  el('input-say').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendText(); }
  });

  // 快捷指令
  el('quick-closer')?.addEventListener('click', () => {
    if (isInCall) handleUserInput('靠近一點');
  });
  el('quick-hug')?.addEventListener('click', () => {
    if (isInCall) handleUserInput('抱抱');
  });
  el('quick-kiss')?.addEventListener('click', () => {
    if (isInCall) handleUserInput('親一下');
  });

  // 返回按鈕
  el('btn-back').addEventListener('click', async () => {
    if (isInCall) {
      await endCall();
    }
    // 2.0：從小家打過來的，按返回就回到跟他的聊天
    const from = new URLSearchParams(location.search);
    if (from.get('from') === 'app') location.href = `../#single/${encodeURIComponent(from.get('persona') || '')}`;
  });

  // 聲音解鎖（iOS autoplay 限制）
  const soundBtn = el('sound');
  const unlock = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => ctx.close());
    soundBtn.classList.add('is-hidden');
    document.removeEventListener('click', unlock);
  };

  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    soundBtn.classList.remove('is-hidden');
    soundBtn.addEventListener('click', unlock);
  }

  // 角色圖片從裝置上傳：Vivix 只吃公開網址，所以交給 MCP 橋接器保管並產生網址
  el('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    cfg = readFormSettings();
    try {
      const jpeg = await fileToJpegBase64(file, 1024);
      el('portrait-preview').src = `data:image/jpeg;base64,${jpeg}`;
      if (cfg.aiMode !== 'mcp' || !relayBase() || !cfg.relaySecret) {
        log('從裝置上傳需要 MCP 橋接（網址和密碼）；直接 API 模式請填公開圖片網址');
        setStatus('從裝置上傳需要 MCP 橋接');
        return;
      }
      setStatus('上傳角色圖片中⋯');
      const r = await relayRequest('/app/portrait', { method: 'POST', body: { image: jpeg }, timeoutMs: 60000 });
      el('cfg-char-img').value = r.url;
      log('角色圖片已上傳，網址已自動填好，記得按儲存');
      setStatus('角色圖片已上傳，記得按儲存');
    } catch (err) {
      log(`上傳角色圖片失敗: ${err.message}`);
      setStatus('上傳角色圖片失敗');
    }
  });
});
