// 收音判定：開場量底噪、自動設門檻，手機/桌機通用
// 用法：
//   const vad = await createVAD({
//     onLevel: pct => {},          // 0–100 即時音量，可畫音量條
//     onSpeechStart: () => {},
//     onSpeechEnd: blob => {},     // 一句話的錄音，送 STT
//   });
//   vad.stop();
// 必須在使用者點擊後呼叫（iOS 限制）

(function () {
  const MIN_RMS = 0.006;
  const NOISE_MULT = 2.5;
  const START_MS = 120;
  const MIN_UTTER_MS = 300;

  function pickMime() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  window.createVAD = async function ({
    onLevel = () => {},
    onSpeechStart = () => {},
    onSpeechEnd = () => {},
    silenceMs = 450,
    calibrateMs = 1000,
    // pcm：自己存聲音（含開口前 0.5 秒），句子結束給 WAV。MediaRecorder 要等判定開口才開錄，第一個字常被切掉
    pcm = false,
  } = {}) {
    // autoGainControl 對手機收音影響最大，不開的話手機音量常低到被當底噪
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      // 瀏覽器不讓非點擊觸發的音訊啟動時，等使用者下一次碰螢幕再啟動
      const resume = () => ctx.resume();
      document.addEventListener('click', resume, { once: true });
      document.addEventListener('touchend', resume, { once: true });
    }
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const PRE_MS = 500;
    let pcmNode = null, ring = [], ringLen = 0, take = null;
    if (pcm) {
      pcmNode = ctx.createScriptProcessor(4096, 1, 1);
      pcmNode.onaudioprocess = e => {
        const s = new Float32Array(e.inputBuffer.getChannelData(0));
        if (take) take.push(s);
        ring.push(s);
        ringLen += s.length;
        while (ringLen - ring[0].length > (ctx.sampleRate * PRE_MS) / 1000) ringLen -= ring.shift().length;
      };
      src.connect(pcmNode);
      // ScriptProcessor 要接到輸出才會跑，接一個靜音的
      const mute = ctx.createGain();
      mute.gain.value = 0;
      pcmNode.connect(mute).connect(ctx.destination);
    }
    // 降到 16kHz：給語音辨識，也給算音高、聽環境音
    function to16k(parts, rate) {
      const len = parts.reduce((n, p) => n + p.length, 0);
      const flat = new Float32Array(len);
      let o = 0;
      for (const p of parts) flat.set(p, o), (o += p.length);
      const step = rate / 16000, out = new Float32Array(Math.floor(len / step));
      for (let i = 0; i < out.length; i++) out[i] = flat[Math.floor(i * step)];
      return out;
    }
    function wav(f) {
      const out = f.length;
      const b = new DataView(new ArrayBuffer(44 + out * 2));
      const str = (i, t) => [...t].forEach((c, k) => b.setUint8(i + k, c.charCodeAt(0)));
      str(0, 'RIFF'); b.setUint32(4, 36 + out * 2, true); str(8, 'WAVEfmt ');
      b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
      b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
      str(36, 'data'); b.setUint32(40, out * 2, true);
      for (let i = 0; i < out; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f[i])) * 0x7fff, true);
      return new Blob([b], { type: 'audio/wav' });
    }

    const rms = () => {
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    };

    const calStart = performance.now();
    const samples = [];
    while (performance.now() - calStart < calibrateMs) {
      samples.push(rms());
      await new Promise(r => setTimeout(r, 30));
    }
    samples.sort((a, b) => a - b);
    let noise = samples[Math.floor(samples.length / 2)] || 0;

    const mime = pickMime();
    let recorder = null, chunks = [], speaking = false;
    let aboveSince = 0, belowSince = 0, speechStartAt = 0, timer = null;

    function startRec() {
      if (pcm) {
        take = [...ring];
        return;
      }
      chunks = [];
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.start();
    }

    function stopRec(keep) {
      if (pcm) {
        const t = take;
        take = null;
        if (keep && t) {
          const f = to16k(t, ctx.sampleRate);
          onSpeechEnd(wav(f), { pcm: f, rate: 16000 });
        }
        return;
      }
      const r = recorder;
      recorder = null;
      if (!r) return;
      r.onstop = () => {
        if (keep) onSpeechEnd(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
      };
      r.stop();
    }

    function tick() {
      const now = performance.now();
      const level = rms();
      const threshold = Math.max(noise * NOISE_MULT, MIN_RMS);
      onLevel(Math.min(100, Math.round((level / (threshold * 3)) * 100)));

      if (!speaking) {
        noise = noise * 0.98 + level * 0.02;
        if (level > threshold) {
          if (!aboveSince) aboveSince = now;
          if (now - aboveSince >= START_MS) {
            speaking = true;
            speechStartAt = now;
            belowSince = 0;
            startRec();
            onSpeechStart();
          }
        } else {
          aboveSince = 0;
        }
      } else if (level < threshold * 0.7) {
        if (!belowSince) belowSince = now;
        if (now - belowSince >= silenceMs) {
          speaking = false;
          aboveSince = 0;
          stopRec(now - speechStartAt - silenceMs >= MIN_UTTER_MS);
        }
      } else {
        belowSince = 0;
      }
      timer = setTimeout(tick, 30);
    }
    tick();

    return {
      stop() {
        clearTimeout(timer);
        stopRec(false);
        stream.getTracks().forEach(t => t.stop());
        pcmNode?.disconnect();
        ctx.close();
      },
      get noiseFloor() { return noise; },
    };
  };
})();
