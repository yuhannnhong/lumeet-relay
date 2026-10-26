'use strict';
// 通話時「聽」得比文字多：她的音調、音量、語速（跟她平常比），還有背景的環境音
// 都在手機上算，不另外花錢；結果標在送給他的話後面，也顯示在通話畫面的監聽小卡片上

// 音高：每 40ms 一格，用自相關找基頻（80–500Hz），只算有聲音的格子
function voiceFeatures(pcm, rate) {
  const frame = Math.round(rate * 0.04),
    minLag = Math.floor(rate / 500),
    maxLag = Math.ceil(rate / 80);
  const f0s = [];
  let energy = 0;
  for (let i = 0; i + frame + maxLag < pcm.length; i += frame) {
    let e = 0;
    for (let k = 0; k < frame; k++) e += pcm[i + k] * pcm[i + k];
    energy += e;
    if (Math.sqrt(e / frame) < 0.01) continue;
    const cs = new Float32Array(maxLag + 2);
    let best = 0;
    for (let l = minLag; l <= maxLag + 1; l++) {
      let c = 0;
      for (let k = 0; k < frame; k++) c += pcm[i + k] * pcm[i + k + l];
      cs[l] = c;
      if (c > best) best = c;
    }
    // 取第一個夠高的峰，不然會抓到兩倍週期（音高少一個八度）
    let lag = 0;
    for (let l = minLag + 1; l <= maxLag; l++)
      if (cs[l] >= best * 0.9 && cs[l] >= cs[l - 1] && cs[l] >= cs[l + 1]) {
        lag = l;
        break;
      }
    if (lag && best / e > 0.5) f0s.push(rate / lag);
  }
  const rms = Math.sqrt(energy / Math.max(1, pcm.length));
  if (f0s.length < 3) return { rms, f0: 0, spread: 0 };
  f0s.sort((a, b) => a - b);
  const f0 = f0s[Math.floor(f0s.length / 2)];
  // 起伏：音高四分位距相對中位數，越大越有抑揚頓挫
  const spread = (f0s[Math.floor(f0s.length * 0.75)] - f0s[Math.floor(f0s.length * 0.25)]) / f0;
  return { rms, f0, spread };
}

// 跟她平常比：前幾句先建底，之後每句都慢慢更新
function toneTags(feat, text, secs) {
  const base = (saved.voiceBase ||= { n: 0, f0: 0, rms: 0, rate: 0 });
  const rate = text.replace(/[\s\p{P}]/gu, '').length / Math.max(0.5, secs);
  const tags = [];
  if (base.n >= 3) {
    if (feat.f0 && base.f0) {
      if (feat.f0 > base.f0 * 1.12) tags.push('音調比平常高');
      else if (feat.f0 < base.f0 * 0.9) tags.push('音調比平常低');
    }
    if (feat.rms > base.rms * 1.7) tags.push('比平常大聲');
    else if (feat.rms < base.rms * 0.55) tags.push('比平常小聲');
    if (text.length >= 4) {
      if (rate > base.rate * 1.3) tags.push('說得比平常快');
      else if (rate < base.rate * 0.7) tags.push('說得比平常慢');
    }
  }
  if (feat.f0 && feat.spread > 0.35) tags.push('起伏很大');
  else if (feat.f0 && feat.spread < 0.08 && text.length >= 6) tags.push('語氣平平的');
  // 更新平常的樣子（前 10 句權重大，之後慢慢跟）
  const w = 1 / Math.min(base.n + 1, 10);
  if (feat.f0) base.f0 = base.f0 ? base.f0 * (1 - w) + feat.f0 * w : feat.f0;
  base.rms = base.rms ? base.rms * (1 - w) + feat.rms * w : feat.rms;
  if (text.length >= 4) base.rate = base.rate ? base.rate * (1 - w) + rate * w : rate;
  base.n++;
  save('voiceBase');
  return tags;
}

// 環境音：MediaPipe 的 YAMNet（認得五百多種聲音），第一次通話時才載
let earModel = null,
  earLoading = null;
const EAR_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.14';
function loadEar() {
  earLoading ||= (async () => {
    try {
      const { FilesetResolver, AudioClassifier } = await import(`${EAR_CDN}/audio_bundle.mjs`);
      const files = await FilesetResolver.forAudioTasks(`${EAR_CDN}/wasm`);
      earModel = await AudioClassifier.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite' },
        maxResults: 5,
        scoreThreshold: 0.15,
      });
    } catch (e) {
      logError('通話・環境音', e.message);
    }
  })();
  return earLoading;
}
// 人聲本身不算環境音
const EAR_SKIP = /^(Speech|Silence|Inside, small room|Inside, large room or hall|Narration, monologue|Conversation|Male speech, man speaking|Female speech, woman speaking|Child speech, kid speaking|Speech synthesizer|Whispering|Babbling|Echo|Reverberation|Hubbub, speech noise, speech babble|Noise|Static|Hum|White noise|Pink noise|Sound effect|Outside, urban or manmade|Outside, rural or natural|Environmental noise|Mechanisms|Field recording)$/;
const EAR_ZH = {
  Music: '音樂', Singing: '有人在唱歌', Laughter: '笑聲', Giggle: '咯咯笑', Crying: '哭聲', 'Crying, sobbing': '在哭', Sigh: '嘆氣', Breathing: '呼吸聲', Cough: '咳嗽', Sneeze: '打噴嚏', Sniff: '吸鼻子', Snoring: '打呼',
  Dog: '狗', Bark: '狗叫', Cat: '貓', Meow: '貓叫', Purr: '貓呼嚕', Bird: '鳥叫', 'Bird vocalization, bird call, bird song': '鳥叫',
  Rain: '下雨', 'Rain on surface': '雨打在東西上', Raindrop: '雨滴', Thunder: '打雷', Thunderstorm: '雷雨', Wind: '風聲', Water: '水聲', 'Water tap, faucet': '水龍頭', Sink: '洗手台', Bathtub: '浴缸', 'Toilet flush': '沖馬桶', Shower: '淋浴',
  Television: '電視', 'Radio': '收音機', Vehicle: '車', Car: '汽車', Motorcycle: '機車', Traffic: '車流', 'Traffic noise, roadway noise': '馬路的車聲', Siren: '警笛', 'Car alarm': '汽車警報', Horn: '喇叭', 'Vehicle horn, car horn, honking': '按喇叭',
  Typing: '打字', 'Computer keyboard': '鍵盤', 'Writing': '寫字', Door: '門', Knock: '敲門', Doorbell: '門鈴', Slam: '甩門', Footsteps: '腳步聲', 'Dishes, pots, and pans': '碗盤', 'Cutlery, silverware': '餐具', Frying: '煎東西', 'Microwave oven': '微波爐', Blender: '果汁機', 'Hair dryer': '吹風機', 'Vacuum cleaner': '吸塵器', 'Air conditioning': '冷氣', 'Mechanical fan': '電風扇', Clock: '時鐘', Tick: '滴答', 'Telephone bell ringing': '電話鈴', Ringtone: '手機鈴聲', 'Chewing, mastication': '咀嚼', 'Drink': '喝東西', Applause: '拍手', 'Children playing': '小孩在玩', 'Baby cry, infant cry': '小嬰兒哭', 'Crowd': '人很多', 'Chatter': '旁邊有人在聊天',
};
async function hearAround(pcm, rate) {
  await loadEar();
  if (!earModel) return [];
  try {
    const best = new Map();
    for (const r of earModel.classify(pcm, rate))
      for (const c of r.classifications?.[0]?.categories || [])
        if (!EAR_SKIP.test(c.categoryName)) best.set(c.categoryName, Math.max(best.get(c.categoryName) || 0, c.score));
    return [...best]
      .filter(([, s]) => s >= 0.25)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([n]) => EAR_ZH[n] || n);
  } catch (e) {
    logError('通話・環境音', e.message);
    return [];
  }
}

// 監聽小卡片：通話畫面上顯示他這句聽到了什麼
function earCard(box, { text, tone, around }) {
  let card = box.querySelector('.vc-ear');
  if (!card) {
    card = document.createElement('div');
    card.className = 'vc-ear';
    box.querySelector('.vc-status')?.before(card);
  }
  card.innerHTML = `<b>他聽到</b><p>「${escapeHTML(text)}」</p>${tone.length ? `<p>🎙 ${escapeHTML(tone.join('・'))}</p>` : ''}${around.length ? `<p>🔊 ${escapeHTML(around.join('・'))}</p>` : ''}`;
}

// 聽語氣：把錄音交給 Gemini（AI Studio 的 Key），回一句很短的語氣描述。最多等 5 秒，等不到就算了
const TONE_PROMPT = '這是她講電話時說的一句話的錄音。用 15 個字以內描述她說話的語氣和情緒，例如「笑著說，有點撒嬌」「聲音很睏」「有點不耐煩」。只回描述本身，不要引號、不要解釋。聽不出來就回「平常」。';
async function hearTone(blob) {
  const s = saved.callShared || {};
  if (!s.toneKey || !blob) return '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const data = (await blobToDataUrl(blob)).split(',')[1];
    const model = s.toneModel || 'gemini-3.8-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.toneKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TONE_PROMPT }, { inline_data: { mime_type: blob.type || 'audio/wav', data } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error?.message || `HTTP ${res.status}`);
    const text = (out.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    return text && text !== '平常' ? text.replace(/^[「"]|[」"]$/g, '').slice(0, 30) : '';
  } catch (e) {
    if (e.name !== 'AbortError') logError('通話・聽語氣', e.message);
    return '';
  } finally {
    clearTimeout(timer);
  }
}
