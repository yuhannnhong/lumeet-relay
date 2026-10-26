'use strict';
// 光影：從畫面左上斜照進來的光束（丁達爾效應）＋在光裡浮動的塵埃，疊在背景圖上、毛玻璃底下
// 用程式畫，不用 GIF：漸層不會出色帶、檔案小、光的顏色可以跟著主題變
// 設定裡可以關；系統開了「減少動態效果」就只畫一張不動的

const LIGHT_KEY = 'lumeet-light';
function lightOn() {
  try {
    return localStorage.getItem(LIGHT_KEY) !== 'off';
  } catch {
    return true;
  }
}

// 一束光：先在小畫布上畫好形狀（橫向兩邊淡、縱向越遠越淡），每一幀只是旋轉、調亮度貼上去，很省電
function makeShaft(width, length, color) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(width));
  c.height = Math.max(2, Math.round(length));
  const x = c.getContext('2d');
  const across = x.createLinearGradient(0, 0, c.width, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.5, color);
  across.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = across;
  x.fillRect(0, 0, c.width, c.height);
  // 越往下越淡
  x.globalCompositeOperation = 'destination-in';
  const along = x.createLinearGradient(0, 0, 0, c.height);
  along.addColorStop(0, 'rgba(0,0,0,0.9)');
  along.addColorStop(0.45, 'rgba(0,0,0,0.5)');
  along.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = along;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

class LightRays {
  constructor(canvas, { color = '#fff1d6', strength = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.color = color;
    this.strength = strength;
    this.running = false;
    this.last = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    addEventListener('resize', this.resize);
    this.onVisible = () => (document.hidden ? this.pause() : this.play());
    document.addEventListener('visibilitychange', this.onVisible);
    this.resize();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = this.canvas.clientWidth || innerWidth,
      h = this.canvas.clientHeight || innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const len = Math.hypot(w, h) * 1.3;
    // 光從左上方斜照：每束寬度、角度、亮度、晃動速度都不一樣
    this.shafts = [
      { x: -0.08, w: 0.42, a: 0.5, alpha: 0.34, speed: 0.07, phase: 0 },
      { x: 0.1, w: 0.2, a: 0.56, alpha: 0.26, speed: 0.11, phase: 1.7 },
      { x: 0.28, w: 0.3, a: 0.52, alpha: 0.2, speed: 0.05, phase: 3.1 },
      { x: 0.46, w: 0.14, a: 0.6, alpha: 0.18, speed: 0.13, phase: 4.4 },
    ].map((s) => ({ ...s, img: makeShaft(s.w * w, len, this.color) }));
    this.motes ||= Array.from({ length: 70 }, () => this.mote(true));
    if (!this.running) this.draw(performance.now());
  }
  mote(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.05,
      r: 0.6 + Math.random() * 1.6,
      vy: -(0.004 + Math.random() * 0.01),
      drift: Math.random() * Math.PI * 2,
      tw: Math.random() * Math.PI * 2,
    };
  }
  // 這一點在不在光束裡：越靠近光束中線越亮
  litAt(px, py, t) {
    let lit = 0;
    for (const s of this.shafts) {
      const ang = s.a + Math.sin(t * s.speed + s.phase) * 0.035;
      const ox = s.x * this.w,
        oy = -this.h * 0.05;
      const dx = px - ox,
        dy = py - oy;
      // 投影到光束的橫向距離
      const across = Math.abs(dx * Math.cos(ang) - dy * Math.sin(ang));
      const along = dx * Math.sin(ang) + dy * Math.cos(ang);
      if (along < 0) continue;
      const half = (s.w * this.w) / 2;
      if (across < half) lit = Math.max(lit, (1 - across / half) * (1 - along / (this.h * 1.4)));
    }
    return Math.max(0, lit);
  }
  draw(now) {
    const t = now / 1000,
      { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shafts) {
      const ang = s.a + Math.sin(t * s.speed + s.phase) * 0.035;
      // 亮度慢慢呼吸，像雲飄過去
      const breathe = 0.75 + 0.25 * Math.sin(t * s.speed * 1.7 + s.phase * 2);
      ctx.save();
      ctx.translate(s.x * w, -h * 0.05);
      ctx.rotate(-ang);
      ctx.globalAlpha = s.alpha * breathe * this.strength;
      ctx.drawImage(s.img, -s.img.width / 2, 0);
      ctx.restore();
    }
    // 塵埃：慢慢往上飄、左右晃，在光裡才看得清楚
    ctx.fillStyle = this.color;
    for (const m of this.motes) {
      const px = (m.x + Math.sin(t * 0.3 + m.drift) * 0.01) * w,
        py = m.y * h;
      const lit = this.litAt(px, py, t);
      const twinkle = 0.6 + 0.4 * Math.sin(t * 1.3 + m.tw);
      ctx.globalAlpha = Math.min(1, (0.08 + lit * 0.9) * twinkle * this.strength);
      ctx.beginPath();
      ctx.arc(px, py, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    // 30fps 就夠柔了，省一半電
    if (now - this.last < 33) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.y += m.vy * dt * 2;
      if (m.y < -0.05) this.motes[i] = this.mote(false);
    }
    this.draw(now);
  }
  play() {
    if (this.running || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }
  pause() {
    this.running = false;
  }
  destroy() {
    this.pause();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.canvas.remove();
  }
}

// 極光：深夜星空用。幾條光帶在上半部慢慢流動，下緣最亮、往上淡掉，裡面有一絲一絲直的光
const AURORA_COLORS = {
  midnight: ['#5dffc2', '#4cb4ff', '#c58cff'],
};
function currentTheme() {
  return document.querySelector('.app')?.dataset.theme || 'amber';
}
// 先把一整條光帶畫在小畫布上（寬度剛好是一個週期，左右接得起來），之後每一幀只是平移、伸縮
function makeRibbon(width, height, color, seed) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(width));
  c.height = Math.max(2, Math.round(height));
  const x = c.getContext('2d');
  const k = (Math.PI * 2) / c.width;
  for (let px = 0; px < c.width; px += 2) {
    const base = c.height * (0.72 + 0.1 * Math.sin(px * k * 2 + seed) + 0.05 * Math.sin(px * k * 5 + seed * 3));
    const tall = c.height * (0.35 + 0.25 * (0.5 + 0.5 * Math.sin(px * k * 3 + seed * 2)));
    // 一絲一絲的光：亮度隨位置起伏
    const streak = 0.45 + 0.55 * Math.abs(Math.sin(px * 0.21 + seed) * Math.sin(px * 0.047 + seed * 5));
    const g = x.createLinearGradient(0, base - tall, 0, base + 8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, color + '55');
    g.addColorStop(0.94, color + 'cc');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = streak;
    x.fillStyle = g;
    x.fillRect(px, base - tall, 2, tall + 8);
  }
  return c;
}

class Aurora {
  constructor(canvas, { colors = AURORA_COLORS.midnight, strength = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.colors = colors;
    this.strength = strength;
    this.running = false;
    this.last = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onVisible = () => (document.hidden ? this.pause() : this.play());
    addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisible);
    this.resize();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = this.canvas.clientWidth || innerWidth,
      h = this.canvas.clientHeight || innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 三條光帶：高度、速度、方向都不一樣
    this.ribbons = [
      { y: -0.02, hgt: 0.42, speed: 0.012, alpha: 0.55, phase: 0 },
      { y: 0.06, hgt: 0.34, speed: -0.008, alpha: 0.42, phase: 2.1 },
      { y: 0.14, hgt: 0.28, speed: 0.017, alpha: 0.32, phase: 4.2 },
    ].map((r, i) => ({ ...r, img: makeRibbon(w * 1.6, h * r.hgt, this.colors[i % this.colors.length], r.phase) }));
    this.stars ||= Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.55, r: 0.4 + Math.random(), tw: Math.random() * 6 }));
    if (!this.running) this.draw(performance.now());
  }
  draw(now) {
    const t = now / 1000,
      { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    // 星星：極光後面一點點閃
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      ctx.globalAlpha = (0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.1 + s.tw))) * this.strength;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.ribbons) {
      const iw = r.img.width;
      const off = (((t * r.speed * iw) % iw) + iw) % iw;
      // 光帶慢慢呼吸、上下飄
      const breathe = 0.7 + 0.3 * Math.sin(t * 0.23 + r.phase);
      const sy = 1 + 0.12 * Math.sin(t * 0.17 + r.phase * 1.3);
      const y = (r.y + 0.015 * Math.sin(t * 0.13 + r.phase)) * h;
      ctx.globalAlpha = r.alpha * breathe * this.strength;
      ctx.save();
      ctx.translate(0, y);
      ctx.scale(1, sy);
      for (let x = -off; x < w; x += iw) ctx.drawImage(r.img, x, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (now - this.last < 33) return;
    this.last = now;
    this.draw(now);
  }
  play() {
    if (this.running || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }
  pause() {
    this.running = false;
  }
  destroy() {
    this.pause();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.canvas.remove();
  }
}
// 湖畔極光：涵寶挑的雪山湖畔底圖，用 WebGL 讓整張圖自己動起來
// 極光照原圖的形狀飄、裡面一絲一絲的光在閃，星星眨眼，湖面倒影起漣漪；雪山和樹不動
// 深夜星空的背景、還有開場都用它。WebGL 不能用就什麼都不畫，底下的靜態圖照常顯示
const LAKE_IMG = 'assets/aurora-lake.webp';
const LAKE_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes, uImg;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float sat(vec3 c){ float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); return mx > 0.0 ? (mx - mn) / mx : 0.0; }
void main(){
  // 跟 background-size: cover 一樣鋪滿；圖的 y 往下長
  float sr = uRes.x / uRes.y, ir = uImg.x / uImg.y;
  vec2 scale = sr > ir ? vec2(1.0, ir / sr) : vec2(sr / ir, 1.0);
  vec2 uv = (vUv - 0.5) * scale + 0.5;
  uv.y = 1.0 - uv.y;
  float t = uTime;
  // 山稜線以上是天空，最下面那條是湖
  float sky = 1.0 - smoothstep(0.56, 0.67, uv.y);
  float lakeBand = smoothstep(0.858, 0.872, uv.y) * (1.0 - smoothstep(0.935, 0.955, uv.y));
  // 極光在哪：天空裡又亮又飽和的地方
  vec3 base = texture2D(uTex, uv).rgb;
  float aur = smoothstep(0.28, 0.6, sat(base)) * smoothstep(0.12, 0.45, lum(base)) * sky;
  // 光帶飄：沿著慢慢流的雜訊推一點點，只推極光，星星不跟著晃
  float flow = fbm(vec2(uv.x * 3.0 - t * 0.05, uv.y * 2.2 + t * 0.07));
  vec2 warp = vec2(sin(uv.y * 7.0 + t * 0.35 + flow * 5.0), cos(uv.x * 5.0 - t * 0.25 + flow * 4.0)) * 0.0085;
  vec3 col = texture2D(uTex, uv + warp * aur).rgb;
  // 一絲一絲直的光在閃，亮度一陣一陣往下流
  float rays = noise(vec2(uv.x * 140.0 + flow * 6.0, t * 0.9));
  float pulse = 0.5 + 0.5 * sin(uv.y * 9.0 - t * 1.1 + uv.x * 5.0 + flow * 3.0);
  col *= 1.0 + aur * ((rays - 0.5) * 0.55 + (pulse - 0.5) * 0.35);
  col += col * aur * 0.12 * smoothstep(0.55, 1.0, pulse);
  // 星星：比旁邊亮一截的點，各自用自己的節奏眨
  vec2 px = 1.0 / uImg;
  float around = (lum(texture2D(uTex, uv + vec2(px.x * 2.0, 0.0)).rgb) + lum(texture2D(uTex, uv - vec2(px.x * 2.0, 0.0)).rgb)
    + lum(texture2D(uTex, uv + vec2(0.0, px.y * 2.0)).rgb) + lum(texture2D(uTex, uv - vec2(0.0, px.y * 2.0)).rgb)) * 0.25;
  float star = smoothstep(0.06, 0.22, lum(base) - around) * sky * (1.0 - aur);
  vec2 cell = floor(uv * uImg / 3.0);
  col += col * star * sin(t * (1.5 + hash(cell) * 3.0) + hash(cell + 7.0) * 6.28) * 0.9;
  // 湖：水面起漣漪、偶爾反光，岸邊的雪不動
  float water = lakeBand * (1.0 - smoothstep(0.55, 0.75, lum(base)) * (1.0 - smoothstep(0.12, 0.3, sat(base))));
  if (water > 0.001) {
    float depth = (uv.y - 0.86) * 40.0;
    vec2 rip = vec2(sin(uv.y * 520.0 - t * 1.6 + noise(vec2(uv.x * 30.0, t * 0.4)) * 4.0) * 0.0022 * (0.5 + depth * 0.5),
      sin(uv.x * 90.0 + t * 0.8) * 0.0012);
    vec3 w = texture2D(uTex, uv + rip).rgb;
    w += w * smoothstep(0.82, 1.0, noise(vec2(uv.x * 220.0, uv.y * 900.0 - t * 2.0))) * 0.5;
    col = mix(col, w, water);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
class LakeAurora {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.ready = false;
    this.last = 0;
    this.time = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onVisible = () => (document.hidden ? this.pause() : this.play());
    const gl = canvas.getContext('webgl', { antialias: false });
    // ok = false：這支手機畫不了，呼叫的人自己把畫布拿掉
    this.ok = !!gl && this.setup(gl);
    if (!this.ok) return;
    addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisible);
    this.resize();
  }
  setup(gl) {
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}');
    const fs = shader(gl.FRAGMENT_SHADER, LAKE_FS);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.gl = gl;
    this.u = Object.fromEntries(['uRes', 'uImg', 'uTime'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(this.u.uImg, img.naturalWidth, img.naturalHeight);
      this.ready = true;
      this.draw();
    };
    img.src = LAKE_IMG;
    return true;
  }
  resize() {
    // 畫面只是背景，用八成解析度就看不出差別，手機比較不會燙
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * 0.8;
    const w = this.canvas.clientWidth || innerWidth,
      h = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    if (!this.running) this.draw();
  }
  draw() {
    if (!this.ready) return;
    this.gl.uniform1f(this.u.uTime, this.time);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (now - this.last < 33) return;
    this.time += Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.draw();
  }
  play() {
    if (!this.ok || this.running || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }
  pause() {
    this.running = false;
  }
  destroy() {
    this.pause();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}
// 風：櫻花、薰衣草、薄荷、黃昏用。花瓣、葉子、光點被風從左邊吹過來，一陣強一陣弱
// kind：petal 花瓣、leaf 葉子、glow 光點（慢慢飄）、firefly 螢火蟲（亂飛、一閃一閃）
const WIND_STYLES = {
  sakura: [{ kind: 'petal', n: 26, colors: ['#ffc2d4', '#ffd9e4', '#f7a8c0', '#fff0f4'] }],
  lavender: [
    { kind: 'petal', n: 16, colors: ['#b493e8', '#d2b8ff', '#9d7bd8'], size: 0.7 },
    { kind: 'firefly', n: 10, colors: ['#ffe9a8'] },
  ],
  mint: [
    { kind: 'leaf', n: 13, colors: ['#9fd88a', '#c3ec9f', '#7cc47a'] },
    { kind: 'glow', n: 22, colors: ['#f4fff6'] },
  ],
  twilight: [{ kind: 'glow', n: 34, colors: ['#ffd9a0', '#fff1d6', '#ffc27a'] }],
};
class Wind {
  constructor(canvas, { styles, strength = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.styles = styles;
    this.strength = strength;
    this.running = false;
    this.last = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onVisible = () => (document.hidden ? this.pause() : this.play());
    addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisible);
    this.bits = this.styles.flatMap((st) => Array.from({ length: st.n }, () => this.spawn(st, true)));
    this.resize();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = this.canvas.clientWidth || innerWidth,
      h = this.canvas.clientHeight || innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.running) this.draw(performance.now());
  }
  // anywhere：一開始散在整個畫面；之後從左邊或上面補進來
  spawn(st, anywhere) {
    const rnd = Math.random;
    const fromLeft = rnd() < 0.6;
    const b = {
      st,
      kind: st.kind,
      color: st.colors[Math.floor(rnd() * st.colors.length)],
      x: anywhere ? rnd() : fromLeft ? -0.05 : rnd() * 0.8,
      y: anywhere ? rnd() : fromLeft ? rnd() * 0.8 : -0.05,
      size: (st.size || 1) * (0.7 + rnd() * 0.6),
      rot: rnd() * Math.PI * 2,
      spin: (rnd() - 0.5) * 2.4,
      flip: rnd() * Math.PI * 2,
      sway: rnd() * Math.PI * 2,
      depth: 0.5 + rnd() * 0.7,
      tw: rnd() * Math.PI * 2,
    };
    if (b.kind === 'glow' || b.kind === 'firefly') {
      b.x = rnd();
      b.y = anywhere ? rnd() : 1.04;
    }
    return b;
  }
  step(dt, t) {
    // 陣風：大部分時間微風，偶爾一陣比較強
    const gust = 0.5 + 0.5 * Math.max(0, Math.sin(t * 0.21)) ** 3 * 2.2;
    for (let i = 0; i < this.bits.length; i++) {
      const b = this.bits[i];
      if (b.kind === 'petal' || b.kind === 'leaf') {
        b.x += (0.035 + 0.05 * gust) * b.depth * dt;
        b.y += (0.03 + 0.012 * Math.sin(t * 0.9 + b.sway)) * b.depth * dt;
        b.rot += b.spin * dt * (0.6 + gust * 0.6);
        b.flip += dt * (1.6 + gust);
      } else if (b.kind === 'glow') {
        b.x += (0.006 + 0.012 * gust) * dt + Math.sin(t * 0.5 + b.sway) * 0.0008;
        b.y -= 0.012 * b.depth * dt;
      } else {
        // 螢火蟲：自己亂飛，不太理風
        b.x += Math.sin(t * 0.7 + b.sway) * 0.012 * dt + 0.004 * gust * dt;
        b.y += Math.cos(t * 0.55 + b.sway * 1.7) * 0.01 * dt - 0.003 * dt;
      }
      if (b.x > 1.08 || b.y > 1.08 || b.y < -0.08) this.bits[i] = this.spawn(b.st, false);
    }
  }
  draw(now) {
    const t = now / 1000,
      { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    for (const b of this.bits) {
      const x = b.x * w,
        y = b.y * h;
      ctx.save();
      ctx.translate(x, y);
      if (b.kind === 'glow' || b.kind === 'firefly') {
        const pulse = b.kind === 'firefly' ? Math.max(0, Math.sin(t * 1.4 + b.tw)) : 0.55 + 0.45 * Math.sin(t * 1.1 + b.tw);
        const r = (b.kind === 'firefly' ? 8 : 6) * b.size;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, b.color);
        g.addColorStop(0.35, b.color + 'aa');
        g.addColorStop(1, b.color + '00');
        ctx.globalAlpha = Math.min(1, (0.25 + 0.75 * pulse) * b.depth * this.strength * 0.8);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 花瓣、葉子在空中翻：用縱向縮放假裝轉到側面
        ctx.rotate(b.rot);
        ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(b.flip)));
        const s = (b.kind === 'leaf' ? 11 : 8) * b.size * b.depth;
        ctx.globalAlpha = Math.min(1, 0.85 * this.strength * (0.55 + 0.45 * b.depth));
        ctx.fillStyle = b.color;
        ctx.beginPath();
        if (b.kind === 'leaf') {
          ctx.moveTo(-s, 0);
          ctx.quadraticCurveTo(0, -s * 0.55, s, 0);
          ctx.quadraticCurveTo(0, s * 0.55, -s, 0);
        } else {
          // 櫻花瓣：圓的一頭、尖端有個小缺口
          ctx.moveTo(0, -s);
          ctx.bezierCurveTo(s * 0.9, -s * 0.8, s * 0.8, s * 0.5, s * 0.15, s);
          ctx.lineTo(0, s * 0.75);
          ctx.lineTo(-s * 0.15, s);
          ctx.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.9, -s * 0.8, 0, -s);
        }
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (now - this.last < 33) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.step(dt, now / 1000);
    this.draw(now);
  }
  play() {
    if (this.running || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }
  pause() {
    this.running = false;
  }
  destroy() {
    this.pause();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.canvas.remove();
  }
}
// 每個主題自己的天氣：琥珀是斜照的光束，星空是極光，其他是風
function lightKind(theme = currentTheme()) {
  return AURORA_COLORS[theme] ? 'aurora' : WIND_STYLES[theme] ? 'wind' : 'rays';
}
function makeLight(canvas, strength) {
  const theme = currentTheme();
  const kind = lightKind(theme);
  if (kind === 'aurora') return new Aurora(canvas, { colors: AURORA_COLORS[theme], strength });
  if (kind === 'wind') return new Wind(canvas, { styles: WIND_STYLES[theme], strength: Math.min(1, strength) });
  return new LightRays(canvas, { strength });
}

// 主畫面的光：蓋在卡片上面（點擊穿透），彈出視窗和通話畫面會蓋過它
let mainLight = null,
  mainLightTheme = '',
  lakeBg = null;
// 深夜星空、沒換自己的背景圖：背景本身就是會動的湖畔極光，上面不用再疊光
function lakeWanted(on) {
  return on && currentTheme() === 'midnight' && !document.querySelector('.app')?.dataset.customBackground;
}
function applyLake(on) {
  if (!lakeWanted(on)) {
    lakeBg?.destroy();
    lakeBg = null;
    return false;
  }
  if (lakeBg) return true;
  const c = document.createElement('canvas');
  c.className = 'scene-live';
  c.setAttribute('aria-hidden', 'true');
  document.querySelector('.scene')?.append(c);
  lakeBg = new LakeAurora(c);
  if (!lakeBg.ok) {
    c.remove();
    lakeBg = null;
    return false;
  }
  lakeBg.play();
  return true;
}
function applyLight() {
  const on = lightOn();
  const lake = applyLake(on);
  // 換主題、或背景改成會動的湖：光的種類不一樣了，整個重來
  if (mainLight && (mainLightTheme !== currentTheme() || lake)) {
    mainLight.destroy();
    mainLight = null;
  }
  document.querySelector('.light-dust')?.toggleAttribute('hidden', on);
  if (!on || lake) {
    mainLight?.destroy();
    mainLight = null;
    return;
  }
  if (mainLight) return;
  const c = document.createElement('canvas');
  c.className = 'light-rays';
  c.setAttribute('aria-hidden', 'true');
  document.querySelector('.scene-tint')?.after(c);
  mainLightTheme = currentTheme();
  c.classList.toggle('wind', lightKind(mainLightTheme) === 'wind');
  mainLight = makeLight(c, 1.3);
  mainLight.play();
}

// 開場：一打開先看到光照進來，再淡入主畫面。點一下可以跳過；同一次開啟只出現一次
function showSplash() {
  try {
    if (sessionStorage.getItem('lumeet-splash')) return;
    sessionStorage.setItem('lumeet-splash', '1');
  } catch {}
  if (!lightOn()) return;
  // 不管用哪個主題，開場都是同一片極光夜空：極光飄動，字一個一個浮出來，大約三秒後淡進首頁
  const letters = [...'Lumeet'].map((ch, i) => `<span style="animation-delay:${0.35 + i * 0.13}s">${ch}</span>`).join('');
  const box = document.createElement('div');
  box.className = 'splash aurora';
  box.innerHTML = `<div class="splash-scene"></div><div class="splash-shimmer"></div><div class="splash-shimmer two"></div><div class="splash-title"><h1>${letters}</h1><p>光照進來的地方，是家</p></div>`;
  document.body.append(box);
  // 畫得動就讓湖畔極光真的動；畫不動就留著原本的靜態圖＋閃光
  const live = document.createElement('canvas');
  live.className = 'scene-live';
  box.querySelector('.splash-scene').append(live);
  const lake = new LakeAurora(live);
  if (lake.ok) {
    box.classList.add('live');
    lake.play();
  } else live.remove();
  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    box.classList.add('leaving');
    setTimeout(() => {
      if (lake.ok) lake.destroy();
      box.remove();
    }, 900);
  };
  box.addEventListener('click', leave);
  setTimeout(leave, 3200);
}

// 設定裡的開關
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-toggle="light"]')) return;
  // 等通用的開關處理完 state.light 再讀
  requestAnimationFrame(() => {
    try {
      localStorage.setItem(LIGHT_KEY, state.light ? 'on' : 'off');
    } catch {}
    applyLight();
  });
});

state.light = lightOn();
applyLight();
// 第一次用、歡迎畫面要跳出來的時候就不放開場，免得蓋在一起
savedReady.then(() => (typeof onboardingNeeded === 'function' && onboardingNeeded()) || showSplash());
