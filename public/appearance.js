'use strict';
const backgroundLimit = 8 * 1024 * 1024;
let backgroundDB,
  currentBackground = null,
  backgroundCandidate = null;
function backgroundImageType(bytes) {
  if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  const head = String.fromCharCode(...bytes.slice(0, 64));
  if (/^GIF8[79]a/.test(head)) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (head.slice(4, 8) === 'ftyp' && /avif|avis/.test(head.slice(8))) return 'image/avif';
  throw new Error('請使用 PNG、JPG、GIF、WebP 或 AVIF 圖片');
}
function base64Background(value) {
  let input = value.trim(),
    declared = '';
  if (!input) throw new Error('先貼上圖片的 Base64 內容');
  if (/^data:/i.test(input)) {
    const match = /^data:(image\/(?:png|apng|jpeg|jpg|gif|webp|avif));base64,([\s\S]+)$/i.exec(input);
    if (!match) throw new Error('請貼上圖片 Base64，格式如 data:image/png;base64,…');
    declared = match[1].toLowerCase().replace('image/jpg', 'image/jpeg').replace('image/apng', 'image/png');
    input = match[2];
  }
  input = input.replace(/\s/g, '');
  if (input.length > Math.ceil(backgroundLimit / 3) * 4) throw new Error('背景圖請小於 8 MB');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 === 1)
    throw new Error('Base64 內容不完整或包含無效字元');
  let decoded;
  try {
    decoded = atob(input);
  } catch {
    throw new Error('Base64 內容不完整，請重新複製');
  }
  if (decoded.length > backgroundLimit) throw new Error('背景圖請小於 8 MB');
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  const type = backgroundImageType(bytes);
  if (declared && declared !== type) throw new Error('圖片格式與 Base64 標頭不一致，請重新複製');
  return new Blob([bytes], { type });
}
function openBackgroundDB() {
  if (!backgroundDB)
    backgroundDB = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('目前無法儲存圖片，請確認瀏覽器的網站儲存設定'));
        return;
      }
      const request = indexedDB.open('lumeet-appearance', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('settings', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('請關閉其他舊分頁後重試'));
    });
  return backgroundDB;
}
async function backgroundTransaction(mode, operation) {
  const db = await openBackgroundDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', mode),
      request = operation(tx.objectStore('settings'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('未能完成儲存'));
  });
}
function applyBackground() {
  const scene = document.querySelector('.scene'),
    outside = document.querySelector('.desktop-atmosphere');
  if (currentBackground) {
    scene.style.backgroundImage = `url("${currentBackground.url}")`;
    outside.style.backgroundImage = `url("${currentBackground.url}")`;
    app.dataset.customBackground = 'true';
  } else {
    scene.style.backgroundImage = '';
    outside.style.backgroundImage = '';
    delete app.dataset.customBackground;
  }
  // 深夜星空的湖畔極光只在用主題預設背景時動；換成自己的照片就改回疊光
  if (typeof applyLight === 'function') applyLight();
}
async function restoreBackground() {
  try {
    const saved = await backgroundTransaction('readonly', (s) => s.get('background'));
    if (saved?.blob) {
      currentBackground = { blob: saved.blob, url: URL.createObjectURL(saved.blob) };
      applyBackground();
    }
  } catch {
    /* The default theme stays usable when browser storage is unavailable. */
  }
}
function discardBackgroundCandidate() {
  if (backgroundCandidate) {
    URL.revokeObjectURL(backgroundCandidate.url);
    backgroundCandidate = null;
  }
}
function backgroundError(message) {
  const status = document.querySelector('#background-status');
  if (status) status.textContent = message;
  else toast(message);
}
async function showBackgroundSettings() {
  backgroundPreviewVersion++;
  discardBackgroundCandidate();
  openSheet(
    '背景圖更換',
    `<p class="background-help">選一張照片，或貼上圖片 Base64，讓小家換個風景。</p><div class="background-preview" id="background-preview">${currentBackground ? `<img src="${currentBackground.url}" alt="目前的背景圖">` : '<span>目前使用主題預設背景</span>'}</div><label class="background-file pill">${icon('camera')}從相簿選圖<input type="file" id="background-file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" aria-label="選擇背景圖片"></label><label for="background-base64" class="form-label">圖片 Base64</label><textarea id="background-base64" class="form-input base64-input" rows="3" maxlength="12000000" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="data:image/png;base64,…\n也可以直接貼上不含標頭的 Base64" aria-describedby="background-status"></textarea><button class="background-preview-button pill" data-action="preview-base64">${icon('camera')}預覽 Base64 圖片</button><p id="background-status" class="sheet-note" role="status">支援 PNG、JPG、GIF、WebP、AVIF，每張 8 MB 內。</p><button class="primary-action gold" id="apply-background" data-action="apply-background" disabled>套用背景</button><button class="background-reset" data-action="reset-background">恢復主題預設背景</button><p class="sheet-note">背景保存在目前裝置，重新整理後仍會保留。</p>`,
  );
}
let backgroundPreviewVersion = 0;
async function previewBackground(blob) {
  const version = ++backgroundPreviewVersion;
  discardBackgroundCandidate();
  document.querySelector('#apply-background').disabled = true;
  if (!blob.size || blob.size > backgroundLimit) {
    backgroundError('背景圖請選擇非空白、8 MB 內的圖片');
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (version !== backgroundPreviewVersion || !sheet.open) {
      URL.revokeObjectURL(url);
      return;
    }
    if (image.naturalWidth * image.naturalHeight > 40000000)
      throw new Error('圖片解析度太大，請換成 4,000 萬像素內的圖片');
    backgroundCandidate = { blob, url };
    document.querySelector('#background-preview').innerHTML = `<img src="${url}" alt="待套用的背景圖">`;
    document.querySelector('#apply-background').disabled = false;
    backgroundError('預覽完成，點「套用背景」儲存。');
  } catch (error) {
    URL.revokeObjectURL(url);
    if (version === backgroundPreviewVersion)
      backgroundError(
        error.message?.startsWith('圖片解析度')
          ? error.message
          : '圖片無法讀取，請確認 Base64 完整或換一張圖片',
      );
  }
}
async function previewBase64Background() {
  backgroundPreviewVersion++;
  discardBackgroundCandidate();
  document.querySelector('#apply-background').disabled = true;
  try {
    const blob = base64Background(document.querySelector('#background-base64').value);
    await previewBackground(blob);
  } catch (error) {
    backgroundError(error.message);
  }
}
async function saveBackground() {
  if (!backgroundCandidate) return;
  const chosen = backgroundCandidate;
  const button = document.querySelector('#apply-background');
  button.disabled = true;
  try {
    await backgroundTransaction('readwrite', (s) => s.put({ key: 'background', blob: chosen.blob }));
    if (currentBackground) URL.revokeObjectURL(currentBackground.url);
    currentBackground = { blob: chosen.blob, url: URL.createObjectURL(chosen.blob) };
    discardBackgroundCandidate();
    applyBackground();
    closeSheet();
    toast('新風景，已經替妳換上');
  } catch {
    backgroundError('未能儲存背景，請確認可用空間；原本的背景仍保留。');
    button.disabled = false;
  }
}
async function resetBackground() {
  try {
    await backgroundTransaction('readwrite', (s) => s.delete('background'));
    if (currentBackground) URL.revokeObjectURL(currentBackground.url);
    currentBackground = null;
    discardBackgroundCandidate();
    applyBackground();
    closeSheet();
    toast('已恢復主題預設背景');
  } catch {
    backgroundError('未能儲存變更，原本的背景仍保留。');
  }
}
document.addEventListener('change', async (e) => {
  if (e.target.id === 'background-file' && e.target.files?.[0]) {
    backgroundPreviewVersion++;
    discardBackgroundCandidate();
    document.querySelector('#apply-background').disabled = true;
    try {
      const file = e.target.files[0];
      if (file.size > backgroundLimit) throw new Error('背景圖請小於 8 MB');
      backgroundImageType(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
      await previewBackground(file);
    } catch (error) {
      backgroundError(error.message);
    }
  }
});
