'use strict';
// 小家的資料：相識天數、日記、紀念日、心情、情侶空間、留言匣。全部存在本機。
const DAY = 86400_000;
function today() {
  return new Date().toLocaleDateString('sv'); // YYYY-MM-DD（本地時區）
}
function dayStart(ymd) {
  return new Date(ymd + 'T00:00:00').getTime();
}
function daysSince(ymd) {
  return Math.floor((dayStart(today()) - dayStart(ymd)) / DAY) + 1;
}
// 每年重複的紀念日算今年或明年那天
function daysUntil(a) {
  let target = a.date;
  if (a.yearly) {
    const year = Number(today().slice(0, 4));
    target = `${year}${a.date.slice(4)}`;
    if (target < today()) target = `${year + 1}${a.date.slice(4)}`;
  }
  return Math.round((dayStart(target) - dayStart(today())) / DAY);
}
function nextAnniversary() {
  return saved.anniversaries
    .map((a) => ({ ...a, left: daysUntil(a) }))
    .filter((a) => a.left >= 0)
    .sort((a, b) => a.left - b.left)[0];
}
function todayMood() {
  return saved.mood && new Date(saved.mood.at).toLocaleDateString('sv') === today() ? saved.mood.text : '';
}
function ago(at) {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  if (min < 1440) return `${Math.floor(min / 60)} 小時前`;
  return new Date(at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}
function readyPersonas() {
  return memberIds().filter((id) => connReady(saved.personas[id].conn));
}
// 小家裡的短請求（留言、紙條）只走直接 API；MCP 的他要在聊天裡才找得到
function apiPersonas() {
  return readyPersonas().filter((id) => saved.personas[id].conn.mode !== 'mcp');
}
function askShort(id, instruction) {
  return askAs(id, systemPrompt(id, 'home'), [{ role: 'user', content: instruction }]);
}

// ─── 相識天數 ─────────────────────────────────
// 每個人跟她相識的日子不一樣（沉淵 7/21、岑序 8/16），各記各的；舊資料只有一個 since，當成沒填的人的預設
function sinceOf(id) {
  const h = saved.home;
  return h.sinceBy?.[id] ?? h.since ?? '';
}
let homeDraft = {};
function openHomeSettings() {
  const h = saved.home;
  const partner = saved.personas[h.partner] ? h.partner : memberIds()[0];
  homeDraft = Object.fromEntries(memberIds().map((id) => [id, sinceOf(id)]));
  openSheet(
    '我們的小家',
    `<label class="field"><span id="h-since-label">和${escapeHTML(personaName(partner))}相識的日子</span><input id="h-since" class="form-input" type="date" value="${homeDraft[partner]}" max="${today()}"></label><div class="field">首頁顯示<div class="sheet-grid">${memberIds()
      .map(
        (id) =>
          `<button data-home-partner="${id}" aria-pressed="${partner === id}">${avatar(id, 30)}${escapeHTML(personaName(id))}</button>`,
      )
      .join('')}</div></div><p class="sheet-note">點誰，上面就改成跟誰相識的日子；首頁顯示選中的那個人。</p><button class="primary-action gold" data-action="save-home">存好</button>`,
  );
}
function saveHome() {
  const partner =
    document.querySelector('[data-home-partner][aria-pressed="true"]')?.dataset.homePartner || saved.home.partner;
  homeDraft[partner] = document.querySelector('#h-since').value;
  saved.home = { ...saved.home, since: homeDraft[partner], sinceBy: { ...homeDraft }, partner };
  save('home');
  closeSheet();
  render(page);
}

// ─── 日記 ─────────────────────────────────────
function openDiary() {
  const mine = saved.diary.find((d) => d.day === today());
  const past = saved.diary
    .filter((d) => d.day !== today())
    .slice(-10)
    .reverse();
  openSheet(
    '今天的日記',
    `<p class="muted" style="font-size:12px">${today()}</p><textarea id="diary-note" class="form-input" rows="5" placeholder="寫一點妳的今天…" aria-label="今日手記">${escapeHTML(mine?.text || '')}</textarea><button class="primary-action gold" data-action="save-diary">存下這一刻</button>${past.length ? `<div class="setting-title">之前寫的</div>${past.map((d) => `<div class="record"><small>${d.day}</small><p>${escapeHTML(d.text)}</p></div>`).join('')}` : ''}`,
  );
}
function saveDiary() {
  const text = document.querySelector('#diary-note').value.trim();
  saved.diary = saved.diary.filter((d) => d.day !== today());
  if (text) saved.diary.push({ day: today(), text, at: Date.now() });
  save('diary');
  closeSheet();
  render(page);
  toast(text ? '今天的心意，收好了' : '今天的日記清空了');
}

// ─── 紀念日 ───────────────────────────────────
function openAnniversaries() {
  const list = saved.anniversaries.map((a) => ({ ...a, left: daysUntil(a) })).sort((a, b) => a.left - b.left);
  openSheet(
    '紀念日',
    `${list.length ? list.map((a) => `<div class="record row"><div class="grow"><strong>${escapeHTML(a.name)}</strong><small>${a.date}${a.yearly ? '・每年' : ''}</small></div><span class="badge">${a.left < 0 ? '已過' : a.left === 0 ? '就是今天' : `還有 ${a.left} 天`}</span><button class="round" data-anniv-delete="${a.id}" aria-label="刪除 ${escapeHTML(a.name)}">${icon('trash')}</button></div>`).join('') : '<p class="muted">還沒有紀念日，加一個吧。</p>'}<div class="setting-title">新增</div>${field('a-name', '名稱', '', 'text', '例如：第一次見面')}<label class="field">日期<input id="a-date" class="form-input" type="date"></label><label class="field row" style="gap:8px"><input id="a-yearly" type="checkbox" checked>每年都算</label><button class="primary-action gold" data-action="add-anniv">加進去</button>`,
  );
}
function addAnniversary() {
  const name = document.querySelector('#a-name').value.trim(),
    date = document.querySelector('#a-date').value;
  if (!name || !date) {
    toast('名稱和日期都要填');
    return;
  }
  saved.anniversaries.push({
    id: crypto.randomUUID(),
    name,
    date,
    yearly: document.querySelector('#a-yearly').checked,
  });
  save('anniversaries');
  openAnniversaries();
  if (page === 'home') render('home');
}
function deleteAnniversary(id) {
  saved.anniversaries = saved.anniversaries.filter((a) => a.id !== id);
  save('anniversaries');
  openAnniversaries();
  if (page === 'home') render('home');
}

// ─── 心情 ─────────────────────────────────────
function setMood(text) {
  saved.mood = { text, at: Date.now() };
  save('mood');
  closeSheet();
  render(page);
  toast('今天的心情：' + text);
}

// ─── 情侶空間 ─────────────────────────────────
function postMarkup(post) {
  return `<article class="feed-card glass"><div class="feed-head">${avatar(post.from, 35)}<div><strong>${escapeHTML(personaName(post.from))}</strong><small>${ago(post.at)}</small></div><button class="more" data-post-delete="${post.id}" aria-label="刪除貼文">${icon('trash')}</button></div><p class="feed-text">${escapeHTML(post.text)}</p><div class="feed-actions"><button class="${post.liked ? 'liked' : ''}" data-post-like="${post.id}" aria-pressed="${post.liked}">${icon('heart')}<span>${post.liked ? '已讚' : '讚'}</span></button><button data-post-comment="${post.id}" aria-label="留言">${icon('chat')}${post.comments.length}</button></div>${post.comments.map((c) => `<div class="feed-comment">${avatar(c.from, 21)}<span>${escapeHTML(personaName(c.from))}：${escapeHTML(c.text)}</span><time>${clock(c.at)}</time></div>`).join('')}</article>`;
}
function findPost(id) {
  return saved.posts.find((p) => p.id === id);
}
async function savePost() {
  const text = document.querySelector('#new-post').value.trim();
  if (!text) return;
  const post = { id: crypto.randomUUID(), from: 'me', text, at: Date.now(), liked: false, comments: [] };
  saved.posts.push(post);
  save('posts');
  closeSheet();
  render('space');
  toast('這一刻，留下了');
  // 接了 API 的他會來留言
  for (const id of apiPersonas()) {
    try {
      const reply = await askShort(
        id,
        `${saved.profile.name}在情侶空間發了一則動態：「${text}」\n用一句話留言回她。只寫留言內容。`,
      );
      post.comments.push({ from: id, text: reply, at: Date.now() });
      save('posts');
      if (page === 'space') render('space');
    } catch (e) {
      toast(`${personaName(id)}沒留成言：${e.message}`);
    }
  }
}
function addComment(postId, text) {
  const post = findPost(postId);
  if (!post || !text) return;
  post.comments.push({ from: 'me', text, at: Date.now() });
  save('posts');
  closeSheet();
  render('space');
}

// ─── 留言匣 ───────────────────────────────────
function unreadLetters() {
  return saved.letters.filter((l) => !l.read);
}
function openLetters() {
  const letters = saved.letters.slice().reverse();
  letters.forEach((l) => (l.read = true));
  save('letters');
  const writers = apiPersonas();
  openSheet(
    '案頭留言匣',
    `${letters.length ? letters.map((l) => `<div class="record letter"><p>${escapeHTML(l.text).replace(/\n/g, '<br>')}</p><small>— ${escapeHTML(personaName(l.from))}・${ago(l.at)}</small></div>`).join('') : '<p class="muted">留言匣還是空的。</p>'}${writers.length ? `<div class="sheet-grid">${writers.map((id) => `<button data-letter-ask="${id}">${avatar(id, 30)}請${escapeHTML(personaName(id))}寫一張</button>`).join('')}</div>` : '<p class="sheet-note">幫他接上直接 API，他就能寫紙條給妳。</p>'}`,
  );
}
async function askLetter(id) {
  toast(`${personaName(id)}正在寫…`);
  try {
    const text = await askShort(
      id,
      `寫一張留在小家桌上給${saved.profile.name}的小紙條，三到五行，只寫紙條內容。`,
    );
    saved.letters.push({ from: id, text, at: Date.now(), read: false });
    save('letters');
    if (sheet.open) openLetters();
    if (page === 'sanctuary' || page === 'cottage') render(page);
  } catch (e) {
    toast(`${personaName(id)}沒寫成：${e.message}`);
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.homePartner) {
    // 先記下剛剛那個人的日子，再換成這個人的
    const prev = document.querySelector('[data-home-partner][aria-pressed="true"]')?.dataset.homePartner;
    const input = document.querySelector('#h-since');
    if (prev && input) homeDraft[prev] = input.value;
    document.querySelectorAll('[data-home-partner]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (input) input.value = homeDraft[b.dataset.homePartner] || '';
    const label = document.querySelector('#h-since-label');
    if (label) label.textContent = `和${personaName(b.dataset.homePartner)}相識的日子`;
  } else if (b.dataset.annivDelete) deleteAnniversary(b.dataset.annivDelete);
  else if (b.dataset.postLike) {
    const post = findPost(b.dataset.postLike);
    post.liked = !post.liked;
    save('posts');
    render('space');
  } else if (b.dataset.postComment) {
    openSheet(
      '留一句話',
      `<input id="comment-input" class="form-input" placeholder="說點什麼…" aria-label="留言內容"><button class="primary-action gold" data-post-comment-save="${b.dataset.postComment}">送出留言</button>`,
    );
  } else if (b.dataset.postCommentSave)
    addComment(b.dataset.postCommentSave, document.querySelector('#comment-input').value.trim());
  else if (b.dataset.postDelete) {
    saved.posts = saved.posts.filter((p) => p.id !== b.dataset.postDelete);
    save('posts');
    render('space');
  } else if (b.dataset.letterAsk) askLetter(b.dataset.letterAsk);
});

// ─── 相簿 ─────────────────────────────────────
// 照片縮到長邊 1280px 再存，首頁的拍立得會輪播這裡的照片
async function readPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function addPhotos(files) {
  let added = 0;
  for (const file of files) {
    try {
      saved.album.push({ id: crypto.randomUUID(), src: await readPhoto(file), at: Date.now() });
      added++;
    } catch {
      toast(`${file.name} 讀不出來`);
    }
  }
  if (!added) return;
  save('album');
  toast(`放進相簿 ${added} 張`);
  if (sheet.open) openAlbum();
  if (page === 'space' || page === 'home') render(page);
}
function albumUpload() {
  return `<label class="album-add">${icon('plus')}<span>加照片</span><input id="album-files" type="file" accept="image/*" multiple hidden></label>`;
}
function openAlbum() {
  const photos = saved.album.slice().reverse();
  openSheet(
    '我們的相簿',
    `<div class="album-grid album-sheet">${albumUpload()}${photos.map((p) => `<button class="album-photo" data-photo="${p.id}"><img src="${p.src}" alt="${new Date(p.at).toLocaleDateString('zh-TW')}"></button>`).join('')}</div>${photos.length ? '' : '<p class="sheet-note">還沒有照片。放進來的照片，首頁的拍立得會輪流播。</p>'}`,
  );
}
function openPhoto(id) {
  const p = saved.album.find((x) => x.id === id);
  if (!p) return;
  openSheet(
    new Date(p.at).toLocaleDateString('zh-TW'),
    `<img src="${p.src}" alt="" style="width:100%;border-radius:12px"><div class="sheet-grid"><button data-action="album">${icon('back')}回相簿</button><button data-photo-delete="${id}">${icon('trash')}刪除</button></div>`,
  );
}
function albumSection() {
  const photos = saved.album.slice(-8).reverse();
  return `<section class="space-album glass"><div class="row"><span class="icon-disc">${icon('camera')}</span><h2 class="grow">相簿</h2><button class="link" data-action="album">全部 ${saved.album.length} 張 ${icon('chevron')}</button></div><div class="album-strip">${albumUpload()}${photos.map((p) => `<button class="album-photo" data-photo="${p.id}"><img src="${p.src}" alt=""></button>`).join('')}</div></section>`;
}
// 首頁拍立得輪播：每 4 秒換一張
let polaroidTimer,
  polaroidIndex = 0;
function polaroidSrc() {
  return saved.album.length ? saved.album[polaroidIndex % saved.album.length].src : PURE ? 'assets/cabin.webp' : 'assets/together.webp';
}
function startPolaroid() {
  clearInterval(polaroidTimer);
  if (saved.album.length < 2) return;
  polaroidTimer = setInterval(() => {
    const img = document.querySelector('.polaroid img');
    if (!img) return clearInterval(polaroidTimer);
    polaroidIndex = (polaroidIndex + 1) % saved.album.length;
    img.classList.add('fading');
    setTimeout(() => {
      img.src = polaroidSrc();
      img.classList.remove('fading');
    }, 300);
  }, 4000);
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'album-files' && e.target.files.length) addPhotos([...e.target.files]);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-photo],[data-photo-delete]');
  if (!b) return;
  if (b.dataset.photo) openPhoto(b.dataset.photo);
  else {
    saved.album = saved.album.filter((x) => x.id !== b.dataset.photoDelete);
    save('album');
    openAlbum();
    if (page === 'space' || page === 'home') render(page);
  }
});

// ─── 小家金庫：簡易記帳 ───────────────────────
const LEDGER_TYPES = ['餐飲', '交通', '購物', '生活', '娛樂', '其他'];
function monthTotal() {
  const month = today().slice(0, 7);
  return saved.ledger.filter((x) => x.date.startsWith(month)).reduce((n, x) => n + x.amount, 0);
}
function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function openLedger() {
  const month = today().slice(0, 7);
  const items = saved.ledger.filter((x) => x.date.startsWith(month));
  const byType = LEDGER_TYPES.map((t) => [
    t,
    items.filter((x) => x.type === t).reduce((n, x) => n + x.amount, 0),
  ]).filter(([, n]) => n);
  const recent = saved.ledger
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
    .slice(0, 30);
  openSheet(
    '小家金庫',
    `<p class="ledger-total">本月花了 <strong>${money(monthTotal())}</strong></p>${byType.length ? `<div class="ledger-types">${byType.map(([t, n]) => `<span class="pill">${t} ${money(n)}</span>`).join('')}</div>` : ''}
<div class="setting-title">記一筆</div><label class="field">日期<input id="l-date" class="form-input" type="date" value="${today()}"></label>${field('l-name', '名稱', '', 'text', '例如：麥當勞')}<label class="field">花費<input id="l-amount" class="form-input" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label><label class="field">類別<select id="l-type" class="form-input">${LEDGER_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label><button class="primary-action gold" data-action="add-ledger">記下來</button>
${recent.length ? `<div class="setting-title">最近的帳</div>${recent.map((x) => `<div class="record row"><div class="grow"><strong>${escapeHTML(x.name)}</strong><small>${x.date}・${x.type}</small></div><span class="badge">${money(x.amount)}</span><button class="round" data-ledger-delete="${x.id}" aria-label="刪除 ${escapeHTML(x.name)}">${icon('trash')}</button></div>`).join('')}` : ''}`,
  );
}
function addLedger() {
  const v = (id) => document.querySelector('#' + id).value.trim();
  const amount = Number(v('l-amount'));
  if (!v('l-date') || !v('l-name') || !(amount > 0)) {
    toast('日期、名稱、花費都要填');
    return;
  }
  saved.ledger.push({
    id: crypto.randomUUID(),
    date: v('l-date'),
    name: v('l-name'),
    amount,
    type: v('l-type'),
    at: Date.now(),
  });
  save('ledger');
  openLedger();
  if (page === 'home') render('home');
}

// ─── 生理期 ───────────────────────────────────
// 記每次開始的日子；週期用最近幾次的平均（不到兩次就用設定值）
function periodInfo() {
  const p = saved.period,
    starts = p.starts.slice().sort();
  if (!starts.length) return null;
  const gaps = starts
    .slice(1)
    .map((d, i) => Math.round((dayStart(d) - dayStart(starts[i])) / DAY))
    .slice(-6);
  const cycle = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : p.cycle;
  const last = starts.at(-1);
  const day = daysSince(last);
  const next = new Date(dayStart(last) + cycle * DAY).toLocaleDateString('sv');
  return {
    last,
    day,
    cycle,
    next,
    left: Math.round((dayStart(next) - dayStart(today())) / DAY),
    inPeriod: day >= 1 && day <= p.length,
  };
}
function periodLine() {
  const i = periodInfo();
  if (!i) return ['', '記下這次開始的日子'];
  if (i.inPeriod) return [`第 ${i.day} 天`, '多喝溫水，照顧好自己'];
  if (i.left > 0) return [`${i.left} 天`, `預計 ${i.next.slice(5).replace('-', '/')} 來`];
  return ['可能遲到', `原本預計 ${i.next.slice(5).replace('-', '/')}`];
}
function openPeriod() {
  const p = saved.period,
    i = periodInfo();
  openSheet(
    '生理期',
    `${i ? `<p class="ledger-total">${i.inPeriod ? `經期第 <strong>${i.day}</strong> 天` : i.left > 0 ? `下次大約 <strong>${i.next.slice(5).replace('-', '/')}</strong>，還有 ${i.left} 天` : `比預計晚了 ${-i.left} 天`}</p><p class="sheet-note">平均週期 ${i.cycle} 天・上次 ${i.last}</p>` : '<p>記下每次開始的日子，之後會幫妳算下一次。</p>'}
<div class="sheet-grid"><button class="gold" data-action="period-today">今天來了</button><button data-action="period-pick">選別的日子</button></div><input id="period-date" class="form-input hide" type="date" max="${today()}">
<div class="setting-title">設定</div><label class="field">週期（天）<input id="period-cycle" class="form-input" type="number" min="15" max="60" value="${p.cycle}"></label><label class="field">經期長度（天）<input id="period-length" class="form-input" type="number" min="1" max="14" value="${p.length}"></label><label class="field row" style="gap:8px"><input id="period-share" type="checkbox" ${p.share ? 'checked' : ''}>讓他們知道（經期時聊天會多照顧妳）</label><button class="primary-action" data-action="period-save">存設定</button>
${
  p.starts.length
    ? `<div class="setting-title">紀錄</div>${p.starts
        .slice()
        .sort()
        .reverse()
        .map(
          (d) =>
            `<div class="record row"><div class="grow">${d}</div><button class="round" data-period-delete="${d}" aria-label="刪除 ${d}">${icon('trash')}</button></div>`,
        )
        .join('')}`
    : ''
}`,
  );
}
function addPeriodStart(date) {
  if (!date) return;
  if (!saved.period.starts.includes(date)) saved.period.starts.push(date);
  save('period');
  openPeriod();
  if (page === 'home') render('home');
}
// 給聊天的系統提示用：只在她勾了「讓他們知道」且正在經期時才說
function periodNote() {
  const i = saved.period.share && periodInfo();
  return i && i.inPeriod ? `她現在是生理期第 ${i.day} 天。` : '';
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ledger-delete],[data-period-delete]');
  if (!b) return;
  if (b.dataset.ledgerDelete) {
    saved.ledger = saved.ledger.filter((x) => x.id !== b.dataset.ledgerDelete);
    save('ledger');
    openLedger();
  } else {
    saved.period.starts = saved.period.starts.filter((d) => d !== b.dataset.periodDelete);
    save('period');
    openPeriod();
  }
  if (page === 'home') render('home');
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'period-date') addPeriodStart(e.target.value);
});
