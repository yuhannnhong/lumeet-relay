'use strict';
// 所有資料都存在這支手機的瀏覽器（IndexedDB），不經過任何伺服器。
// 開 App 時整包讀進 saved，之後改了哪一項就用 save(key) 寫回去。
const saved = {};
let lumeetDB;
function openLumeetDB() {
  if (!lumeetDB)
    lumeetDB = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('storage unavailable'));
        return;
      }
      const request = indexedDB.open('lumeet', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('storage blocked'));
    });
  return lumeetDB;
}
function kvRequest(mode, operation) {
  return openLumeetDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('kv', mode);
        const request = operation(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('storage aborted'));
      }),
  );
}
// ─── Key 加密 ─────────────────────────────────
// API Key 和橋接密碼用 AES-GCM 加密後才存。加密用的鑰匙是瀏覽器產生的「不可匯出」鑰匙，
// 程式只能拿它來加解密，讀不出鑰匙本身。匯出備份、翻資料庫，都只看得到亂碼。
// 擋不住的是：有人拿著已解鎖的手機直接打開 App。
const SECRET_FIELDS = [
  'key',
  'secret',
  'token',
  'vivixKey',
  'elKey',
  'mossKey',
  'minimaxKey',
  'sttKey',
  'searchKey',
  'qwenKey',
];
const SEALED_KEYS = ['personas', 'callShared', 'tools'];
let deviceKey;
async function getDeviceKey() {
  deviceKey ||= (async () => {
    const existing = await kvRequest('readonly', (s) => s.get('__deviceKey'));
    if (existing) return existing;
    const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await kvRequest('readwrite', (s) => s.put(created, '__deviceKey'));
    return created;
  })();
  return deviceKey;
}
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function seal(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getDeviceKey(),
    new TextEncoder().encode(text),
  );
  return { sealed: b64(iv) + '.' + b64(new Uint8Array(data)) };
}
async function unseal(box) {
  const [iv, data] = box.sealed.split('.').map(unb64);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await getDeviceKey(), data),
  );
}
// 把物件裡的機密欄位整個走一遍，加密或解密，回傳新物件（記憶體裡的 saved 一直是明文）
async function walkSecrets(value, fn) {
  if (Array.isArray(value)) return Promise.all(value.map((v) => walkSecrets(v, fn)));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = await fn(k, v);
  return out;
}
async function sealSecrets(value) {
  return walkSecrets(value, async (k, v) =>
    SECRET_FIELDS.includes(k) && typeof v === 'string' && v ? seal(v) : sealSecrets(v),
  );
}
async function unsealSecrets(value) {
  return walkSecrets(value, async (k, v) => {
    if (v && typeof v === 'object' && typeof v.sealed === 'string') {
      try {
        return await unseal(v);
      } catch {
        return ''; // 鑰匙不見了（例如清過網站資料又匯回舊資料），只能重填
      }
    }
    return unsealSecrets(v);
  });
}

async function loadSaved() {
  try {
    const [keys, values] = await Promise.all([
      kvRequest('readonly', (s) => s.getAllKeys()),
      kvRequest('readonly', (s) => s.getAll()),
    ]);
    keys.forEach((k, i) => (saved[k] = values[i]));
    delete saved.__deviceKey;
    for (const k of SEALED_KEYS) if (saved[k]) saved[k] = await unsealSecrets(saved[k]);
  } catch {
    toast('瀏覽器不讓 Lumeet 存資料，關掉後聊天紀錄會不見');
  }
  saved.profile ||= PURE ? { name: '我', avatar: 'assets/avatar-me.svg' } : { name: '涵寶', avatar: 'assets/han.webp' };
  saved.personas ||= PURE
    ? {
        shenyuan: { name: '他', badge: '', avatar: 'assets/avatar-a.svg', persona: '', memory: '', conn: {} },
        cenxu: { name: '另一個他', badge: '', avatar: 'assets/avatar-b.svg', persona: '', memory: '', conn: {} },
      }
    : {
        shenyuan: {
          name: '沉淵',
          badge: '邊牧',
          avatar: 'assets/shenyuan.webp',
          persona: '',
          memory: '',
          conn: {},
        },
        cenxu: { name: '岑序', badge: '橘貓', avatar: 'assets/cenxu.webp', persona: '', memory: '', conn: {} },
      };
  // 會客室的訪客：跟家人一樣存在 personas 裡，但不算家人（不進群、不上首頁）
  saved.personas.guest ||= {
    name: '訪客',
    badge: '客人',
    avatar: 'assets/favicon.svg',
    persona: '',
    memory: '',
    conn: {},
    inGroup: false,
  };
  for (const room of [...Object.keys(saved.personas), 'group']) saved['msgs:' + room] ||= [];
  saved.home ||= { since: '', partner: 'shenyuan' };
  for (const key of ['diary', 'anniversaries', 'posts', 'letters', 'album', 'ledger']) saved[key] ||= [];
  saved.period ||= { cycle: 28, length: 5, starts: [], share: false };
}
// 同一項排隊寫，加密要花時間，不排隊的話舊的可能比新的晚寫進去
const saveQueue = {};
function save(key) {
  saveQueue[key] = (saveQueue[key] || Promise.resolve()).then(async () => {
    try {
      const value = SEALED_KEYS.includes(key) ? await sealSecrets(saved[key]) : saved[key];
      await kvRequest('readwrite', (s) => s.put(value, key));
    } catch {
      toast('沒存進去，請確認手機還有空間');
    }
  });
  return saveQueue[key];
}
const savedReady = loadSaved();
