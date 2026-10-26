'use strict';
// 完整備份與還原：換手機時把整個小家搬過去。
// Key 和橋接密碼不放進備份檔（檔案可能被傳來傳去），還原後在新手機重填一次。

// 存檔：App 裡寫到「文件/Lumeet/」，瀏覽器裡直接下載
async function saveFile(name, text, mime) {
  const fs = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Filesystem;
  if (fs) {
    try {
      await fs.writeFile({
        path: `Lumeet/${name}`,
        data: text,
        directory: 'DOCUMENTS',
        encoding: 'utf8',
        recursive: true,
      });
      toast(`存好了：文件/Lumeet/${name}`);
    } catch (e) {
      toast('存檔失敗：' + e.message);
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a); // 沒放進頁面的話，有些瀏覽器會忽略檔名
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('回憶已整理成檔案');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SECRET_FIELDS.includes(k) ? '' : stripSecrets(v)]),
  );
}

async function exportBackup() {
  toast('整理中…');
  const data = Object.fromEntries(
    Object.entries(saved)
      .filter(([k]) => !k.startsWith('seq:'))
      .map(([k, v]) => [k, stripSecrets(v)]),
  );
  const stickers = await Promise.all(
    customStickers.filter((s) => !s.builtin).map(async (s) => ({
      id: s.id,
      name: s.name,
      created: s.created,
      type: s.blob.type,
      data: await blobToBase64(s.blob),
    })),
  );
  const backup = { app: 'LUMEET', backup: 1, exportedAt: new Date().toISOString(), data, stickers };
  await saveFile(`lumeet-backup-${today()}.json`, JSON.stringify(backup), 'application/json');
}

let pendingBackup = null;
async function readBackupFile(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (backup.app !== 'LUMEET' || backup.backup !== 1 || !backup.data?.personas) throw new Error();
    pendingBackup = backup;
    const count = Object.keys(backup.data)
      .filter((k) => k.startsWith('msgs:'))
      .reduce((n, k) => n + (backup.data[k]?.length || 0), 0);
    openSheet(
      '從備份還原？',
      `<p>備份時間：${escapeHTML(new Date(backup.exportedAt).toLocaleString('zh-TW', { hour12: false }))}</p><p>${count} 則聊天、${backup.data.diary?.length || 0} 篇日記、${backup.data.posts?.length || 0} 則動態、${backup.stickers?.length || 0} 張表情包</p><p class="sheet-note danger">會蓋掉這支手機現在的小家資料。Key 和橋接密碼不在備份裡，這支手機原本填過的會保留，沒填過的要重填。</p><button class="primary-action gold" data-action="confirm-restore">確定還原</button>`,
    );
  } catch {
    toast('這不是 Lumeet 的備份檔');
  }
}

async function restoreBackup() {
  const { data, stickers = [] } = pendingBackup;
  pendingBackup = null;
  // 這支手機已經填好的 Key 留著，備份裡是空的
  const localConns = Object.fromEntries(Object.entries(saved.personas).map(([id, p]) => [id, p.conn]));
  for (const [id, p] of Object.entries(data.personas)) {
    const local = localConns[id] || {};
    for (const f of SECRET_FIELDS) if (!p.conn?.[f] && local[f]) (p.conn ||= {})[f] = local[f];
  }
  if (saved.callShared && data.callShared)
    for (const f of SECRET_FIELDS)
      if (!data.callShared[f] && saved.callShared[f]) data.callShared[f] = saved.callShared[f];
  for (const [k, v] of Object.entries(data)) {
    saved[k] = v;
    await save(k);
  }
  for (const s of stickers) {
    if (customStickers.some((x) => x.id === s.id)) continue;
    const blob = new Blob([Uint8Array.from(atob(s.data), (c) => c.charCodeAt(0))], { type: s.type });
    await stickerTransaction('readwrite', (store) =>
      store.put({ id: s.id, name: s.name, blob, created: s.created }),
    );
  }
  toast('還原好了，重新打開中…');
  setTimeout(() => location.reload(), 800);
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'restore-file' && e.target.files[0]) readBackupFile(e.target.files[0]);
});
