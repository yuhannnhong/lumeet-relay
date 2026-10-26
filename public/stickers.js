'use strict';
// Files stay in this browser; connect these storage functions to Lumeet when integrating.
let customStickers = [],
  stickerLoadError = false;
const stickerURLs = new Set();
function stickerFileError(file) {
  if (!['image/png', 'image/apng', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type))
    return '請選擇 PNG、GIF、WebP、JPG 或 AVIF 圖片';
  if (!file.size) return '圖片是空的，請重新選擇';
  if (file.size > 8 * 1024 * 1024) return '單張表情包請小於 8 MB';
  return '';
}
let stickerDB;
function openStickerDB() {
  if (!stickerDB)
    stickerDB = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('storage unavailable'));
        return;
      }
      const request = indexedDB.open('lumeet-custom-stickers', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('stickers', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('storage blocked'));
    });
  return stickerDB;
}
async function stickerTransaction(mode, operation) {
  const db = await openStickerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stickers', mode);
    const request = operation(tx.objectStore('stickers'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('storage aborted'));
  });
}
function stickerURL(file) {
  const url = URL.createObjectURL(file);
  stickerURLs.add(url);
  return url;
}
async function loadStickers() {
  try {
    customStickers = (await stickerTransaction('readonly', (s) => s.getAll()))
      .sort((a, b) => a.created - b.created)
      .map((s) => ({ ...s, url: stickerURL(s.blob) }));
    stickerLoadError = false;
  } catch {
    stickerLoadError = true;
  }
}
// 內建表情包：App 自帶，大家一打開就有；不想要的可以在管理裡拿掉（只是藏起來，記在這支手機）
// 第三欄 1：卡通、動畫、真人的圖，有版權，給別人的純淨版不放
const BUILTIN_STICKERS = [
  ['s01', '不可以'], ['s02', '不結婚很難收場'], ['s03', '我已經氣飽了', 1], ['s04', '見外了吧'],
  ['s05', '上鉤了', 1], ['s06', '幫我加薪', 1], ['s07', '原地結婚', 1], ['s08', '好苦跟我的命一樣'],
  ['s09', '尷尬'], ['s10', '強顏歡笑', 1], ['s11', '愛會消失嗎'], ['s12', '我不知道'],
  ['s13', '我操死你'], ['s14', '我要吃軟飯'], ['s15', '我說實話你又不高興'], ['s16', '我還以為你喜歡的是我', 1],
  ['s17', '硬到爆炸'], ['s18', '挑釁打我啊'], ['s19', '握曹', 1], ['s20', '沒有我得不到的女人'],
  ['s21', '現在幾點'], ['s22', '當機疑惑'], ['s23', '老實交代', 1], ['s24', '裝傻'],
  ['s25', '說吧要什麼', 1], ['s26', '沉思'], ['s27', '任你處置'], ['s28', '你怎麼敢的'],
  ['s29', '你給我小心點'], ['s30', '冷靜'], ['s31', '剛睡醒什麼事'], ['s32', '又想色色'],
  ['s33', '哈哈哈哈'], ['s34', '哭出來'], ['s35', '嚇到吃手手'], ['s36', '嚴厲斥責'],
  ['s37', '回消息了真難得', 1], ['s38', '奸笑'], ['s39', '學會堅強'], ['s40', '學習的好孩子', 1],
  ['s41', '已讀不回'], ['s42', '怪我囉'], ['s43', '想要色色錯了嗎'], ['s44', '愛你'],
  ['s45', '我知道你很急但你先別急'], ['s46', '我要鬧了'], ['s47', '我起床了'], ['s48', '打起來打起來'],
  ['s49', '捧腹大笑'], ['s50', '是在靠北'], ['s51', '確實'], ['s52', '翻白眼'],
  ['s53', '膽子真是肥嘟嘟的'], ['s54', '要我道歉嗎'], ['s55', '請支援色色'], ['s56', '這裡嚴禁色色喔'],
  ['s57', '醒醒吧'],
];
function hiddenStickers() {
  try {
    return JSON.parse(readPreference('lumeet-hidden-stickers') || '[]');
  } catch {
    return [];
  }
}
function builtinStickers() {
  const hidden = hiddenStickers();
  return BUILTIN_STICKERS.filter(([f, , ip]) => !hidden.includes('builtin:' + f) && !(PURE && ip)).map(([f, name]) => ({
    id: 'builtin:' + f,
    name,
    url: `assets/stickers/${f}.webp`,
    builtin: true,
    created: 0,
  }));
}
const stickersReady = loadStickers().then(() => {
  customStickers = [...builtinStickers(), ...customStickers];
});
function stickerCards(manage) {
  return customStickers
    .map(
      (s) =>
        `<div class="sticker-card">${manage ? `<div class="sticker-image"><img src="${s.url}" alt="${escapeHTML(s.name)}"></div>` : `<button class="sticker-image" data-sticker-send="${s.id}" aria-label="發送 ${escapeHTML(s.name)}"><img src="${s.url}" alt="${escapeHTML(s.name)}"></button>`}<span class="sticker-name">${escapeHTML(s.name)}</span>${manage ? `<button class="sticker-delete" data-sticker-delete="${s.id}" aria-label="刪除 ${escapeHTML(s.name)}">${icon('trash')}</button>` : ''}</div>`,
    )
    .join('');
}
async function showStickerManager() {
  openSheet('自訂表情包', '<p class="muted">正在打開妳的表情包…</p>');
  await stickersReady;
  if (!sheet.open) return;
  openSheet(
    '自訂表情包',
    `<p class="sticker-description">把喜歡的表情收進來，聊天時一點就能傳。</p><label class="sticker-upload glass">${icon('plus')}<strong>上傳表情包</strong><small>PNG / GIF / WebP / JPG / AVIF · 每張 8 MB 內</small><input id="sticker-files" type="file" accept="image/png,image/apng,image/gif,image/webp,image/jpeg,image/avif" multiple aria-label="上傳自訂表情包" ${stickerLoadError ? 'disabled' : ''}></label>${stickerLoadError ? '<p class="sticker-empty">目前無法開啟圖片儲存空間，請確認瀏覽器允許此網站儲存資料。</p>' : customStickers.length ? `<div class="sticker-gallery">${stickerCards(true)}</div>` : `<div class="sticker-empty">${icon('smile')}<p>還沒有收藏表情包<br>放一張進來，讓聊天更像妳。</p></div>`}${hiddenStickers().length ? `<button class="pill" data-sticker-restore>${icon('plus')}找回拿掉的內建表情包（${hiddenStickers().length}）</button>` : ''}<p class="sheet-note">表情包保存在目前裝置的瀏覽器，尚未同步到其他裝置。</p>`,
  );
}
async function showStickerPicker() {
  openSheet('表情包', '<p class="muted">正在打開妳的表情包…</p>');
  await stickersReady;
  if (!sheet.open) return;
  openSheet(
    '表情包',
    `<div class="emoji-strip" aria-label="常用表情">${['♥', '🥺', '💋', '😊', '🐾', '✨'].map((e) => `<button data-emoji-insert="${e}" aria-label="插入 ${e}">${e}</button>`).join('')}</div><div class="row between sticker-picker-head"><h3>我的表情包 <small>${customStickers.length}</small></h3><button class="pill" data-action="stickers">${icon('plus')}管理</button></div>${customStickers.length ? `<div class="sticker-gallery">${stickerCards(false)}</div>` : '<div class="sticker-empty">還沒有自訂表情包，點「管理」上傳喜歡的圖片。</div>'}`,
  );
}
async function importStickers(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.disabled = true;
  let added = 0,
    errors = [];
  for (const file of files) {
    const problem = stickerFileError(file);
    if (problem) {
      errors.push(`${file.name}：${problem}`);
      continue;
    }
    let previewURL;
    try {
      previewURL = URL.createObjectURL(file);
      const img = new Image();
      img.src = previewURL;
      await img.decode();
      const record = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '') || '表情包',
        blob: file,
        created: Date.now(),
      };
      await stickerTransaction('readwrite', (s) => s.add(record));
      customStickers.push({ ...record, url: stickerURL(file) });
      added++;
    } catch {
      errors.push(`${file.name}：無法讀取或儲存圖片，請確認檔案與可用空間`);
    } finally {
      if (previewURL) URL.revokeObjectURL(previewURL);
    }
  }
  if (sheet.open) await showStickerManager();
  if (errors.length) {
    const note = document.createElement('p');
    note.className = 'sheet-note danger';
    note.textContent = errors.join('；');
    sheetContent.append(note);
  }
  if (added) toast(`已加入 ${added} 張表情包`);
  if (page === 'settings') render('settings');
}
async function removeSticker(id) {
  if (id.startsWith('builtin:')) {
    writePreference('lumeet-hidden-stickers', JSON.stringify([...hiddenStickers(), id]));
    customStickers = customStickers.filter((s) => s.id !== id);
    await showStickerManager();
    if (page === 'settings') render('settings');
    toast('內建表情包已拿掉，要找回來在管理最下面');
    return;
  }
  try {
    await stickerTransaction('readwrite', (s) => s.delete(id));
    customStickers = customStickers.filter((s) => s.id !== id);
    await showStickerManager();
    if (page === 'settings') render('settings');
    toast('表情包已移除');
  } catch {
    toast('未能刪除，表情包仍然保留');
  }
}
function sendSticker(id) {
  if (page !== 'single' && page !== 'group') return;
  const sticker = customStickers.find((s) => s.id === id);
  if (!sticker) return;
  closeSheet();
  sendMine('[表情包] ' + sticker.name, { sticker: sticker.id });
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'sticker-files') importStickers(e.target);
});
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-sticker-restore]')) return;
  writePreference('lumeet-hidden-stickers', '[]');
  customStickers = [...builtinStickers(), ...customStickers.filter((s) => !s.builtin)];
  await showStickerManager();
  toast('內建表情包都回來了');
});
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  for (const url of stickerURLs) URL.revokeObjectURL(url);
});
