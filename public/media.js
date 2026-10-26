'use strict';
// 照片和語音：妳傳照片給他看、錄語音條給他聽；他也可以用語音回妳
// 看不懂圖的模型（例如 DeepSeek）交給識圖模型先看，把看到的寫成文字給他

// ─── 照片 ─────────────────────────────────────
// 他自己看不看得懂圖：auto 時 DeepSeek 只有 Flash 看得懂（官方文件：deepseek-flash 支援圖片），其他的照試，失敗再退回文字
function seesImages(conn) {
  if (conn.vision === 'native') return true;
  if (conn.vision === 'describe') return false;
  const m = conn.model || '';
  return !/deepseek/i.test(m) || /flash/i.test(m);
}
async function describeImage(image) {
  const t = toolCfg();
  if (!t.qwenKey) throw new Error('還沒填百煉（DashScope）的 Key，看不懂圖的他沒辦法看照片');
  const host =
    t.qwenRegion === 'intl' ? 'https://dashscope-intl.aliyuncs.com' : 'https://dashscope.aliyuncs.com';
  const { status, data } = await httpJson(`${host}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t.qwenKey },
    body: {
      model: t.visionModel || 'qwen-vl-max',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image } },
            {
              type: 'text',
              text: '用繁體中文仔細描述這張照片：人物、表情、動作、場景、文字、氣氛。只描述看到的，不要猜測，不超過 150 字。',
            },
          ],
        },
      ],
    },
  });
  if (status >= 400) throw new Error(data.error?.message || data.message || `識圖失敗 HTTP ${status}`);
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('識圖模型沒有回內容');
  return text;
}
// 這個房間裡有沒有看不懂圖、需要文字描述的他
function roomNeedsDescription(room) {
  const ids = room === 'group' ? groupIds() : [room];
  return ids.some((id) => {
    const c = saved.personas[id]?.conn;
    return c && connReady(c) && (c.mode === 'mcp' || !seesImages(c));
  });
}
async function sendPhoto(file) {
  const room = currentRoom();
  if (!room) return;
  closeSheet();
  let image;
  try {
    image = await readPhoto(file);
  } catch {
    toast('這張照片讀不出來');
    return;
  }
  const m = { from: 'me', text: '[照片]', image, at: Date.now() };
  addMessage(room, m);
  if (roomNeedsDescription(room) && toolCfg().qwenKey) {
    try {
      m.desc = await describeImage(image);
      save('msgs:' + room);
    } catch (e) {
      logError('識圖', e.message);
      toast(e.message);
    }
  }
  respond(room, m.desc ? `[照片：${m.desc}]` : '[傳了一張照片]');
}
function photoPicker() {
  return `<label class="photo-pick">${icon('camera')}傳照片<input id="chat-photo" type="file" accept="image/*" hidden></label>`;
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'chat-photo' && e.target.files[0]) sendPhoto(e.target.files[0]);
});

// 聊天紀錄裡的照片、語音條變成 API 看得懂的內容；只有最近幾張真的附圖，太舊的用文字描述
const IMAGE_LIMIT = 3;
function mediaContent(id, m, text, withImage) {
  // 他自己傳過的表情包，在紀錄裡寫回他該用的格式，免得他照抄成「[表情包] 名字」
  if (m.from === id) {
    if (m.sticker) return text.replace(/[\[［]表情包[\]］]\s*(.+)/, '[表情包:$1]');
    // 他點過的歌也寫回該用的格式
    if (m.song) return text.replace(/[\[［](點歌|加歌單)[\]］]\s*《([^》]+)》.*/, `[$1:$2]`);
    return text;
  }
  if (m.audio) return m.heard ? text.replace(m.text, `[語音] ${m.text}`) : text.replace('[語音]', '[傳了一段語音，聽不到內容]');
  if (!m.image) return text;
  if (withImage) return [{ type: 'text', text }, { type: 'image_url', image_url: { url: m.image } }];
  return m.desc ? text.replace('[照片]', `[照片：${m.desc}]`) : text.replace('[照片]', '[傳了一張照片，你看不到]');
}

// ─── 錄語音條 ─────────────────────────────────
let recorder = null,
  recordStart = 0,
  recordTimer = null;
function pickMime() {
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(
    (t) => window.MediaRecorder?.isTypeSupported?.(t),
  );
}
function openRecorder() {
  if (!currentRoom()) return;
  openSheet(
    '說給我聽',
    `<div class="recorder"><div class="wave-pill idle" id="rec-wave"><i></i><i></i><i></i><i></i><i></i></div><p id="rec-time" class="rec-time">0:00</p><button type="button" class="rec-button" data-action="rec-toggle" aria-label="開始錄音">${icon('mic')}</button><p class="sheet-note" id="rec-note">點一下開始，再點一下送出。${saved.callShared?.sttKey ? '' : '沒有填語音辨識，他只會收到「一段語音」，聽不到內容。'}</p><button type="button" class="primary-action" data-action="rec-cancel">取消</button></div>`,
  );
}
async function toggleRecord() {
  if (recorder) {
    recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('這個環境不能錄音');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('沒有麥克風權限');
    return;
  }
  const mime = pickMime();
  const chunks = [];
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  recorder = rec;
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(recordTimer);
    recorder = null;
    const dur = Math.round((Date.now() - recordStart) / 1000);
    if (rec.cancelled || dur < 1) {
      if (!rec.cancelled) toast('太短了');
      return;
    }
    closeSheet();
    sendVoice(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), dur);
  };
  rec.start();
  recordStart = Date.now();
  document.querySelector('#rec-wave')?.classList.remove('idle');
  document.querySelector('.rec-button')?.classList.add('on');
  const note = document.querySelector('#rec-note');
  if (note) note.textContent = '錄音中，再點一下送出';
  recordTimer = setInterval(() => {
    const s = Math.round((Date.now() - recordStart) / 1000);
    const el = document.querySelector('#rec-time');
    if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= 120) rec.stop(); // 最長兩分鐘
  }, 250);
}
function cancelRecord() {
  if (recorder) {
    recorder.cancelled = true;
    recorder.stop();
  }
  closeSheet();
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
// 語音辨識：Groq、OpenAI 的 Whisper（設定在角色頁「聲音與視訊形象」的「語音辨識」）
async function transcribeVoice(blob) {
  const s = saved.callShared || {};
  if (!s.sttKey) return '';
  const fd = new FormData();
  fd.append('file', blob, blob.type.includes('wav') ? 'voice.wav' : blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
  fd.append('model', s.sttModel || 'whisper-large-v3-turbo');
  fd.append('prompt', '以下是繁體中文的日常對話。');
  if (/whisper/i.test(s.sttModel || 'whisper')) fd.append('language', 'zh');
  // Whisper 要 verbose_json 才有「這段是不是人聲」的分數，拿來濾掉翻身、雜音被聽成的「謝謝」
  const whisper = /whisper/i.test(s.sttModel || 'whisper');
  if (whisper) fd.append('response_format', 'verbose_json');
  const res = await fetch((s.sttBase || 'https://api.groq.com/openai/v1').replace(/\/+$/, '') + '/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + s.sttKey },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `語音辨識失敗 HTTP ${res.status}`);
  const segs = Array.isArray(data.segments) ? data.segments : null;
  const text = (segs ? segs.filter((g) => !(g.no_speech_prob > 0.5 && g.avg_logprob < -0.5)).map((g) => g.text).join('') : data.text || '').trim();
  return sttGhost(text, segs) ? '' : text;
}
// 沒有人聲時 Whisper 常自己補的話：謝謝、謝謝觀看、字幕來源，或把提示詞唸回來
const STT_GHOSTS = /^(謝謝|谢谢|謝謝觀看|謝謝收看|謝謝大家|感謝觀看|請不吝點贊.*|.*字幕.*|.*訂閱.*|以下是繁體中文的日常對話|thank you|thanks for watching)$/i;
function sttGhost(text, segs) {
  const t = text.replace(/[\s。，、！？!?,.~～…]/g, '');
  if (!t || /^以下是繁體中文的日常對話/.test(t)) return true;
  if (!STT_GHOSTS.test(t)) return false;
  // 有分數就看分數：真的說了「謝謝」，人聲分數會高，不擋
  return !segs || segs.every((g) => g.no_speech_prob > 0.2 || g.avg_logprob < -0.7);
}
async function sendVoice(blob, dur) {
  const room = currentRoom();
  if (!room) return;
  const m = { from: 'me', text: '[語音]', audio: await blobToDataUrl(blob), dur, at: Date.now() };
  addMessage(room, m);
  let text = '';
  try {
    text = await transcribeVoice(blob);
  } catch (e) {
    logError('語音辨識', e.message);
    toast(e.message);
  }
  if (text) {
    m.text = text;
    m.heard = true;
    save('msgs:' + room);
    const el = main.querySelector(`[data-voice="${room}:${saved['msgs:' + room].indexOf(m)}"] small`);
    if (el) el.textContent = text;
  }
  respond(room, text ? `[語音] ${text}` : '[傳了一段語音，但這邊沒有語音辨識，聽不到內容]');
}

// ─── 語音條的樣子和播放 ─────────────────────────
function voiceMarkup(m, room, index) {
  const sec = m.dur || 0;
  const width = Math.min(220, 84 + sec * 6);
  const caption = m.text && m.text !== '[語音]' ? escapeHTML(m.text) : '';
  return `<button class="bubble voice-bubble" data-voice="${room}:${index}" style="min-width:${width}px">${icon('play')}<span class="voice-bars"><i></i><i></i><i></i><i></i></span><span>${sec}″</span><small>${caption}</small></button>`;
}
let playing = null;
function playVoice(ref) {
  const [room, index] = ref.split(':');
  const m = saved['msgs:' + room]?.[index];
  if (!m?.audio) return;
  const el = main.querySelector(`[data-voice="${ref}"]`);
  if (playing) {
    const same = playing.ref === ref;
    playing.audio.pause();
    playing.el?.classList.remove('playing');
    playing = null;
    if (same) return;
  }
  const audio = new Audio(m.audio);
  playing = { ref, audio, el };
  el?.classList.add('playing');
  audio.onended = audio.onerror = () => {
    el?.classList.remove('playing');
    if (playing?.ref === ref) playing = null;
  };
  audio.play().catch(() => toast('播不出來'));
}
document.addEventListener(
  'click',
  (e) => {
    const v = e.target.closest('[data-voice]');
    if (!v) return;
    e.stopPropagation();
    playVoice(v.dataset.voice);
  },
  true,
);

// ─── 他用語音回：沿用通話的聲音設定 ─────────────────
function ttsReady(id) {
  const c = { ...(saved.callShared || {}), ...(saved.personas[id]?.call || {}) };
  const provider = c.ttsProvider;
  if (provider === 'elevenlabs') return !!(c.elKey && c.elVoice);
  if (provider === 'minimax') return !!(c.minimaxKey && c.minimaxVoice);
  if (provider === 'moss') return !!(c.mossKey && c.mossVoice);
  if (provider === 'pocketvoice') return !!(c.pvUrl && c.pvToken && c.pvCodes?.length);
  return false;
}
function ttsFix(text, rules = '') {
  // 發音修正：每行「原字=替代字」
  for (const line of rules.split('\n')) {
    const [from, to] = line.split('=');
    if (from?.trim() && to !== undefined) text = text.split(from.trim()).join(to.trim());
  }
  // 括號裡的動作不唸出來
  return text.replace(/[（(][^）)]*[）)]/g, '').trim();
}
function base64Of(buffer) {
  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// 拿二進位音檔（App 版原生 HTTP 回 base64）
async function httpAudio(url, { method = 'GET', headers = {}, body } = {}) {
  const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.CapacitorHttp;
  if (http) {
    const r = await http.request({
      url,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      data: body,
      responseType: 'blob',
    });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return r.data;
  }
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw new Error(audioError(r.status, await r.json().catch(() => ({}))));
  return base64Of(await r.arrayBuffer());
}
// ElevenLabs 額度用完、免費帳號被擋也是回 401，看 detail 才知道是哪一種
function audioError(status, data) {
  const d = data?.detail || {};
  const code = d.status || d.code || '';
  const hint = {
    quota_exceeded: '聲音額度用完了',
    detected_unusual_activity: '免費帳號被判定異常、暫停使用',
    invalid_api_key: 'Key 不對',
    voice_not_found: '找不到這個聲音 ID',
  }[code];
  return `HTTP ${status}${hint ? `：${hint}` : d.message ? `：${d.message}`.slice(0, 120) : ''}`;
}
function hexToB64(hex) {
  let bin = '';
  for (let i = 0; i + 1 < hex.length; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin);
}
async function synthesize(id, text) {
  const c = { ...(saved.callShared || {}), ...(saved.personas[id].call || {}) };
  const input = ttsFix(text, c.elFix);
  if (!input) throw new Error('沒有能唸的字');
  if (c.ttsProvider === 'elevenlabs') {
    const model = c.elModel || 'eleven_turbo_v2_5';
    return httpAudio(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.elVoice)}`, {
      method: 'POST',
      headers: { 'xi-api-key': c.elKey, Accept: 'audio/mpeg' },
      body: {
        text: input,
        model_id: model,
        ...(/turbo_v2_5|flash_v2_5/.test(model) ? { language_code: 'zh' } : {}),
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
    });
  }
  if (c.ttsProvider === 'pocketvoice') {
    const res = await fetch(c.pvUrl.replace(/\/+$/, '') + '/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.pvToken, 'Content-Type': 'application/json' },
      // 伺服器有這個聲線就用 id；重啟清空了就用我們存的代碼
      body: JSON.stringify({ input, voice: c.pvVoiceId, voice_codes: c.pvCodes, response_format: 'mp3' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Pocket Voice HTTP ${res.status}${data.error?.message ? '：' + data.error.message : ''}`);
    }
    return base64Of(await res.arrayBuffer());
  }
  if (c.ttsProvider === 'minimax') {
    const base = c.minimaxRegion === 'intl' ? 'https://api.minimax.io/v1' : 'https://api.minimaxi.com/v1';
    const { status, data } = await httpJson(`${base}/t2a_v2`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.minimaxKey },
      body: {
        model: c.minimaxModel || 'speech-2.8-turbo',
        text: input,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: { voice_id: c.minimaxVoice, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      },
    });
    const code = Number(data.base_resp?.status_code);
    if (status >= 400 || code) throw new Error(data.base_resp?.status_msg || `MiniMax HTTP ${status}`);
    if (!data.data?.audio) throw new Error('MiniMax 沒有回音檔');
    return hexToB64(data.data.audio);
  }
  if (c.ttsProvider === 'moss') {
    const { status, data } = await httpJson('https://api.mosi.cn/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.mossKey, Platform: 'moss-platform' },
      body: {
        model: c.mossModel || 'moss-tts-1.5-flash',
        input,
        voice_id: c.mossVoice,
        response_format: 'mp3',
        delivery_method: 'url',
      },
    });
    if (status >= 400) throw new Error(data.error?.message || data.message || `MOSS HTTP ${status}`);
    let url = '',
      b64 = '';
    const walk = (v, key = '') => {
      if (typeof v === 'string') {
        if (!url && /^https?:\/\//.test(v) && /url|audio|file|link/i.test(key)) url = v;
        else if (!b64 && v.length > 200 && /audio|data|base64/i.test(key)) b64 = v.replace(/^data:[^,]*,/, '');
      } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(data);
    if (b64) return b64;
    if (!url) throw new Error('MOSS 回應裡找不到音檔');
    return httpAudio(url);
  }
  throw new Error('還沒設定他的聲音（ElevenLabs、MiniMax 或 MOSS）');
}
function audioLength(src) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.max(1, Math.round(a.duration)) : 0);
    a.onerror = () => resolve(0);
    a.src = src;
  });
}
// 他一行一行說：每一行是一則訊息，太多行的話後面併成最後一則
const MAX_SEGMENTS = 8;
function splitReply(text) {
  const parts = text
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length <= MAX_SEGMENTS) return parts.length ? parts : [text];
  return [...parts.slice(0, MAX_SEGMENTS - 1), parts.slice(MAX_SEGMENTS - 1).join('\n')];
}
// 他說的話送進聊天室：分段一則一則傳，中間停一下像在打字
// 他想用語音說的那則，開頭寫 [語音]：整段開頭有就整段一條語音，某一行開頭有就那一行變語音
const VOICE_TAG = /^\s*[\[［]語音[\]］]\s*/;
async function personaSay(room, id, text, extra = {}) {
  const parts = VOICE_TAG.test(text) ? [text] : splitReply(text);
  const done = typeof takeNoted === 'function' ? takeNoted(id) : [];
  for (let i = 0; i < parts.length; i++) {
    if (i) {
      showTyping(room, id);
      await new Promise((r) => setTimeout(r, Math.min(2000, 500 + parts[i].length * 40)));
    }
    hideTyping(room, id);
    const last = i === parts.length - 1;
    await sayOne(room, id, parts[i], last && done.length ? { ...extra, noted: done } : extra);
  }
}
// 他傳表情包：寫 [表情包:名字]，從她的表情包庫裡找（名字完全一樣優先，其次包含）
const STICKER_TAG = /[\[［]表情包[:：]\s*([^\]］]+?)\s*[\]］]/g;
function findSticker(name) {
  const n = name.trim();
  return customStickers.find((s) => s.name === n) || customStickers.find((s) => s.name.includes(n) || n.includes(s.name));
}
// 他想畫圖給她：另起一行寫 [生圖:畫面描述]（MCP 的他叫不到 generate_image 工具，用這個）
const DRAW_TAG = /[\[［]生圖[:：]\s*([^\]］]+?)\s*[\]］]/;
async function sayOne(room, id, text, extra) {
  const draw = text.match(DRAW_TAG);
  if (draw) {
    const rest = text.replace(DRAW_TAG, '').trim();
    if (rest) await sayOne(room, id, rest, extra);
    showTyping(room, id);
    try {
      const image = await makeImage(draw[1]);
      addMessage(room, { from: id, text: `[圖片] ${draw[1]}`, image, at: Date.now() });
    } catch (e) {
      logError(`${personaName(id)}・生圖`, e.message);
      addMessage(room, { from: id, text: `（想畫一張「${draw[1]}」給妳，但沒畫出來：${e.message}）`, at: Date.now() });
    } finally {
      hideTyping(room, id);
    }
    return;
  }
  // 他照聊天紀錄的樣子寫成「[點歌]《歌名》 - 歌手」（沒有冒號）：整行是這樣，也當成點歌
  const plainSong = text.match(/^\s*[\[［](點歌|加歌單)[\]］]\s*《?([^》\n]+?)》?(?:\s*[-－]\s*[^\n]*)?\s*$/);
  if (plainSong) {
    await musicTag(room, id, plainSong[1], plainSong[2].trim());
    return;
  }
  const song = text.match(MUSIC_TAG);
  if (song) {
    const rest = text.replace(MUSIC_TAG, '').trim();
    if (rest) await sayOne(room, id, rest, extra);
    await musicTag(room, id, song[1], song[2]);
    return;
  }
  if (CALL_TAG.test(text)) {
    CALL_TAG.lastIndex = 0;
    const rest = text.replace(CALL_TAG, '').trim();
    if (rest) await sayOne(room, id, rest, extra);
    ringFrom(id, room, extra?.at);
    return;
  }
  // 他有時照聊天紀錄裡的樣子寫成「[表情包] 名字」（沒有冒號）：整行是這樣、名字找得到，也當成表情包傳
  const plain = text.match(/^\s*[\[［]表情包[\]］]\s*(.+?)\s*$/);
  const plainSticker = plain && findSticker(plain[1]);
  if (plainSticker) {
    addMessage(room, { from: id, text: `[表情包] ${plainSticker.name}`, sticker: plainSticker.id, at: Date.now(), ...extra });
    return;
  }
  const stickers = [...text.matchAll(STICKER_TAG)].map((m) => findSticker(m[1])).filter(Boolean);
  if (stickers.length) {
    const rest = text.replace(STICKER_TAG, '').trim();
    if (rest) await sayOne(room, id, rest, extra);
    for (const st of stickers)
      addMessage(room, { from: id, text: `[表情包] ${st.name}`, sticker: st.id, at: Date.now(), ...(rest ? {} : extra) });
    return;
  }
  // 找不到的表情包就不傳，不把標記露出來
  text = text.replace(STICKER_TAG, '').trim();
  if (!text) return;
  const p = saved.personas[id];
  const tagged = VOICE_TAG.test(text);
  text = text.replace(VOICE_TAG, '');
  if ((tagged || p?.replyMode === 'voice') && ttsReady(id)) {
    try {
      const audio = 'data:audio/mpeg;base64,' + (await synthesize(id, text));
      const dur = (await audioLength(audio)) || Math.max(1, Math.round(text.length / 4));
      addMessage(room, { from: id, text, audio, dur, at: Date.now(), ...extra });
      return;
    } catch (e) {
      logError(`${personaName(id)}・語音回覆`, e.message);
    }
  }
  addMessage(room, { from: id, text, at: Date.now(), ...extra });
}

// ─── 設定 ─────────────────────────────────────
function replyModeField(p) {
  const voice = p.replyMode === 'voice';
  return `<div class="field">他怎麼回妳<div class="sheet-grid conn-mode"><button type="button" data-reply-mode="text" aria-pressed="${!voice}">打字回</button><button type="button" data-reply-mode="voice" aria-pressed="${voice}">語音回</button></div><small class="muted">語音回用他在「聲音與視訊形象」設定的聲音。</small></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-reply-mode]');
  if (!b) return;
  document
    .querySelectorAll('[data-reply-mode]')
    .forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
});
function readReplyMode() {
  return document.querySelector('[data-reply-mode="voice"][aria-pressed="true"]') ? 'voice' : 'text';
}
function visionField(c) {
  const v = c.vision || 'auto';
  const opt = (k, label) => `<option value="${k}" ${k === v ? 'selected' : ''}>${label}</option>`;
  return `<label class="field">看照片<select id="c-vision" class="form-input">${opt('auto', '自動（DeepSeek Flash 自己看，Pro 交給識圖模型）')}${opt('native', '他自己看得懂圖')}${opt('describe', '交給識圖模型看（用百煉 Key）')}</select></label>`;
}
