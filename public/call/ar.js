'use strict';
// AR 合拍：後鏡頭當背景，把 Vivix 的角色影片摳掉背景疊上去。角色圖片用純綠背景最好摳
// 網址帶 ?ar=1 就是 AR 模式；不會開前鏡頭，改開後鏡頭

const arLog = (m) => console.log('[AR]', m);
const arMode = new URLSearchParams(location.search).get('ar') === '1';
if (arMode) document.documentElement.classList.add('ar-mode');
let arStream = null,
  arRaf = 0;

// AR 模式一打開頁面就開後鏡頭，等他的影片進來再疊上去
async function arCamera() {
  if (!arMode || document.getElementById('ar-bg')) return;
  const stage = document.getElementById('video-stage');
  const bg = document.createElement('video');
  bg.id = 'ar-bg';
  bg.autoplay = bg.muted = bg.playsInline = true;
  bg.setAttribute('playsinline', '');
  stage.prepend(bg);
  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    bg.srcObject = arStream;
  } catch (e) {
    arLog(`後鏡頭打不開：${e.message}`);
  }
}
// 還沒接通前先用他的角色圖片（綠幕）站在畫面裡，接通後換成會動的 Vivix 影片
let arStill = null;
function arLoadStill() {
  try {
    const url = JSON.parse(localStorage.getItem('ai-video-call-settings') || '{}').charImg;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => (arStill = img);
    img.src = url;
  } catch {}
}
function arBoot() {
  arLoadStill();
  arCamera();
  startAr();
  // 一打開就自動接通，不用再按「開始視訊」
  setTimeout(() => document.getElementById('btn-start')?.click(), 300);
}
if (arMode) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arBoot);
  else arBoot();
}

let arDrawing = false;
// 人像分割（MediaPipe），只在 AR 模式載入
let arSeg = null;
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
async function arLoadSeg() {
  try {
    const { FilesetResolver, ImageSegmenter } = await import(`${MP}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const make = (delegate) =>
      ImageSegmenter.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate,
        },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    arSeg = await make('GPU').catch(() => make('CPU'));
    arLog('人像分割已載入');
  } catch (e) {
    arLog(`人像分割載不了，改用背景淹水：${e.message}`);
  }
}
function arSegment(canvas, img) {
  if (!arSeg) return false;
  try {
    const res = arSeg.segmentForVideo(canvas, performance.now());
    const conf = res.confidenceMasks?.[0]?.getAsFloat32Array();
    const d = img.data;
    if (conf) for (let i = 0, j = 0; i < d.length; i += 4, j++) d[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (conf[j] - 0.35) / 0.3)));
    res.close?.();
    return !!conf;
  } catch (e) {
    arLog(`人像分割失敗，改用背景淹水：${e.message}`);
    arSeg = null;
    return false;
  }
}
async function startAr() {
  if (!arMode || arDrawing) return;
  arDrawing = true;
  arLoadSeg();
  await arCamera();
  const stage = document.getElementById('video-stage');
  const fg = document.createElement('canvas');
  fg.id = 'ar-fg';
  stage.append(fg);
  stage.classList.add('ar-on');
  // 摳綠在小畫布上做，省電；再放大畫到全螢幕
  const work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const ctx = fg.getContext('2d');
  const draw = () => {
    arRaf = requestAnimationFrame(draw);
    const live = stage.querySelector('video:not(#ar-bg)');
    const v = live && live.videoWidth ? live : arStill;
    if (!v) return;
    const vw = v.videoWidth || v.naturalWidth,
      vh = v.videoHeight || v.naturalHeight;
    const scale = Math.min(1, 480 / vh);
    work.width = Math.round(vw * scale);
    work.height = Math.round(vh * scale);
    wctx.drawImage(v, 0, 0, work.width, work.height);
    let img;
    try {
      img = wctx.getImageData(0, 0, work.width, work.height);
    } catch {
      return; // 圖片在別的網域、讀不到像素：摳不了綠，就先不畫
    }
    // 動起來的影片優先用人像分割摳人（背景長怎樣都不管）；模型還沒載好、載不了，或還在用綠幕原圖時，用 arKey
    if (!(v !== arStill && arSegment(work, img))) arKey(img);
    wctx.putImageData(img, 0, 0);
    const W = (fg.width = fg.clientWidth * devicePixelRatio);
    const H = (fg.height = fg.clientHeight * devicePixelRatio);
    // 站著：放在畫面下方四分之三高、置中；躺著：轉 90 度、頭朝右，橫跨畫面
    // 手指可以拖著移動、兩指縮放
    const lying = arPose.rot === 1;
    const h = lying ? Math.min(W * 0.95, H * 0.75) : H * 0.75,
      w = (h * work.width) / work.height;
    const s = arPose.s;
    const cx = W / 2 + arPose.dx * devicePixelRatio,
      cy = (lying ? H * 0.62 : H - h / 2) + arPose.dy * devicePixelRatio;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    if (lying) ctx.rotate(Math.PI / 2);
    ctx.scale(s, s);
    ctx.drawImage(work, -w / 2, -h / 2, w, h);
    ctx.restore();
  };
  draw();
  // 拍合照的按鈕
  const shot = document.createElement('button');
  shot.id = 'ar-shot';
  shot.type = 'button';
  shot.setAttribute('aria-label', '拍合照');
  shot.onclick = arSnapshot;
  document.body.append(shot);
  // 轉成躺著（頭朝右）／站回來
  const turn = document.createElement('button');
  turn.id = 'ar-turn';
  turn.type = 'button';
  turn.textContent = '躺下';
  turn.onclick = () => {
    arPose.rot = arPose.rot ? 0 : 1;
    arPose.dx = arPose.dy = 0;
    turn.textContent = arPose.rot ? '站起來' : '躺下';
  };
  document.body.append(turn);
  arGestures(fg);
  arLog('AR 合拍已開啟');
}

// Vivix 不會老實保留綠幕，常重畫成灰紫色條紋。所以不認死綠色：
// 取畫面上緣和兩側的顏色當背景色，從邊框往內淹，跟背景色接近（或偏綠）的都摳掉；
// 只淹得到跟邊框連著的地方，人身上跟背景同色的地方不會被挖空
function arKey(img) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  let r0 = 0,
    g0 = 0,
    b0 = 0,
    k = 0;
  const sample = (i) => {
    r0 += d[i * 4];
    g0 += d[i * 4 + 1];
    b0 += d[i * 4 + 2];
    k++;
  };
  for (let x = 0; x < w; x += 2) sample(x);
  for (let y = 0; y < h; y += 2) sample(y * w), sample(y * w + w - 1);
  (r0 /= k), (g0 /= k), (b0 /= k);
  const isBg = (i) => {
    const r = d[i * 4],
      g = d[i * 4 + 1],
      b = d[i * 4 + 2];
    return g - Math.max(r, b) > 20 || (r - r0) ** 2 + (g - g0) ** 2 + (b - b0) ** 2 < 75 * 75;
  };
  const bg = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (!bg[i] && isBg(i)) (bg[i] = 1), stack.push(i);
  };
  for (let x = 0; x < w; x++) push(x), push(n - w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (stack.length) {
    const i = stack.pop(),
      x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }
  // Vivix 條紋之間的細黑線（兩格寬以內）也當背景
  for (let i = 0; i < n; i++) {
    const x = i % w;
    if (!bg[i] && x > 1 && x < w - 2 && (bg[i - 1] || bg[i - 2]) && (bg[i + 1] || bg[i + 2])) bg[i] = 2;
  }
  for (let i = 0; i < n; i++) {
    if (bg[i]) d[i * 4 + 3] = 0;
    else {
      // 貼著背景的邊緣半透明、去掉綠色反光，比較不毛
      const x = i % w;
      const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < n - w && bg[i + w]);
      if (edge) {
        d[i * 4 + 3] = 140;
        d[i * 4 + 1] = Math.min(d[i * 4 + 1], Math.max(d[i * 4], d[i * 4 + 2]));
      }
    }
  }
}

// 他在畫面裡的位置：rot 0 站著、1 躺著；dx、dy 是拖曳的位移（CSS 像素）；s 是縮放
const arPose = { rot: 0, dx: 0, dy: 0, s: 1 };
function arGestures(el) {
  const pts = new Map();
  let start = null;
  const snap = () => {
    const [a, b] = [...pts.values()];
    return { dx: arPose.dx, dy: arPose.dy, s: arPose.s, a: { ...a }, dist: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 };
  };
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = snap();
  });
  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()];
    if (b && start.dist) arPose.s = Math.min(3, Math.max(0.3, (start.s * Math.hypot(a.x - b.x, a.y - b.y)) / start.dist));
    else if (!b) {
      arPose.dx = start.dx + a.x - start.a.x;
      arPose.dy = start.dy + a.y - start.a.y;
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    start = pts.size ? snap() : null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function stopAr() {
  cancelAnimationFrame(arRaf);
  arDrawing = false;
  document.getElementById('ar-fg')?.remove();
  document.getElementById('ar-shot')?.remove();
  document.getElementById('ar-turn')?.remove();
  document.getElementById('video-stage')?.classList.remove('ar-on');
}

// 拍一張合照：後鏡頭畫面＋他
function arSnapshot() {
  const bg = document.getElementById('ar-bg'),
    fg = document.getElementById('ar-fg');
  if (!bg || !fg) return;
  const c = document.createElement('canvas');
  c.width = fg.width;
  c.height = fg.height;
  const x = c.getContext('2d');
  // 背景照 object-fit: cover 的方式裁
  const s = Math.max(c.width / bg.videoWidth, c.height / bg.videoHeight);
  x.drawImage(bg, (c.width - bg.videoWidth * s) / 2, (c.height - bg.videoHeight * s) / 2, bg.videoWidth * s, bg.videoHeight * s);
  x.drawImage(fg, 0, 0);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/jpeg', 0.92);
  a.download = `lumeet-ar-${Date.now()}.jpg`;
  document.body.append(a);
  a.click();
  a.remove();
  arLog('合照存好了');
}
