'use strict';
// ─── 一起聽歌（汽水音樂） ─────────────────────────
// 歌單只存歌曲編號、歌名、歌手。要播的時候才請橋接器去汽水分享頁拿音檔網址（網址會過期，不能存）。
// 拿不到完整版（下架、只能試聽）的歌：輪播時自動跳過；點開時改到汽水 App 聽。
const QISHUI_LINK = /https?:\/\/(?:qishui\.douyin\.com\/s\/[\w-]+\/?|music\.douyin\.com\/qishui\/share\/(?:track|playlist)\?[^\s]+)/;
const MUSIC_TAG = /[\[［](點歌|加歌單)[:：]\s*([^\]］]+?)\s*[\]］]/;
const musicAudio = new Audio();
musicAudio.preload = 'auto';
// now：現在這首（含歌詞），index：在歌單第幾首（不在歌單裡是 -1）
const music = { now: null, index: -1, loading: false, line: '', tried: new Set() };

// 透過橋接器查（汽水分享頁沒開跨網域，App 直接抓不到）
async function resolveMusic(q) {
  const r = memoryRelay();
  if (!r) throw new Error('要先在設定幫其中一個人填好橋接器和密碼，才查得到汽水的歌');
  const res = await fetch(`${r.url}/app/music?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: 'Bearer ' + r.secret },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
// 會員歌的說明：讓她自己決定要不要去汽水聽完整版
function vipSheet(t, heard) {
  openSheet(
    '汽水會員歌',
    `${songCardMarkup(t)}<p>${heard ? '試聽放完了。' : '這首在汽水只開放給會員，Lumeet 這裡放不了。'}想聽完整版，到汽水音樂（要登入會員）。</p><button class="primary-action gold" data-music="qishui" data-song="${escapeHTML(t.id)}">到汽水聽</button><p class="sheet-note">會員歌在歌單裡輪播時會自動跳過。</p>`,
  );
}
function qishuiUrl(id) {
  return `https://music.douyin.com/qishui/share/track?track_id=${id}`;
}
function openQishui(id) {
  window.open(qishuiUrl(id), '_blank');
}
function songTitle(t) {
  return `《${t.name}》${t.artist ? ' - ' + t.artist : ''}`;
}
function playlist() {
  return (saved.playlist ||= []);
}
function addToPlaylist(t, by) {
  const list = playlist();
  const old = list.find((x) => x.id === t.id);
  if (old) return false;
  list.push({ id: t.id, name: t.name, artist: t.artist, duration: t.duration, by, at: Date.now() });
  save('playlist');
  musicChanged();
  return true;
}

// 播一首：歌單裡的就記住位置，下一首從這裡往下
async function playSong(id, { auto = false } = {}) {
  music.loading = true;
  music.index = playlist().findIndex((x) => x.id === id);
  updateMusicUI();
  let t;
  try {
    t = await resolveMusic(id);
  } catch (e) {
    return songFailed(id, e.message, auto);
  }
  if (!t.audio || t.preview) {
    // 會員歌（汽水 VIP）：記下來，輪播時直接跳過；妳點的那首有試聽就在這裡放試聽，連試聽都沒有才請妳去汽水
    const entry = playlist().find((x) => x.id === id);
    if (entry && !entry.vip) {
      entry.vip = true;
      save('playlist');
    }
    if (auto) return songFailed(id, '這首在這裡只能試聽', true, false);
    music.loading = false;
    updateMusicUI();
    if (!t.audio) {
      vipSheet(t, false);
      return;
    }
    toast(`${songTitle(t)}是汽水會員歌，先放試聽`);
  }
  if (!t.preview) music.tried.clear();
  music.now = t;
  music.line = '';
  music.offset = 0;
  // 音檔由橋接器轉過來（直接連汽水會被擋）
  musicAudio.src = `${memoryRelay().url}/music-audio/${t.id}`;
  try {
    await musicAudio.play();
  } catch {
    toast('點一下播放鍵就開始');
  }
  music.loading = false;
  updateMusicUI();
  musicChanged();
}
// bad：連結失效，標起來以後不再試
function songFailed(id, why, auto, bad = true) {
  music.loading = false;
  const t = playlist().find((x) => x.id === id);
  if (t && bad) {
    t.bad = true;
    save('playlist');
  }
  if (!auto) toast(`這首放不了：${why}`);
  updateMusicUI();
  // 只有自己輪播時才接著找下一首；同一輪試過的歌不再試，全試過一遍就停（不然兩首都是會員歌會來回跳不停）
  music.tried.add(id);
  if (auto) nextSong(1);
}
// manual：她按上一首／下一首，會員歌也照放試聽；自己輪播時跳過會員歌和放不了的
function nextSong(step = 1, { manual = false } = {}) {
  const list = playlist();
  const usable = (x) => !x.bad && (manual || (!x.vip && !music.tried.has(x.id)));
  let i = music.index,
    found = -1;
  for (let n = 0; n < list.length; n++) {
    i = (i + step + list.length) % list.length;
    if (usable(list[i])) {
      found = i;
      break;
    }
  }
  if (found < 0) {
    music.tried.clear();
    musicAudio.pause();
    updateMusicUI();
    if (!manual) toast('歌單裡沒有能完整播放的歌了（會員歌只能點開聽試聽）');
    return;
  }
  playSong(list[found].id, { auto: !manual });
}
function toggleMusic() {
  if (music.now && musicAudio.src) {
    if (musicAudio.paused) musicAudio.play().catch(() => {});
    else musicAudio.pause();
    return;
  }
  const first = playlist().find((x) => !x.bad && !x.vip);
  const any = first || playlist().find((x) => !x.bad);
  if (any) playSong(any.id, { auto: !!first });
  else openPlaylist();
}
musicAudio.addEventListener('ended', () => (music.now?.preview ? previewEnded() : nextSong()));
// 試聽：音檔若只是那一小段，歌詞要往後對齊；若是整首，就跳到試聽開始的地方、到試聽結束就停
musicAudio.addEventListener('loadedmetadata', () => {
  const t = music.now;
  if (!t?.preview) return;
  const [start] = t.preview;
  if (musicAudio.duration && musicAudio.duration < t.duration - 5) music.offset = start * 1000;
  else musicAudio.currentTime = start;
});
function previewEnded() {
  musicAudio.pause();
  vipSheet(music.now, true);
}
musicAudio.addEventListener('error', () => {
  if (music.now) songFailed(music.now.id, '音檔打不開', true, false);
});
musicAudio.addEventListener('play', updateMusicUI);
musicAudio.addEventListener('pause', updateMusicUI);
musicAudio.addEventListener('timeupdate', () => {
  const t = music.now;
  if (!t) return;
  const ms = musicAudio.currentTime * 1000 + (music.offset || 0);
  if (t.preview && !music.offset && musicAudio.currentTime >= t.preview[1]) return previewEnded();
  let line = '';
  for (const [at, text] of t.lyrics || []) {
    if (at > ms) break;
    line = text;
  }
  const pct = musicAudio.duration ? (musicAudio.currentTime / musicAudio.duration) * 100 : 0;
  document.querySelectorAll('[data-music-progress]').forEach((el) => (el.style.width = pct + '%'));
  document.querySelectorAll('[data-music-time]').forEach((el) => (el.textContent = clock2(musicAudio.currentTime)));
  document.querySelectorAll('[data-music-left]').forEach((el) => (el.textContent = '-' + clock2((musicAudio.duration || t.duration) - musicAudio.currentTime)));
  if (line !== music.line) {
    music.line = line;
    document.querySelectorAll('[data-music-line]').forEach((el) => (el.textContent = line || (el.closest('.lg-card') ? t.name : '♪')));
  }
});

// ─── 畫面 ─────────────────────────────────────
// 首頁的播放卡片：透明的液態玻璃，上面是封面＋正在唱的那句歌詞，下面是進度和控制鍵
const SVG = {
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h8v2H4zM18 13.5V5h3v2h-1.5v8.2a2.8 2.8 0 1 1-1.5-1.7z"/></svg>',
};
function clock2(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function musicCard() {
  const t = music.now;
  const on = t && !musicAudio.paused;
  const list = playlist().length;
  const top = t ? music.line || t.name : '一起聽歌';
  const sub = t
    ? `${t.name}${t.artist ? ' - ' + t.artist : ''}`
    : list
      ? `我們的歌單・${list} 首`
      : '還沒有歌，貼汽水連結進來';
  const cover = t?.cover
    ? `<img src="${escapeHTML(t.cover)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'vinyl'}))">`
    : '<span class="vinyl" aria-hidden="true"></span>';
  const dur = t ? musicAudio.duration || t.duration : 0;
  return `<section class="music lg-card ${on ? 'is-playing' : ''}" data-music-card><div class="lg-top"><button class="lg-cover" data-music="open" aria-label="打開歌單">${cover}</button><button class="lg-text" data-music="open"><strong data-music-line>${escapeHTML(top)}</strong><small>${escapeHTML(sub)}</small></button><span class="lg-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div><div class="lg-bar"><span data-music-time>${clock2(t ? musicAudio.currentTime : 0)}</span><div class="lg-track"><span data-music-progress style="width:${dur ? (musicAudio.currentTime / dur) * 100 : 0}%"></span></div><span data-music-left>-${clock2(dur - (t ? musicAudio.currentTime : 0))}</span></div><div class="lg-controls"><button data-music="prev" aria-label="上一首" ${list > 1 ? '' : 'disabled'}>${SVG.prev}</button><button class="lg-play" data-action="music" aria-label="${on ? '暫停' : '播放'}">${on ? SVG.pause : SVG.play}</button><button data-music="next" aria-label="下一首" ${list > 1 ? '' : 'disabled'}>${SVG.next}</button><button class="lg-list" data-music="open" aria-label="歌單">${SVG.list}</button></div></section>`;
}
function updateMusicUI() {
  const card = document.querySelector('[data-music-card]');
  if (card) card.outerHTML = musicCard();
  if (sheet.open) renderPlaylist();
}
function songCardMarkup(s, extra = '') {
  const cover = s.cover ? `<img src="${escapeHTML(s.cover)}" alt="" loading="lazy">` : `<span class="song-cover-blank">${icon('music')}</span>`;
  return `<div class="song-card">${cover}<div class="grow"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.artist || '')}${extra}</small><div class="song-actions"><button data-music="play" data-song="${escapeHTML(s.id)}">${icon('play')}一起聽</button><button data-music="qishui" data-song="${escapeHTML(s.id)}">到汽水</button></div></div></div>`;
}
function openPlaylist() {
  openSheet('我們的歌單', '<div id="playlist-body"></div>');
  renderPlaylist();
}
function renderPlaylist() {
  const box = document.querySelector('#playlist-body');
  if (!box) return;
  const t = music.now;
  const on = t && !musicAudio.paused;
  const list = playlist();
  const typed = document.querySelector('#music-link')?.value || '';
  const now = t
    ? `<div class="now-playing">${songCardMarkup(t)}<p class="lyric-line" data-music-line>${escapeHTML(music.line || '♪')}</p><div class="progress"><span data-music-progress style="width:0"></span></div><div class="sheet-grid music-controls"><button data-music="prev">上一首</button><button data-action="music">${on ? '暫停' : '播放'}</button><button data-music="next">下一首</button></div></div>`
    : `<p class="sheet-note">${music.loading ? '找歌中⋯' : '在汽水按分享 → 複製連結，貼到下面；整個歌單的連結也可以。聊天裡貼汽水連結，也會自動加進來。'}</p>`;
  const rows = list
    .map(
      (x, i) =>
        `<li class="${x.bad ? 'bad' : ''} ${i === music.index ? 'current' : ''}"><button class="grow" data-music="play" data-song="${x.id}"><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.artist || '')}${x.bad ? '・連結失效' : x.vip ? '・會員歌・只能試聽' : ''}${x.by && x.by !== 'me' ? `・${escapeHTML(personaName(x.by))}加的` : ''}</small></button><button class="round" data-music="remove" data-song="${x.id}" aria-label="從歌單拿掉">${icon('minus')}</button></li>`,
    )
    .join('');
  box.innerHTML = `${now}<div class="row music-add"><input id="music-link" class="form-input" placeholder="貼汽水音樂的分享連結" autocomplete="off" value="${escapeHTML(typed)}"><button class="round gold" data-music="add" aria-label="加進歌單">${icon('plus')}</button></div><ul class="playlist">${rows || '<li class="muted">歌單還是空的</li>'}</ul>`;
}

// 貼連結加歌：一首就加一首，歌單就整包匯入（已經有的不重複）
async function addFromLink(text, by = 'me') {
  const t = await resolveMusic(text);
  if (t.type === 'playlist') {
    let n = 0;
    for (const x of t.tracks) if (addToPlaylist(x, by)) n++;
    return { ...t, added: n };
  }
  return { ...t, added: addToPlaylist(t, by) ? 1 : 0 };
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-music]');
  if (!b) return;
  const id = b.dataset.song;
  switch (b.dataset.music) {
    case 'open':
      openPlaylist();
      break;
    case 'play':
      if (music.now?.id === id) toggleMusic();
      else playSong(id);
      break;
    case 'qishui':
      openQishui(id);
      break;
    case 'prev':
      nextSong(-1, { manual: true });
      break;
    case 'next':
      nextSong(1, { manual: true });
      break;
    case 'remove': {
      const list = playlist();
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) break;
      list.splice(i, 1);
      if (i < music.index) music.index--;
      else if (i === music.index) music.index = -1;
      save('playlist');
      renderPlaylist();
      musicChanged();
      break;
    }
    case 'add': {
      const input = document.querySelector('#music-link');
      const text = input.value.trim();
      if (!text) break;
      b.disabled = true;
      try {
        const r = await addFromLink(text);
        input.value = '';
        toast(r.type === 'playlist' ? `「${r.name}」加了 ${r.added} 首` : r.added ? `加進歌單了：${songTitle(r)}` : '這首已經在歌單裡');
        renderPlaylist();
      } catch (err) {
        toast(err.message);
      } finally {
        b.disabled = false;
      }
      break;
    }
  }
});

// ─── 聊天裡分享歌 ─────────────────────────────
// 她貼汽水連結：變成歌曲卡片、加進歌單，傳給他時附上歌名歌手和幾句歌詞
async function shareMusic(room, text) {
  const note = text.replace(QISHUI_LINK, '').replace(/[@＠]?汽水音乐|在汽水音乐.*?听|分享.*?的(单曲|歌单)|#\S+/g, '').trim();
  let r;
  try {
    r = await addFromLink(text);
  } catch (e) {
    toast(e.message);
    sendMine(text, { plainMusic: true });
    return;
  }
  if (r.type === 'playlist') {
    const msg = `[分享歌單]「${r.name}」${r.tracks.length} 首，加進我們的歌單了：${r.tracks
      .slice(0, 8)
      .map(songTitle)
      .join('、')}⋯`;
    sendMine(msg, { plainMusic: true });
    return;
  }
  const lyrics = (r.lyrics || []).slice(0, 8).map(([, l]) => l).join(' / ');
  const msg = `[分享歌曲]${songTitle(r)}（編號 ${r.id}）${lyrics ? `\n歌詞開頭：${lyrics}` : ''}${note ? `\n${note}` : ''}`;
  sendMine(msg, { plainMusic: true, song: songOf(r) });
}
function songOf(t) {
  return { id: t.id, name: t.name, artist: t.artist, cover: t.cover || '' };
}

// 他用 [點歌:歌名/編號/連結] 放歌、[加歌單:編號/連結] 加歌
async function musicTag(room, id, kind, q) {
  const list = playlist();
  const name = q.replace(/^《|》$/g, '').trim();
  const known = list.find((x) => x.id === name) || list.find((x) => x.name === name) || list.find((x) => name.includes(x.name) || x.name.includes(name));
  let t;
  try {
    t = known && kind === '點歌' ? await resolveMusic(known.id) : await resolveMusic(q);
  } catch (e) {
    if (kind === '點歌' && !/^\d+$/.test(name) && !QISHUI_LINK.test(q))
      addMessage(room, { from: id, text: `（想放《${name}》，但歌單裡找不到這首）`, at: Date.now() });
    else logError(`${personaName(id)}・${kind}`, e.message);
    return;
  }
  if (t.type === 'playlist') {
    let n = 0;
    for (const x of t.tracks) if (addToPlaylist(x, id)) n++;
    addMessage(room, { from: id, text: `[加歌單]「${t.name}」加了 ${n} 首`, at: Date.now() });
    return;
  }
  addToPlaylist(t, id);
  addMessage(room, { from: id, text: `[${kind}]${songTitle(t)}`, song: songOf(t), at: Date.now() });
  if (kind === '點歌') playSong(t.id);
}

// 給他看的：現在放什麼、歌單有哪些
function musicManual() {
  const list = playlist().filter((x) => !x.bad);
  const t = music.now;
  // 正在放的歌附上歌詞，他「聽」得到在唱什麼
  const now = t
    ? `現在正在放${songTitle(t)}（${t.id}）${musicAudio.paused ? '（暫停中）' : ''}。${
        t.lyrics?.length ? `歌詞：${t.lyrics.map(([, l]) => l).join(' / ').slice(0, 600)}` : '這首沒有歌詞（可能是純音樂）。'
      }`
    : '現在沒在放歌。';
  return `【一起聽歌】${saved.profile.name}可以把汽水音樂的連結貼給你，會變成歌曲卡片自動加進你們的歌單，前面標 [分享歌曲]。你也能自己放歌：另起一行寫 [點歌:歌名]（歌單裡的歌）或 [點歌:編號]、[點歌:汽水連結]，她手機會開始播；想把歌存進歌單寫 [加歌單:編號或連結]。${now}${
    list.length
      ? `歌單（${list.length} 首，最近加的在後面）：${list
          .slice(-40)
          .map((x) => `${songTitle(x)}（${x.id}）`)
          .join('、')}`
      : '歌單還是空的。'
  }`;
}
// 歌單或正在放的歌變了：更新 MCP 的他讀得到的說明書（等一下再送，連續變動只送一次）
let manualTimer;
function musicChanged() {
  clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    for (const id of memberIds()) {
      const conn = saved.personas[id]?.conn;
      if (conn?.mode === 'mcp' && connReady(conn))
        relayFetch(conn, `/app/manual?ch=${relayChannel(conn)}`, { text: aiManual(id) }).catch(() => {});
    }
  }, 3000);
}
