'use strict';
// 新手引導：第一次打開、還沒有人接上 AI 時，一步一步帶到「傳出第一句話」。
// 每家服務旁邊寫一句特性，讓人知道限制是來自模型，不是 Lumeet。
const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    note: '內容規範比較嚴',
    url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    note: '有免費額度，內容規範比較嚴',
    url: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    note: '便宜，大陸可直連',
    url: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'siliconflow',
    name: '硅基流動',
    base: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    note: '大陸可直連，模型很多',
    url: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    note: '一把 Key 用很多家模型，規範看選哪個',
    url: 'https://openrouter.ai/keys',
  },
  { id: 'custom', name: '中轉站／其他', base: '', model: '', note: '填中轉站給妳的網址和 Key', url: '' },
];
const onboard = { step: 0, id: 'shenyuan', provider: null };

function onboardingNeeded() {
  return !saved.onboarded && !memberIds().some((id) => connReady(saved.personas[id].conn));
}
function finishOnboarding(goChat) {
  saved.onboarded = true;
  save('onboarded');
  closeSheet();
  if (goChat) navigate('single', onboard.id);
  else render(page);
}
function stepDots() {
  return `<div class="onboard-dots">${[0, 1, 2, 3].map((i) => `<i class="${i === onboard.step ? 'on' : ''}"></i>`).join('')}</div>`;
}
function showOnboarding() {
  if (!saved.personas[onboard.id]) onboard.id = memberIds()[0];
  const p = saved.personas[onboard.id];
  const steps = [
    () =>
      `<p>這裡是你們的小家。先花兩分鐘，幫他接上 AI，接好就能聊天、打電話。</p>${field('ob-me', '妳想被怎麼叫？', saved.profile.name)}<button class="primary-action gold" data-onboard="next">開始</button><button class="background-reset" data-onboard="skip">先逛逛，晚點再設定</button>`,
    () =>
      `<p>他是誰？名字和人設之後都能在設定裡改。</p>${field('ob-name', '他的名字', p.name)}<label class="field">人設（選填）<textarea id="ob-persona" class="form-input" rows="4" placeholder="他是誰、怎麼說話、你們是什麼關係">${escapeHTML(p.persona)}</textarea></label><button class="primary-action gold" data-onboard="next">下一步</button>`,
    () =>
      `<p>他要住在哪家 AI 裡？</p><div class="provider-list">${PROVIDERS.map((v) => `<button class="provider glass" data-provider="${v.id}"><strong>${v.name}</strong><small>${v.note}</small></button>`).join('')}<button class="provider glass" data-provider="mcp"><strong>MCP 橋接</strong><small>他住在 Claude、ChatGPT 這類訂閱帳號裡</small></button></div>`,
    () => {
      const v = onboard.provider;
      if (v === 'mcp')
        return `<p>先用電腦部署 Lumeet 的橋接器（教學裡有），會拿到網址和密碼。</p>${field('c-relay', '橋接網址', p.conn.relay, 'url', 'https://xxx.workers.dev')}${field('c-secret', '橋接密碼', p.conn.secret, 'password')}<p class="sheet-note">再把橋接器的 MCP 網址加到他住的 AI，跟他說「進入 Lumeet 聊天模式」。</p><p id="conn-result" class="sheet-note"></p><button class="primary-action gold" data-onboard="test">測試連線</button>`;
      return `${v.url ? `<p>到 <a href="${v.url}" target="_blank" rel="noopener">${v.name} 的後台</a> 建一把 API Key，複製回來貼上。Key 只存在這支手機。</p>` : '<p>填上中轉站給妳的資料。</p>'}${field('c-base', 'Base URL', v.base, 'url', 'https://…/v1')}${field('c-key', 'API Key', '', 'password')}${field('c-model', '模型名稱', v.model, 'text', '跟後台寫的一字不差')}<p id="conn-result" class="sheet-note"></p><button class="primary-action gold" data-onboard="test">測試連線</button>`;
    },
  ];
  openSheet(
    ['歡迎回家', `第二步・${escapeHTML(p.name)}`, '第三步・接上 AI', '最後一步・測試'][onboard.step],
    stepDots() + steps[onboard.step](),
  );
}
function obConn() {
  const v = (id) => document.querySelector('#' + id).value.trim();
  return onboard.provider === 'mcp'
    ? { mode: 'mcp', relay: v('c-relay'), secret: v('c-secret') }
    : { mode: 'api', base: v('c-base'), key: v('c-key'), model: v('c-model') };
}
async function onboardTest(button) {
  const out = document.querySelector('#conn-result'),
    conn = obConn();
  if (!connReady(conn)) {
    out.textContent = '還有欄位沒填';
    return;
  }
  button.disabled = true;
  out.textContent = '測試中…';
  try {
    out.textContent = await testConn(conn);
    saved.personas[onboard.id].conn = conn;
    save('personas');
    if (conn.mode === 'mcp') listenRelay(onboard.id);
    button.textContent = `去跟${personaName(onboard.id)}說第一句話`;
    button.dataset.onboard = 'done';
  } catch (e) {
    out.textContent =
      '沒連上：' +
      (e.message === 'Failed to fetch'
        ? '網址打不開，或這家服務不允許網頁直接連，可以換一家或改用中轉站'
        : e.message);
  } finally {
    button.disabled = false;
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-onboard],[data-provider]');
  if (!b) return;
  if (b.dataset.provider) {
    onboard.provider =
      b.dataset.provider === 'mcp' ? 'mcp' : PROVIDERS.find((v) => v.id === b.dataset.provider);
    onboard.step = 3;
    showOnboarding();
    return;
  }
  const act = b.dataset.onboard;
  if (act === 'skip') finishOnboarding(false);
  else if (act === 'test') onboardTest(b);
  else if (act === 'done') finishOnboarding(true);
  else if (act === 'next') {
    if (onboard.step === 0) {
      const name = document.querySelector('#ob-me').value.trim();
      if (name) saved.profile.name = name;
      save('profile');
    } else if (onboard.step === 1) {
      const p = saved.personas[onboard.id];
      p.name = document.querySelector('#ob-name').value.trim() || p.name;
      p.persona = document.querySelector('#ob-persona').value.trim();
      save('personas');
    }
    onboard.step++;
    showOnboarding();
  }
});
