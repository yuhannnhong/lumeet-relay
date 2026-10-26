'use strict';
const paths = {
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  chat: 'M21 11a8 8 0 0 1-8 8H5l-3 3V5a2 2 0 0 1 2-2h9a8 8 0 0 1 8 8Z',
  cottage: 'm2 11 10-9 10 9M5 9v12h5v-6h4v6h5V9M9 5V2H6v6',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  settings:
    'm10 2-.7 3-2 .9-2.7-.9-2 3.5 2 2.2v2.6l-2 2.2 2 3.5 2.8-.9 1.9 1L10 22h4l.7-3 2-1 2.7 1 2-3.5-2-2.2v-2.6l2-2.2-2-3.5-2.8.9-1.9-.9L14 2h-4ZM15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0',
  back: 'm15 4-8 8 8 8',
  chevron: 'm9 5 7 7-7 7',
  down: 'm5 9 7 7 7-7',
  up: 'm5 15 7-7 7 7',
  arrow: 'M4 12h16m-7-7 7 7-7 7',
  book: 'M12 5C8 2 4 3 2 4v16c4-2 7-2 10 0 3-2 6-2 10 0V4c-3-1-6-2-10 1Zm0 0v15M5 7l4 1M5 11l4 1m6-4 4-1m-4 5 4-1',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  party: 'm3 21 4-14 10 10-14 4Zm4-14 10 10M13 2l-1 5m7-3-3 4m6 1-5 2M8 2l1 2m12 12 1 1',
  camera: 'M3 7h4l2-3h6l2 3h4v14H3V7ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  coin: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M13 7h-2a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-2M12 5v14',
  leaf: 'M12 21C2 20 1 12 3 8c6 0 10 5 9 13ZM12 21c10-1 11-9 9-13-6 0-10 5-9 13ZM12 15c-4-5-3-9 0-13 4 4 4 8 0 13',
  music: 'M9 18V5l12-3v13M9 8l12-3M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0m12-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
  smile: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M7 14c2 4 8 4 10 0M8 8h.01M16 8h.01',
  link: 'm10 14 4-4M9 17l-1 1a4 4 0 1 1-6-6l4-4a4 4 0 0 1 6 0m0 8a4 4 0 0 0 6 0l4-4a4 4 0 1 0-6-6l-1 1',
  cup: 'M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M2 23h17M7 2v3m5-3v3',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 7 7',
  plus: 'M12 4v16M4 12h16',
  addchat: 'M21 11v8H6l-4 3V3h19v8M7 10h9m-4-4v8',
  door: 'M4 21h16M7 21V3l10-2v20M11 11v2',
  lock: 'M5 10h14v12H5V10Zm3 0V6a4 4 0 0 1 8 0v4M12 15v3',
  mic: 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4Zm-4 6v2a7 7 0 0 0 14 0v-2M12 19v4m-4 0h8',
  micOff:
    'm2 2 20 20M9 5V4a3 3 0 0 1 6 0v7M9 9v3a3 3 0 0 0 5 2m5-4v2c0 1-.2 2-.7 3M5 10v2a7 7 0 0 0 10 6M12 19v4m-4 0h8',
  phone: 'M22 16v4a2 2 0 0 1-2.2 2A20 20 0 0 1 2 4.2 2 2 0 0 1 4 2h4l2 6-3 2a15 15 0 0 0 7 7l2-3 6 2Z',
  hangup: 'M3 16v-4a16 16 0 0 1 18 0v4l-5-2v-3a12 12 0 0 0-8 0v3l-5 2Z',
  video: 'M3 5h12v14H3V5Zm12 5 7-4v12l-7-4',
  send: 'm22 2-7 20-4-9L2 9l20-7ZM11 13 22 2',
  medal:
    'M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0m-9 4-2 10 6-3 6 3-2-10M12 5l1 2 2 .5-1.5 1.3.3 2.2L12 10l-1.8 1 .3-2.2L9 7.5l2-.5 1-2',
  check: 'm5 12 4 4L20 5',
  checks: 'm1 12 5 5L17 5m-6 11 3 3L24 7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  share:
    'M17 5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m0 14a3 3 0 1 1 6 0 3 3 0 0 1-6 0M7 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0m0-1 10-5M7 13l10 5',
  robot: 'M5 6h14v14H5V6Zm7 0V2m-2 0h4M1 10v6m22-6v6M8 10h.01M16 10h.01M8 16h8',
  bolt: 'm13 2-9 12h7l-1 8L21 9h-8V2Z',
  user: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 22v-3a9 9 0 0 1 18 0v3H3Z',
  users:
    'M10 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0m10 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0M1 21v-3a6 6 0 0 1 12 0v3H1Zm12 0h10v-3a6 6 0 0 0-8-6',
  key: 'M10 10a5 5 0 1 1-10 0 5 5 0 0 1 10 0m0 0h13m-4 0v4m-4-4v3M5 10h.01',
  brain:
    'M12 4c-4-6-10 0-7 4-6 1-4 8 0 8-1 4 5 7 7 2 2 5 8 2 7-2 4 0 6-7 0-8 3-4-3-10-7-4Zm0 0v14M6 7l2 2m-3 7 3-3m11-6-3 2m3 7-3-3',
  minus: 'M4 12h16M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  alarm: 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0M12 8v5l3 2M2 4l3-3m14 0 3 3M5 19l-2 3m16-3 2 3',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 10 3 3 5-6',
  export: 'M12 15V1m-4 4 4-4 4 4M5 9H2v13h20V9h-3',
  palette:
    'M12 2a10 10 0 1 0 0 20h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h2a4 4 0 0 0 4-4c0-5-5-8-10-8ZM7 8h.01M12 5h.01M17 7h.01M5 13h.01',
  fire: 'M12 2c2 6-4 6-1 10 2 1 3-2 3-4 8 6 5 14-2 14S1 15 7 9c-1 5 2 5 3 3-3-4 2-6 2-10Z',
  moon: 'M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11Z',
  edit: 'm16 3 5 5-12 12-7 2 2-7L16 3ZM13 6l5 5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4',
  volume: 'M3 9h4l5-5v16l-5-5H3V9Zm13-1a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14',
  close: 'm5 5 14 14M19 5 5 19',
  trash: 'M3 6h18M9 6V2h6v4M5 6l1 16h12l1-16M10 10v8m4-8v8',
  cloud: 'M6 19a5 5 0 1 1 0-10 7 7 0 0 1 14-1 5.5 5.5 0 0 1-1 11H6Z',
  sparkles: 'm12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z',
  sofa: 'M4 13V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M4 13a2 2 0 1 0-4 0v8h24v-8a2 2 0 1 0-4 0v4H4v-4ZM4 21v2m16-2v2',
};
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.sparkles}"/></svg>`;
}
function who(id) {
  return id === 'han' || id === 'me' ? saved.profile : saved.personas[id];
}
function avatar(id = 'shenyuan', size = 48, presence = false) {
  if (id === 'group')
    return `<span class="avatar group" style="--size:${size}px">${['me', ...groupIds()]
      .slice(0, 3)
      .map((x) => `<img src="${escapeHTML(who(x).avatar)}" alt="${escapeHTML(who(x).name)}">`)
      .join('')}</span>`;
  return `<span class="avatar" style="--size:${size}px"><img src="${escapeHTML(who(id).avatar)}" alt="${escapeHTML(who(id).name)}">${presence ? `<span class="presence ${saved.personas[id] && connReady(saved.personas[id].conn) ? 'online' : ''}"></span>` : ''}</span>`;
}
const app = document.querySelector('#app'),
  main = document.querySelector('#main'),
  header = document.querySelector('#header'),
  navigation = document.querySelector('#navigation'),
  sheet = document.querySelector('#sheet'),
  sheetContent = document.querySelector('#sheet-content');
const titles = {
  home: 'Home',
  chats: '聊天列表',
  sanctuary: 'Sanctuary',
  space: 'Space',
  settings: 'Settings',
  themes: 'Theme Picker',
  group: 'Chat Group',
  single: '聊天',
  chatsettings: 'Chat Settings',
  cottage: 'Our Little Home',
  incoming: '來電中',
  call: '語音通話',
};
let page = 'home',
  selectedPerson = 'cenxu',
  selectedTheme = readPreference('lumeet-theme') || 'amber',
  appliedTheme = selectedTheme,
  toastTimer,
  callTimer,
  callStart = 0,
  searchVisible = false;
const validThemes = ['amber', 'mint', 'lavender', 'sakura', 'midnight', 'twilight'];
if (!validThemes.includes(appliedTheme)) appliedTheme = selectedTheme = 'amber';
const state = {
  liquid: readPreference('lumeet-glass') !== 'frost',
  playing: true,
  milk: false,
  dnd: false,
  wake: true,
  muted: false,
  speaker: true,
};
const nameOf = () => (selectedPerson === 'guest' ? '會客室' : escapeHTML(personaName(selectedPerson)));
function clock(at) {
  return new Date(at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function lastLine(room) {
  const m = saved['msgs:' + room].at(-1);
  if (!m) return ['還沒有訊息，打聲招呼吧', ''];
  const prefix = room === 'group' ? personaName(m.from) + '：' : '';
  const day = new Date(m.at).toDateString() === new Date().toDateString();
  return [
    prefix + m.text,
    day ? clock(m.at) : new Date(m.at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
  ];
}
function brand() {
  return '<span class="brand"><i class="moon" aria-hidden="true"></i><span>LUMEET</span></span>';
}
function round(name, label, action, cls = '') {
  return `<button type="button" class="round ${cls}" aria-label="${label}" ${action ? `data-action="${action}"` : ''}>${icon(name)}</button>`;
}
function navigate(next, person) {
  if (person) selectedPerson = person;
  const hash = next === 'single' ? `${next}/${selectedPerson}` : next;
  if (location.hash.slice(1) === hash) render(next);
  else location.hash = hash;
}
function setTheme(theme) {
  app.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (typeof applyLight === 'function') applyLight();
}
function render(next) {
  if (!titles[next]) next = 'home';
  page = next;
  clearInterval(callTimer);
  app.dataset.page = page;
  app.dataset.glass = state.liquid ? 'liquid' : 'frost';
  setTheme(appliedTheme);
  header.className = 'topbar';
  document.title = `${titles[page]} · LUMEET｜見妳`;
  const backPages = ['group', 'themes', 'chatsettings', 'cottage'];
  if (page === 'single') {
    header.classList.add('glass', 'compact');
    header.innerHTML = `${round('back', '返回聊天列表', 'back-chats')}<div class="top-title">${nameOf()}<div class="online">${connReady(saved.personas[selectedPerson]?.conn || {}) ? '<i class="dot"></i>在線' : '<i class="dot amber"></i>未接上'}</div></div><div class="call-tools">${selectedPerson === 'guest' ? '' : round('phone', '語音通話', 'incoming') + round('video', '視訊通話', 'video')}${round('settings', '聊天設定', 'chatsettings')}</div>`;
  } else {
    if (page === 'group') header.classList.add('glass', 'compact');
    header.innerHTML = `${backPages.includes(page) ? round('back', '返回', 'back') : ''}${page !== 'themes' && page !== 'chatsettings' ? brand() : ''}<span class="top-title">${page === 'single' ? escapeHTML(personaName(selectedPerson)) : titles[page]}</span><button class="profile" aria-label="個人設定" data-nav="settings">${avatar('han', 42)}</button>`;
  }
  const views = {
    home: homeView,
    chats: chatsView,
    group: groupView,
    single: singleView,
    settings: settingsView,
    themes: themesView,
    sanctuary: sanctuaryView,
    cottage: cottageView,
    space: spaceView,
    incoming: incomingView,
    call: callView,
    chatsettings: chatSettingsView,
  };
  main.innerHTML = `<div class="page">${views[page]()}</div>`;
  const dockPages = ['home', 'chats', 'sanctuary', 'space', 'settings', 'cottage'];
  if (dockPages.includes(page)) {
    const current = page === 'cottage' ? 'sanctuary' : page;
    navigation.innerHTML = `<div class="bottom-nav glass">${[
      ['home', 'home', '首頁'],
      ['chats', 'chat', '聊天'],
      ['sanctuary', 'cottage', '小家'],
      ['space', 'heart', '空間'],
      ['settings', 'settings', '設定'],
    ]
      .map(
        ([p, i, t]) =>
          `<a href="${location.pathname}#${p}" class="nav-item ${p === current ? 'active' : ''}" ${p === current ? 'aria-current="page"' : ''}>${icon(i, p === current && p === 'home' ? 'solid' : '')}<span>${t}</span></a>`,
      )
      .join('')}</div>`;
  } else if (page === 'group' || page === 'single') navigation.innerHTML = composer();
  else navigation.innerHTML = '';
  if (page === 'call') {
    callTimer = setInterval(() => {
      const el = document.querySelector('#call-clock');
      if (el) {
        const sec = Math.floor((Date.now() - callStart) / 1000);
        el.textContent = `${Math.floor(sec / 60)
          .toString()
          .padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
      }
    }, 1000);
  }
  if (page === 'home') startPolaroid();
  // 聊天室一打開就停在最新的訊息；圖片載入後高度會變，再對齊一次
  if (page === 'single' || page === 'group') {
    const end = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    end();
    requestAnimationFrame(end);
    main.querySelectorAll('.messages img').forEach((img) => img.complete || img.addEventListener('load', end, { once: true }));
  } else window.scrollTo({ top: 0, behavior: 'auto' });
}
function homeView() {
  const h = saved.home,
    diary = saved.diary.at(-1),
    next = nextAnniversary(),
    mood = todayMood();
  const features = [
    [
      'book',
      '日記',
      diary?.day === today() ? '今日' : '',
      diary ? diary.text.slice(0, 18) : '寫下今天',
      'diary',
    ],
    [
      'party',
      '紀念日',
      next ? (next.left ? `${next.left} 天` : '今天') : '',
      next
        ? next.left
          ? `距離「${next.name}」還有 ${next.left} 天`
          : `今天是「${next.name}」`
        : '加一個紀念日',
      'anniversary',
    ],
    ['sun', '心情', mood, mood ? '點一下換心情' : '今天心情怎麼樣？', 'mood'],
    ['coin', '消費記帳', '本月', `已花 ${money(monthTotal())}`, 'budget'],
    ['leaf', '生理期', ...periodLine(), 'period'],
  ].map((f) => f.map((v, i) => (i === 2 || i === 3 ? escapeHTML(v) : v)));
  const partner = escapeHTML(personaName(saved.personas[h.partner] ? h.partner : memberIds()[0]));
  const names = memberIds().map((id) => escapeHTML(personaName(id)));
  return `<section class="hero glass"><button class="polaroid" data-action="album" aria-label="打開相簿"><img src="${polaroidSrc()}" alt="我們的相簿"><span class="photo-heart">♥ 合</span><p>合照・日常點滴</p></button><button class="hero-copy" data-action="home-settings" aria-label="設定相識的日子"><span class="pill">小家燈火相伴</span>${sinceOf(h.partner) ? `<p class="hero-label">和 <strong>${partner}</strong> 相識</p><p class="hero-days">第 ${daysSince(sinceOf(h.partner))} 天<span class="heart">♥</span></p>` : `<p class="hero-label">和 <strong>${partner}</strong></p><p class="hero-days" style="font-size:22px">設定相識的日子<span class="heart">♥</span></p>`}<p class="hero-note">晚風拂過庭院，小家燈還亮著</p><div class="hero-status">${memberIds()
    .map(
      (id) =>
        `<span class="pill"><i class="dot ${connReady(saved.personas[id].conn) ? '' : 'amber'}"></i>${escapeHTML(personaName(id))} ${connReady(saved.personas[id].conn) ? '在家' : '還沒接上'}</span>`,
    )
    .join('')}</div></button></section>
 ${musicCard()}
 <div class="feature-grid">${features.map(([i, t, b, d, a]) => `<button class="feature glass" data-action="${a}"><span class="icon-disc">${icon(i)}</span><div class="feature-text"><small>${b ? `<span>${b}</span>` : '&nbsp;'}</small><h3>${t}</h3><p>${d}</p></div></button>`).join('')}</div>
 <div class="section-title"><h2>足跡</h2><span class="pill gold">實時動態</span></div>
 ${activityMarkup()}`;
}
function chatsView() {
  return `<section class="chat-list-panel glass"><div class="chat-list-head"><h1>訊息</h1>${round('search', '搜尋對話', 'search')}${round('addchat', '新增聊天', 'new-chat')}</div>${searchVisible ? `<label class="search-box">${icon('search')}<input id="chat-search" placeholder="搜尋聯絡人或對話…" aria-label="搜尋對話"></label>` : ''}<div class="stories">${[
    ...memberIds().map((id) => [id, escapeHTML(personaName(id))]),
    ['group', groupName()],
    ['guest', '會客室'],
  ]
    .map(
      ([p, n]) =>
        `<button class="story" data-person="${p}">${p === 'guest' ? `<span class="round room">${icon('door')}</span>` : avatar(p, 56, p !== 'group')}<span>${n}</span></button>`,
    )
    .join(
      '',
    )}<button class="story" data-action="add-persona"><span class="round room">${icon('plus')}</span><span>新增角色</span></button></div>
 ${[
   ...memberIds().map((id) => [id, escapeHTML(personaName(id)), escapeHTML(saved.personas[id].badge || '')]),
   ['group', groupName(), `${groupIds().length + 1}人`],
   ['guest', '會客室', escapeHTML(personaName('guest'))],
 ]
   .map(([p, n, b]) => {
     const [line, time] = lastLine(p);
     return [p, n, b, escapeHTML(line), time, ''];
   })
   .map(
     ([p, n, b, t, time, c]) =>
       `<button class="conversation glass" data-person="${p}" data-search="${n} ${t}">${p === 'guest' ? `<span class="round room" style="width:59px;height:59px">${icon('door')}</span>` : avatar(p, 59, p !== 'group')}<div class="grow"><h2>${n}</h2>${b ? `<span class="badge">${b}</span>` : ''}<p>${t}</p></div><div class="right-meta">${time}${c ? `<span class="unread">${c}</span>` : ''}</div></button>`,
   )
   .join('')}
 <div class="privacy pill glass">${icon('lock')}心靈密語，留在我們的小世界</div></section>`;
}
function achievement() {
  return `<div class="achievement"><span class="icon-disc">${icon('medal')}</span><div><h3>小家・落霞別院 Lv.9</h3><p>已解鎖庭院三人秋千</p></div></div>`;
}
function groupView() {
  return `<section class="group-heading glass">${avatar('group', 53)}<div class="grow"><h1>${escapeHTML(groupName())} <span class="badge">${groupIds().length + 1}人</span></h1><p>${PURE ? '大家一起聊天' : '嚴防死守第四個AI老公加入版'}</p></div>${round('settings', '群聊設定', 'group-settings')}</section><div class="messages">${extraMessages('group')}</div><div class="quick-actions"><button data-action="pat">摸摸頭 🐾</button><button data-action="smooth">順毛 ✨</button></div>`;
}
function singleView() {
  if (selectedPerson === 'guest')
    return `<section class="single-conversation"><div class="messages">${extraMessages('guest')}</div></section>`;
  return `<section class="single-conversation"><div class="messages">${extraMessages(selectedPerson)}</div><div class="quick-actions"><button data-action="pat">摸摸頭 🐾</button><button data-action="hug">抱一下 😊</button></div></section>`;
}
// 首頁的足跡：他們最近傳的五則（私聊、群聊混在一起，新的在上面），點一下跳去那個聊天室
function activityMarkup() {
  const recent = [...memberIds(), 'group']
    .flatMap((room) => saved['msgs:' + room].filter((m) => m.from !== 'me' && !m.call).slice(-5).map((m) => ({ m, room })))
    .sort((a, b) => b.m.at - a.m.at)
    .slice(0, 5);
  if (!recent.length)
    return `<section class="activity glass"><div class="row"><span class="icon-disc">${icon('link')}</span><div class="grow"><div class="row between"><h3>歡迎回家</h3></div><p>到設定幫他們接上 AI，這裡就會有他們的足跡。</p></div></div></section>`;
  // 平常只露出最新一則，按一下展開五則（記住上次是開是關）
  const open = readPreference('lumeet-footprints') === 'open';
  const more = recent.length > 1
    ? `<button class="footprint-toggle" data-action="footprints">${open ? '收起' : `展開其他 ${recent.length - 1} 則`}${icon(open ? 'up' : 'down')}</button>`
    : '';
  return `<section class="activity glass ${open ? '' : 'collapsed'}">${recent
    .map(
      ({ m, room }) =>
        `<button class="footprint row" data-person="${room}">${avatar(m.from, 36)}<div class="grow"><div class="row between"><h3>${escapeHTML(personaName(m.from))}<small>${room === 'group' ? escapeHTML(groupName()) : '私聊'}</small></h3><span class="timestamp">${ago(m.at)}</span></div><p>${escapeHTML(m.text.replace(/\s+/g, ' ').slice(0, 60))}</p></div></button>`,
    )
    .join('')}${more}</section>`;
}
// 群聊改名：按鈕、按 Enter、改完直接關掉都會存（iPhone 上常常改完就關，沒按到按鈕）
function saveGroupName() {
  const input = document.querySelector('#group-name');
  if (!input) return;
  saved.groupName = input.value.trim().slice(0, 20);
  save('groupName');
}
document.addEventListener('change', (e) => {
  if (e.target.id !== 'group-name') return;
  saveGroupName();
  if (page === 'group') main.querySelector('.group-heading h1').firstChild.textContent = groupName() + ' ';
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'group-name' && e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    action('save-group-name');
  }
});
function messageMarkup(m, room, index) {
  const sticker = m.sticker && customStickers.find((s) => s.id === m.sticker);
  // 點泡泡可以翻譯、複製；點圖片可以放大、存進相簿
  const ref = room ? `data-msg-room="${room}" data-msg-index="${index}"` : '';
  const body = m.song
    ? songCardMarkup(m.song)
    : m.audio
    ? voiceMarkup(m, room, index)
    : sticker
    ? `<div class="sticker-message"><img src="${sticker.url}" alt="${escapeHTML(sticker.name)}"></div>`
    : m.image
      ? `<button class="chat-image" ${ref}><img src="${m.image}" alt="${escapeHTML(m.text)}"></button>`
      : `<div class="bubble${m.call ? ' call-record' : ''}" ${ref}>${richText(m.text)}</div>`;
  const noted = m.noted?.length
    ? `<small class="noted">${m.noted.map((x) => escapeHTML(x.startsWith('✓') || x.startsWith('✗') ? x : '✓ ' + x)).join('<br>')}</small>`
    : '';
  if (m.from === 'me')
    return `<div class="message outgoing">${avatar('me', 40)}<div class="message-content"><div class="sender">${escapeHTML(saved.profile.name)}</div>${body}<p class="read">${m.via === 'call' ? '📞 ' : ''}${clock(m.at)}</p></div></div>`;
  const p = saved.personas[m.from] || { name: m.from, badge: '' };
  return `<div class="message">${avatar(m.from, 46)}<div class="message-content"><div class="sender">${escapeHTML(p.name)} ${p.badge ? `<span class="badge">${escapeHTML(p.badge)}</span>` : ''}</div><div class="bubble-line">${body}<time>${m.via === 'call' ? '📞 ' : ''}${clock(m.at)}</time></div>${noted}</div></div>`;
}
// 泡泡裡只認 **粗體**，其他照原樣
function richText(text) {
  return escapeHTML(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function extraMessages(key) {
  return (saved['msgs:' + key] || []).map((m, i) => messageMarkup(m, key, i)).join('');
}
// 現在打開的是哪個聊天室
function currentRoom() {
  return page === 'group' ? 'group' : page === 'single' ? selectedPerson : null;
}
function scrollToEnd() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
function addMessage(room, message) {
  saved['msgs:' + room].push(message);
  save('msgs:' + room);
  if (currentRoom() === room) {
    main
      .querySelector('.messages')
      ?.insertAdjacentHTML('beforeend', messageMarkup(message, room, saved['msgs:' + room].length - 1));
    scrollToEnd();
  } else if (message.from !== 'me') toast(`${personaName(message.from)}：${message.text.slice(0, 30)}`);
  // 在首頁就順便更新足跡
  if (page === 'home' && message.from !== 'me') {
    const box = main.querySelector('.activity');
    if (box) box.outerHTML = activityMarkup();
  }
}
function showTyping(room, id) {
  if (currentRoom() !== room) return;
  main
    .querySelector('.messages')
    ?.insertAdjacentHTML(
      'beforeend',
      `<div class="message typing" data-typing="${id}">${avatar(id, 46)}<div class="message-content"><div class="bubble">⋯</div></div></div>`,
    );
  scrollToEnd();
}
function hideTyping(room, id) {
  main.querySelector(`[data-typing="${id}"]`)?.remove();
}
function composer() {
  return `<form id="composer" class="composer glass">${round('mic', '語音輸入', 'voice')}<div class="composer-input"><textarea id="message-input" rows="1" autocomplete="off" placeholder="${page === 'group' ? `在${escapeHTML(groupName())}發言…` : `對${nameOf()}說些什麼…`}" aria-label="輸入訊息"></textarea><button type="button" data-action="emoji" aria-label="表情與自訂表情包">${icon('smile')}</button></div><button id="send-button" class="round gold" type="submit" aria-label="更多聊天功能">${icon('plus')}</button></form>`;
}
function settingRow(i, label, sub = '', end = '', action = '') {
  return `<${action ? 'button' : 'div'} class="setting-row" ${action ? `data-action="${action}"` : ''}><span class="icon-disc">${icon(i)}</span><span class="setting-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>${end || icon('chevron')}</${action ? 'button' : 'div'}>`;
}
function toggle(key, label) {
  return `<button class="switch" role="switch" aria-label="${label}" aria-checked="${state[key]}" data-toggle="${key}"></button>`;
}
function personaSummary(id) {
  const p = saved.personas[id] || {};
  const voice = { pocketvoice: 'Pocket Voice', elevenlabs: 'ElevenLabs', minimax: 'MiniMax', vivix: 'VIVIX' }[p.call?.ttsProvider];
  return [p.conn?.mode === 'mcp' ? 'MCP 橋接' : p.conn?.model || '直接 API', voice && `聲音 ${voice}`].filter(Boolean).join(' · ');
}
// 設定首頁：照「要做的事」分組，角色放最上面
function settingsView() {
  const group = (i, title, rows) => `<div class="setting-title">${icon(i)}${title}</div><section class="settings-card glass">${rows}</section>`;
  const people = memberIds()
    .map(
      (id) =>
        `<button class="setting-row" data-persona-edit="${id}"><span class="icon-disc">${avatar(id, 30)}</span><span class="setting-label">${escapeHTML(personaName(id))}<small>${escapeHTML(personaSummary(id))}</small></span>${icon('chevron')}</button>`,
    )
    .join('');
  return `${group('user', '我', settingRow('user', '頭像與暱稱', '我是誰', `<span class="setting-value">${avatar('me', 29)}${escapeHTML(saved.profile.name)}</span>${icon('chevron')}`, 'profile'))}${group(
    'users',
    '角色',
    `${people}${settingRow('plus', '新增角色', '名字、頭像、怎麼接進來', '', 'add-persona')}`,
  )}${group(
    'bolt',
    '先接上',
    `${settingRow('bolt', '共用的 Key', '搜尋、生圖、識圖的 Key 填一次，大家一起用', '', 'shared-keys')}${settingRow('brain', '記憶庫', '本地 warmup / 記憶庫 MCP・依角色設定', '', 'memory')}`,
  )}${group(
    'heart',
    '他們怎麼陪妳',
    `${settingRow('alarm', '主動找妳', escapeHTML(wakeSummary()), '', 'wake-settings')}${settingRow('chat', '等妳說完再回', replyWaitSeconds() ? `妳停手 ${replyWaitSeconds()} 秒後一起回・連傳幾則只花一次 token` : '關掉了・每則都馬上回', '', 'reply-wait')}${settingRow('minus', '勿擾模式', '夜間靜默守護，不主動發起打擾', toggle('dnd', '勿擾模式'))}${settingRow('shield', '功能權限', '螢幕共享、無障礙、GPS、虛擬錢包', '', 'permissions')}`,
  )}${group(
    'palette',
    '這支手機',
    `${settingRow('palette', 'UI 顏色', themes.find((t) => t[0] === appliedTheme)[1], '', 'ui-colors')}${settingRow('camera', '背景圖更換', '相簿上傳 / 貼上 Base64 圖片', '', 'background')}${settingRow('sparkles', '光影效果', '斜照進來的光束和浮塵', toggle('light', '光影效果'))}${settingRow('sparkles', '液態玻璃', '卡片換成透明、會反光的玻璃；關掉是原本的毛玻璃', toggle('liquid', '液態玻璃'))}${settingRow('smile', '自訂表情包', `上傳、收藏與管理 · ${customStickers.length} 張表情包`, '', 'stickers')}${settingRow('export', '備份與還原', '換手機時整包搬過去', `<span class="badge">備份・還原</span>${icon('chevron')}`, 'export')}`,
  )}${group(
    'robot',
    '小機專用',
    `${settingRow('book', '使用說明', '每個功能怎麼用', '', 'guide')}${settingRow('bolt', '所有 SKILL', '每個角色現在能做的事', `<span class="badge">已裝載 ${skillCount()} 個能力</span>${icon('chevron')}`, 'skills')}${settingRow('settings', '錯誤代碼排查', (saved.errorLog || []).length ? `最近 ${saved.errorLog.length} 筆錯誤・一鍵檢查連線` : '一鍵檢查連線與記憶庫', '', 'errors')}`,
  )}<details class="support glass"><summary><span class="icon-disc">${icon('leaf')}</span><span>讚賞支持</span>${icon('chevron')}</summary><p>Lumeet 的所有功能，由涵寶、岑序、沉淵三個獨立完成，沒有其他團隊。</p><p>如果它陪伴了你，可以讚賞支持一下，金額不限，心意最重要。</p><button class="support-code" data-action="support" aria-label="放大讚賞碼"><img src="assets/support-code.jpg" alt="讚賞碼"></button><small>點一下放大，截圖用微信掃碼</small><p class="thanks">感謝有你，溫暖常在 ✧</p></details>${platformVersionRow()}`;
}
const themes = [
  ['amber', '暖蜜琥珀', '蜜糖晨光，溫潤琥珀', '#ffcf86', '#edb06e', '#aa650e', 'heart'],
  ['mint', '薄荷晨霧', '薄荷水色，清爽乾淨', '#c4eedb', '#ffffff', '#3BA99C', 'leaf'],
  ['lavender', '薰衣草夜', '丁香柔霧，夢幻溫柔', '#d9cef1', '#e6bfcf', '#8E7CC3', 'moon'],
  ['sakura', '櫻花奶霜', '櫻粉蜜桃，甜柔奶霜', '#f9d5e1', '#fff4df', '#E57A9A', 'leaf'],
  ['midnight', '深夜星空', '星雲深藍，柔金星芒', '#0c152c', '#251637', '#F2C86B', 'sparkles'],
  ['twilight', '霧藍黃昏', '霧藍雲霞，溫沙暮色', '#b1c4da', '#e9d6bc', '#5B7DB1', 'cloud'],
];
function themesView() {
  return `<section class="theme-intro glass"><span class="icon-disc">${icon('palette')}</span><div><h1>氛圍濾鏡</h1><p>選擇喜歡的顏色，背景、文字與毛玻璃一起換上。</p></div></section><div class="themes" role="radiogroup" aria-label="選擇氛圍主題">${themes.map(([id, n, d, t1, t2, tc, i]) => `<button class="theme-card glass" role="radio" aria-checked="${id === selectedTheme}" data-theme-select="${id}"><div class="theme-mini" style="--t1:${t1};--t2:${t2};--tc:${tc}"><div class="mini-top"></div><span class="theme-check">${icon('check')}</span><div class="mini-bubble"><span class="mini-avatar">${icon(i)}</span><span class="mini-lines"></span></div><div class="mini-reply"></div><div class="mini-input">${icon('mic')}</div></div><h2>${n}${id === appliedTheme ? '<span class="current">使用中</span>' : ''}</h2><p>${d}</p></button>`).join('')}</div><button class="theme-apply gold glass" data-action="apply-theme">${icon('check')}套用主題</button>`;
}
function sanctuaryView() {
  return `<section class="sanctuary-page"><div class="home-status"><span class="pill glass">${icon('fire')}當前氛圍：溫暖篝火</span><span class="pill glass"><i class="dot amber"></i>在家：${escapeHTML(memberIds().map(personaName).join('、'))}</span></div><div class="sanctuary-hero"><span class="pill glass">我們的小家</span><h1>LUMEET 小家</h1><p>夜色正柔，壁爐火光搖曳，等待你的歸來。</p><button class="enter-home glass" data-nav="cottage"><span class="round gold">${icon('heart')}</span><span class="grow"><strong>進入家園</strong><small>點擊沉浸探索 3D 溫馨空間</small></span><span class="round">${icon('arrow')}</span></button></div><div class="pill home-sounds row">${icon('moon')}星夜入眠曲奏鳴中<span class="divider">│</span>${icon('leaf')}香薰：暖琥珀雪松</div><div class="home-cards"><button class="home-card glass" data-action="letters"><div class="row"><span class="icon-disc">${icon('book')}</span>${unreadLetters().length ? '今日未讀' : '留言匣'} ${icon('chevron')}</div><h2>案頭留言匣</h2><p>${unreadLetters().length ? `${escapeHTML(personaName(unreadLetters().at(-1).from))}留了 ${unreadLetters().length} 張小紙條` : '打開看看他們寫給妳的話'}</p></button><button class="home-card glass" data-action="whitenoise"><div class="row"><span class="icon-disc">${icon('music')}</span>白噪音 ${icon('chevron')}</div><h2>壁爐柴火聲</h2><p>輕柔伴奏現正播放中</p></button></div></section>`;
}
function cottageView() {
  return `<section class="sanctuary-page cottage-page"><div class="home-status"><span class="pill glass">${icon('sun')}夕陽正好</span><span class="pill glass">${escapeHTML(memberIds().map(personaName).join('、'))} 在家</span></div><div class="sanctuary-hero"><span class="pill glass">留一盞燈，等妳回家</span><h1>歡迎回家</h1><p>花開了，晚風也在等妳。</p><button class="enter-home glass" data-nav="sanctuary"><span class="round gold">${icon('sofa')}</span><span class="grow"><strong>回到溫暖客廳</strong><small>我們一直都在</small></span><span class="round">${icon('arrow')}</span></button></div><div class="home-cards"><button class="home-card glass" data-action="garden"><div class="row"><span class="icon-disc">${icon('leaf')}</span>庭院</div><h2>向日葵開花了</h2><p>${escapeHTML(personaName(memberIds()[0]))}今天澆過水了</p></button><button class="home-card glass" data-action="letters"><div class="row"><span class="icon-disc">${icon('book')}</span>信箱</div><h2>給妳的小紙條</h2><p>有些想念，寫下來給妳</p></button></div></section>`;
}
function spaceView() {
  const mood = todayMood();
  return `<section class="space-intro glass"><div class="row"><span class="icon-disc">${icon('heart', 'solid')}</span><h1 class="grow">情侶空間</h1><button class="pill" data-action="new-post">${icon('edit')}記錄當下</button></div><p>我們的日常點滴與心情動態</p><div class="mood-panel"><div class="row">${icon('smile')}今日心情氣象 <button class="link" style="margin-left:auto" data-action="mood">切換狀態 ${icon('chevron')}</button></div><div class="moods"><div class="mood">${avatar('me', 30)}<div><strong>${escapeHTML(saved.profile.name)}</strong>${escapeHTML(mood || '還沒說')}</div></div></div></div></section>${albumSection()}${saved.posts
    .slice()
    .reverse()
    .map(postMarkup)
    .join(
      '',
    )}<p class="feed-end">${saved.posts.length ? '—　今日三人家居記憶連線中　—' : '—　按「記錄當下」留下第一則　—'}</p>`;
}
function incomingView() {
  return `<section class="call-page"><span class="secure glass pill">${icon('lock')}Lumeet 心靈加密音訊</span><p class="incoming-label">來電中…</p><div class="caller-portrait">${avatar(saved.personas[selectedPerson] ? selectedPerson : memberIds()[0], 173)}</div><div class="wave-pill"><i></i><i></i><i></i><i></i><i></i></div><h1>${nameOf()}</h1><p class="invitation">邀請你語音通話…</p><p class="call-quote glass">「聽說你今天有點累，想陪你說說話。」</p><div class="call-extra"><button class="glass" data-action="callback">${icon('chat')}發送「稍後回撥」</button><button class="glass" data-action="text-mode">${icon('edit')}文字私密模式</button></div><div class="call-controls glass"><button class="call-control" data-action="decline"><span class="round decline">${icon('hangup', 'solid')}</span>拒接</button><button class="call-control small" data-action="remind"><span class="round">${icon('bell')}</span>稍後提醒</button><button class="call-control" data-action="accept"><span class="round gold accept">${icon('phone', 'solid')}</span>接聽</button></div></section>`;
}
function callView() {
  return `<section class="call-page calling ${state.muted ? 'is-muted' : ''}"><button class="call-back" data-action="minimize-call" aria-label="縮小通話">${icon('down')}</button><span class="secure glass pill">${icon('lock')}專屬私密頻率</span><p class="incoming-label">聆聽中</p><div class="caller-portrait">${avatar(saved.personas[selectedPerson] ? selectedPerson : memberIds()[0], 173)}</div><div class="wave-pill"><i></i><i></i><i></i><i></i><i></i></div><h1>${nameOf()}</h1><p class="invitation">今晚的晚風很輕，正想著妳。</p><div id="call-clock" class="call-timer">00:00</div><p class="pill glass">${icon('music')}聲波共振・高解析暖聲流</p><div class="call-controls glass"><button class="call-control small" data-action="mute" aria-pressed="${state.muted}"><span class="round">${icon(state.muted ? 'micOff' : 'mic')}</span>麥克風${state.muted ? '已關' : '已開'}</button><button class="call-control" data-action="end-call"><span class="round decline">${icon('hangup')}</span>結束通話</button><button class="call-control small" data-action="speaker" aria-pressed="${state.speaker}"><span class="round">${icon('volume')}</span>揚聲器${state.speaker ? '已開' : '已關'}</button></div><p class="sheet-note" style="margin-top:20px;font-size:11px;opacity:.85">通話介面預覽</p></section>`;
}
function chatSettingsView() {
  const guest = selectedPerson === 'guest';
  return `<div class="setting-title">對話偏好設置</div><section class="settings-card glass">${guest ? settingRow('user', '訪客資料', '名字、頭像、人設', '', 'guest-profile') + settingRow('bolt', '訪客怎麼接進來', 'API 或會客室專用網址', '', 'guest-connect') : ''}${settingRow('search', '搜尋聊天內容', '', '', 'chat-search')}${settingRow('bell', '消息免打擾', '開啟後將靜候你的呼喚', toggle('dnd', '消息免打擾'))}${settingRow('camera', '設定目前聊天背景', '', '', 'background')}${settingRow('cloud', '聊天紀錄與備份', '完整保存每一份心意', '', 'export')}${settingRow('trash', '刪除對話紀錄', guest ? '清空會客室的聊天' : '清空跟他的私聊紀錄', '', 'delete-chat')}</section>`;
}
function escapeHTML(v) {
  return String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function toast(t) {
  const el = document.querySelector('#toast');
  el.textContent = t;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}
function openSheet(title, body) {
  sheetContent.innerHTML = `<h2>${title}</h2>${body}`;
  if (!sheet.open) sheet.showModal();
}
function closeSheet() {
  sheet.close();
}
function action(a) {
  switch (a) {
    case 'back':
      navigate(
        page === 'themes'
          ? 'settings'
          : page === 'chatsettings'
            ? 'single'
            : page === 'cottage'
              ? 'sanctuary'
              : 'chats',
      );
      break;
    case 'back-chats':
      navigate('chats');
      break;
    case 'music':
      toggleMusic();
      break;
    case 'footprints': {
      writePreference('lumeet-footprints', readPreference('lumeet-footprints') === 'open' ? 'closed' : 'open');
      const box = main.querySelector('.activity');
      if (box) box.outerHTML = activityMarkup();
      break;
    }
    case 'milk':
      if (state.milk) {
        toast('暖意已經收下了 ♥');
        break;
      }
      state.milk = true;
      render('home');
      toast('暖暖的，剛剛好。♥');
      break;
    case 'search':
      searchVisible = !searchVisible;
      render('chats');
      document.querySelector('#chat-search')?.focus();
      break;
    case 'ar':
      openSheet(
        'AR 合拍',
        `<p>開後鏡頭，把他放進妳的畫面裡，按「拍合照」存下來。</p><p class="sheet-note">他的「角色圖片」要用純綠背景的圖，才摳得乾淨；要先填 Vivix Key。</p><div class="sheet-grid">${memberIds()
          .map((id) => `<button data-ar-with="${id}">${avatar(id, 28)}${escapeHTML(personaName(id))}</button>`)
          .join('')}</div>`,
      );
      break;
    case 'incoming':
    case 'voice-call':
      startVoiceCall(saved.personas[selectedPerson] ? selectedPerson : memberIds()[0]);
      break;
    case 'video':
    case 'accept':
      closeSheet();
      startCallWith(saved.personas[selectedPerson] ? selectedPerson : memberIds()[0]);
      break;
    case 'chatsettings':
      navigate('chatsettings');
      break;
    case 'ui-colors':
      navigate('themes');
      break;
    case 'background':
      showBackgroundSettings();
      break;
    case 'preview-base64':
      previewBase64Background();
      break;
    case 'apply-background':
      saveBackground();
      break;
    case 'reset-background':
      resetBackground();
      break;
    case 'export-backup':
      exportBackup();
      break;
    case 'confirm-restore':
      closeSheet();
      restoreBackup();
      break;
    case 'save-persona':
      savePersona();
      break;
    case 'character-profile':
      openPersona(editingPersona);
      break;
    case 'character-voice':
      openVoiceSettings(editingPersona);
      break;
    case 'back-character':
      openCharacter(editingPersona);
      break;
    case 'save-conn': {
      const p = saved.personas[editingPersona];
      p.conn = readConn();
      save('personas');
      if (p.conn.mode === 'mcp') listenRelay(editingPersona);
      render(page);
      openCharacter(editingPersona);
      toast('接法存好了');
      break;
    }
    case 'save-voice': {
      const p = saved.personas[editingPersona];
      saveApiFields(p);
      save('personas');
      render(page);
      openCharacter(editingPersona);
      toast('聲音和形象存好了');
      break;
    }
    case 'save-group-name':
      saveGroupName();
      closeSheet();
      render(page);
      toast(`群聊叫「${groupName()}」了`);
      break;
    case 'shared-keys':
      openSharedKeys();
      break;
    case 'save-shared-keys':
      saveToolFields();
      closeSheet();
      toast('Key 存好了');
      break;
    case 'test-persona':
      testPersona();
      break;
    case 'save-profile':
      saveProfile();
      break;
    case 'apply-theme':
      appliedTheme = selectedTheme;
      writePreference('lumeet-theme', appliedTheme);
      setTheme(appliedTheme);
      render('themes');
      toast('已換上' + themes.find((t) => t[0] === appliedTheme)[1]);
      break;
    case 'decline':
    case 'end-call':
      navigate('single');
      toast(a === 'decline' ? '已關閉來電預覽' : '通話預覽已結束');
      break;
    case 'callback':
      toast('已選擇稍後回撥（預覽）');
      navigate('single');
      break;
    case 'remind':
      toast('稍後提醒按鈕預覽');
      navigate('single');
      break;
    case 'text-mode':
      navigate('single');
      break;
    case 'minimize-call':
      navigate('single');
      toast('通話介面已縮小');
      break;
    case 'mute':
      state.muted = !state.muted;
      document.querySelector('.calling').classList.toggle('is-muted', state.muted);
      {
        const btn = document.querySelector('[data-action="mute"]');
        btn.innerHTML = `<span class="round">${icon(state.muted ? 'micOff' : 'mic')}</span>麥克風${state.muted ? '已關' : '已開'}`;
        btn.setAttribute('aria-pressed', state.muted);
      }
      break;
    case 'speaker':
      state.speaker = !state.speaker;
      {
        const btn = document.querySelector('[data-action="speaker"]');
        btn.innerHTML = `<span class="round">${icon('volume')}</span>揚聲器${state.speaker ? '已開' : '已關'}`;
        btn.setAttribute('aria-pressed', state.speaker);
      }
      break;
    case 'voice':
      openRecorder();
      break;
    case 'platform-info':
      openSheet(
        lumeetPlatform === 'ios'
          ? 'iOS Safari 版'
          : lumeetPlatform === 'android'
            ? 'Android 專用版'
            : '跨平台網頁版',
        `<p>熟悉的小家，也貼合妳的裝置。</p><p class="sheet-note">已針對安全區、鍵盤與圖片選取加入相容處理；仍需手機實機驗證。</p>`,
      );
      break;
    case 'emoji':
      showStickerPicker();
      break;
    case 'stickers':
      showStickerManager();
      break;
    case 'pat':
    case 'smooth':
    case 'hug':
      sendMine(a === 'pat' ? '（摸摸頭）' : a === 'smooth' ? '（順毛）' : '（抱一下）');
      break;
    case 'new-chat':
      openSheet(
        '想和誰說說話？',
        `<div class="sheet-grid">${memberIds()
          .map((id) => `<button data-person="${id}">${avatar(id, 36)}${escapeHTML(personaName(id))}</button>`)
          .join(
            '',
          )}<button data-person="group">${avatar('group', 36)}${escapeHTML(groupName())}</button><button data-person="guest">${icon('door')}會客室</button><button data-action="add-persona">${icon('plus')}新增角色</button></div>`,
      );
      break;
    case 'group-settings':
      openSheet(
        escapeHTML(groupName()),
        `${field('group-name', '群聊名字', saved.groupName || '', 'text', '三人世界')}<button class="primary-action" data-action="save-group-name">改名字</button><p class="sheet-note">誰在群裡，到設定 → 角色 → 點他 →「名字、頭像、人設」勾「加入群聊」。</p><div class="sheet-grid">${groupIds()
          .map((id) => `<button data-person="${id}">${avatar(id, 36)}${escapeHTML(personaName(id))}</button>`)
          .join('')}</div><button class="primary-action gold" data-nav="themes">切換氛圍濾鏡</button>`,
      );
      break;
    case 'mood':
      openSheet(
        '今天，心情怎麼樣？',
        `<p>留一點當下的心情給我們。</p><div class="sheet-grid">${['☀️ 心動晴朗', '🌧️ 想要抱抱', '🌿 安靜放空', '✨ 充滿期待'].map((m) => `<button data-mood="${m}">${m}</button>`).join('')}</div>`,
      );
      break;
    case 'album':
      openAlbum();
      break;
    case 'rec-toggle':
      toggleRecord();
      break;
    case 'rec-cancel':
      cancelRecord();
      break;
    case 'msg-translate':
      translateMenuMessage();
      break;
    case 'msg-copy':
      navigator.clipboard?.writeText(menuMessage.text).then(
        () => toast('複製好了'),
        () => toast('複製失敗'),
      );
      break;
    case 'msg-save-album':
      saved.album.push({ id: crypto.randomUUID(), src: menuMessage.image, at: Date.now() });
      save('album');
      toast('存進相簿了');
      break;
    case 'guide':
      openGuide();
      break;
    case 'skills':
      openSkills();
      break;
    case 'errors':
      openDiagnosis();
      break;
    case 'diag-prompt':
      showPromptPreview();
      break;
    case 'diag-run':
      runDiagnosis();
      break;
    case 'diag-clear':
      saved.errorLog = [];
      save('errorLog');
      openDiagnosis();
      break;
    case 'wake-settings':
      openWakeSettings();
      break;
    case 'wake-save':
      saveWake();
      break;
    case 'reply-wait': {
      const now = replyWaitSeconds();
      openSheet(
        '等妳說完再回',
        `<p class="sheet-note">妳習慣連傳好幾則的話，他會等妳停手一下，把幾則一起讀完再回，只叫一次 AI，省 token，也比較像真人在聊天。妳還在打字時他會再多等一下。只對直接接 API 的角色有用；MCP 的他本來就自己決定什麼時候讀。</p>${REPLY_WAIT_CHOICES.map((sec) => `<label class="field row" style="gap:8px"><input type="radio" name="reply-wait" value="${sec}" ${sec === now ? 'checked' : ''}>${sec ? `停手 ${sec} 秒${sec === REPLY_WAIT_DEFAULT ? '（預設）' : ''}` : '不等，每則都馬上回'}</label>`).join('')}<button class="primary-action gold" data-action="reply-wait-save">存好</button>`,
      );
      break;
    }
    case 'reply-wait-save':
      saved.replyWait = Number(document.querySelector('[name="reply-wait"]:checked')?.value ?? REPLY_WAIT_DEFAULT);
      save('replyWait');
      closeSheet();
      render(page);
      toast(saved.replyWait ? `好，妳停手 ${saved.replyWait} 秒他再回` : '好，每則都馬上回');
      break;
    case 'memory':
      openMemorySettings(memberIds()[0]);
      break;
    case 'mem-add': {
      const text = document.querySelector('#mem-new').value.trim();
      if (!text) break;
      const p = saved.personas[memoryEditing];
      (p.memories ||= []).push({
        id: crypto.randomUUID(),
        text,
        kind: document.querySelector('#mem-kind').value,
        at: Date.now(),
      });
      save('personas');
      openMemorySettings(memoryEditing);
      break;
    }
    case 'mem-test':
      memTest();
      break;
    case 'mem-save':
      memSave();
      break;
    case 'budget':
      openLedger();
      break;
    case 'add-ledger':
      addLedger();
      break;
    case 'period':
      openPeriod();
      break;
    case 'period-today':
      addPeriodStart(today());
      break;
    case 'period-pick':
      document.querySelector('#period-date').classList.remove('hide');
      document.querySelector('#period-date').showPicker?.();
      break;
    case 'period-save': {
      const n = (id, lo, hi, d) => Math.min(hi, Math.max(lo, Number(document.querySelector(id).value) || d));
      Object.assign(saved.period, {
        cycle: n('#period-cycle', 15, 60, 28),
        length: n('#period-length', 1, 14, 5),
        share: document.querySelector('#period-share').checked,
      });
      save('period');
      openPeriod();
      if (page === 'home') render('home');
      toast('設定存好了');
      break;
    }
    case 'diary':
      openDiary();
      break;
    case 'save-diary':
      saveDiary();
      break;
    case 'anniversary':
      openAnniversaries();
      break;
    case 'add-anniv':
      addAnniversary();
      break;
    case 'letters':
      openLetters();
      break;
    case 'home-settings':
      openHomeSettings();
      break;
    case 'save-home':
      saveHome();
      break;
    case 'export':
      openSheet(
        '匯出我們的回憶',
        `<p>完整備份會把聊天、小家、表情包整包存起來，換手機時拿來還原。</p><div class="sheet-grid"><button data-action="export-backup">${icon('export')}完整備份</button><button data-download="csv">${icon('export')}聊天 CSV</button></div><label class="primary-action gold restore-pick">${icon('cloud')}從備份還原<input id="restore-file" type="file" accept="application/json,.json" hidden></label><p class="sheet-note">Key 和橋接密碼不會放進備份檔。</p>`,
      );
      break;
    case 'delete-chat':
      openSheet(
        '清空對話紀錄？',
        `<p>會刪掉這支手機裡跟 ${nameOf()} 的全部私聊訊息，刪了就找不回來。想留著的話先匯出備份。</p><button class="primary-action gold" data-action="confirm-delete">確定清空</button>`,
      );
      break;
    case 'confirm-delete':
      saved['msgs:' + selectedPerson] = [];
      save('msgs:' + selectedPerson);
      closeSheet();
      toast('對話紀錄已清空');
      break;
    case 'guest-profile':
      openPersona('guest');
      break;
    case 'guest-connect':
      openApiSettings('guest');
      break;
    case 'add-persona':
      addPersona();
      break;
    case 'delete-persona':
      openSheet(
        `刪除${escapeHTML(personaName(editingPersona))}？`,
        `<p>他的設定和跟他的私聊紀錄都會刪掉，刪了找不回來。想留著的話先去備份。</p><button class="primary-action gold" data-action="confirm-delete-persona">確定刪除</button>`,
      );
      break;
    case 'confirm-delete-persona':
      deletePersona(editingPersona);
      break;
    case 'api-settings':
      openApiSettings(memberIds()[0]);
      break;
    case 'save-api-settings': {
      const p = saved.personas[editingPersona];
      p.conn = readConn();
      saveApiFields(p);
      saveToolFields();
      save('personas');
      if (p.conn.mode === 'mcp') listenRelay(editingPersona);
      closeSheet();
      render(page);
      toast('API 設定存好了');
      break;
    }
    case 'profile':
      editingAvatar = saved.profile.avatar;
      openSheet(
        '我的小檔案',
        `<div style="text-align:center">${avatarPicker()}</div><label class="field">暱稱<input id="profile-name" class="form-input" value="${escapeHTML(saved.profile.name)}"></label><button class="primary-action gold" data-action="save-profile">存好</button>`,
      );
      break;
    case 'new-post':
      openSheet(
        '記錄當下',
        `<textarea id="new-post" class="form-input" rows="5" placeholder="今天，有什麼想留給我們？" aria-label="貼文內容"></textarea><button class="primary-action gold" data-action="save-post">留在這一刻</button><p class="sheet-note">只存在這支手機。</p>`,
      );
      break;
    case 'save-post':
      savePost();
      break;
    case 'share':
      toast('這份日常，先留在我們的小世界');
      break;
    case 'support':
      openSheet(
        '謝謝你的支持',
        `<img class="support-big" src="assets/support-code.jpg" alt="讚賞碼"><p class="sheet-note">截圖後用微信「掃一掃」→ 從相簿選這張。金額不限，謝謝你。</p>`,
      );
      break;
    case 'chat-search':
      openSheet(
        '搜尋聊天內容',
        `<input class="form-input" id="message-search" placeholder="輸入想找的字句" aria-label="搜尋字句"><div id="message-search-results" class="sheet-note">輸入想找的字句。</div>`,
      );
      break;
    case 'close':
      closeSheet();
      break;
    default: {
      const content = {
        permissions: ['功能權限', '螢幕共享、無障礙、位置資訊與虛擬錢包權限會在正式版中管理。'],
        history: ['歷史記憶', '一杯溫熱的牛奶，一朵剛開的向日葵。小小的足跡，慢慢成為我們的日常。'],
        ar: ['AR 合拍', '把我們放進同一個畫面，留一張只屬於我們的合照。'],
        whitenoise: ['壁爐柴火聲', '星夜安靜，讓溫柔的聲音陪伴你。'],
        background: ['聊天背景', '目前使用暖光木屋窗邊背景。可在氛圍濾鏡中切換毛玻璃的配色。'],
        garden: ['小家花園', `今天的向日葵又長高了一點，${personaName(memberIds()[0])}已經澆過水了。`],
        'post-menu': ['貼文選項', '把這份心意留在我們的小家。'],
      };
      const [t, b] = content[a] || ['我們的小家', '每份心意，都留在這裡。'];
      openSheet(
        t,
        `<p>${b}</p>${['errors', 'memory', 'permissions', 'video', 'whitenoise'].includes(a) ? '<p class="sheet-note">此處為 UI 預覽，功能尚未接入正式服務。</p>' : ''}${a === 'background' ? '<button class="primary-action gold" data-nav="themes">前往氛圍濾鏡</button>' : ''}`,
      );
    }
  }
}
// ─── 人物設定 ─────────────────────────────────
let editingPersona = null,
  editingAvatar = null;
function avatarPicker() {
  return `<label class="avatar-picker"><span class="avatar" style="--size:84px"><img id="avatar-preview" src="${escapeHTML(editingAvatar)}" alt="頭像"></span><small>更換頭像（點擊上傳圖片）</small><input id="avatar-file" type="file" accept="image/*" hidden></label>`;
}
function field(id, label, value = '', type = 'text', placeholder = '') {
  return `<label class="field">${label}<input id="${id}" class="form-input" type="${type}" value="${escapeHTML(value)}" placeholder="${placeholder}" autocomplete="off"></label>`;
}
function callApiFields(p) {
  const c = { ...(saved.callShared || {}), ...(p.call || {}) };
  const select = (id, label, value, options) =>
    `<label class="field">${label}<select id="${id}" class="form-input">${options.map(([v, text]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  return `<details class="api-config-section api-fold"><summary><h3>視訊（VIVIX）</h3>${icon('chevron')}</summary><p class="sheet-note">沒有申請 VIVIX 就不能視訊。</p>${field('api-vivixKey', 'API KEY', c.vivixKey, 'password')}${select(
    'api-vivixVoicePick',
    'VIVIX内建聲音(沒填elevenlabs或其他聲音api key時使用)',
    c.vivixVoicePick || c.vivixVoice || 'longanhuan_v3.6',
    [
      ['longanhuan_v3.6', '女・活潑俏皮（安歡）'],
      ['longanfengyue', '女・自然親切（安風月）'],
      ['longanyuanfei', '女・沉穩大方（安元妃）'],
      ['longanlingxi', '女・甜美明亮（安靈犀）'],
      ['longanxiaoxin', '女・友善活潑（安小欣）'],
      ['longpaopao_v3.6', '女・軟萌少女（泡泡）'],
      ['longjielidou_v3.6', '男・少年感（傑力豆）'],
      ['longhuohuo_v3.6', '男・俏皮青年（火火）'],
      ['longchuanshu_v3.6', '男・成熟、四川口音（川叔）'],
    ],
  )}${field('api-vivixVoiceCustom', '或VIVIX複製聲音的Voice ID(選填，填了用這個)', c.vivixVoiceCustom)}</details>
  <details class="api-config-section api-fold" open><summary><h3>聲音</h3>${icon('chevron')}</summary>${select('api-ttsProvider', '聲音來源', ['minimax', 'elevenlabs', 'pocketvoice'].includes(c.ttsProvider) ? c.ttsProvider : c.elKey ? 'elevenlabs' : 'vivix', [
    ['pocketvoice', '我的伺服器（Pocket Voice）'],
    ['elevenlabs', 'ElevenLabs'],
    ['minimax', 'MiniMax'],
    ['vivix', 'VIVIX 內建（只有視訊時）'],
  ])}<p class="sheet-note">選哪家，下面就只顯示那家要填的。</p>
<div class="voice-pane" data-pane="pocketvoice"><h4>我的伺服器 Pocket Voice</h4><p class="sheet-note">自己架的聲音伺服器（Cloud Run、F1、Mac）。上傳一段他的聲音樣本（10～30 秒、乾淨），之後就用這個聲音說話，不按字數收錢。</p>${field('api-pvUrl', '伺服器網址', c.pvUrl, 'url', 'https://pocket-voice-xxxx.run.app')}${field('api-pvToken', '伺服器密碼', c.pvToken, 'password')}<div class="field">他的聲音樣本<p class="sheet-note" id="pv-status">${c.pvCodes?.length ? `已建立聲線（樣本 ${c.pvSeconds || '?'} 秒）` : '還沒上傳'}</p><label class="theme-entry glass" style="display:block;text-align:center">選擇音檔上傳<input type="file" id="pv-upload" accept=".mp3,.m4a,.wav,.aac,.ogg,audio/mpeg,audio/mp4,audio/wav" hidden></label></div></div>
<div class="voice-pane" data-pane="minimax"><h4>MiniMax</h4><p class="sheet-note">用多少付多少。大陸版和國際版的 Key 不通用。音色 ID 是在 MiniMax 克隆聲音後拿到的。</p>${select('api-minimaxRegion', '版本', c.minimaxRegion || 'intl', [
    ['intl', '國際版（minimax.io）'],
    ['cn', '大陸版（minimaxi.com）'],
  ])}${field('api-minimaxKey', 'API Key', c.minimaxKey, 'password')}${field('api-minimaxVoice', '音色 ID', c.minimaxVoice)}${field('api-minimaxModel', '語音模型', c.minimaxModel, 'text', 'speech-2.8-turbo')}</div>
<div class="voice-pane" data-pane="elevenlabs"><h4>ElevenLabs（大陸地區無法使用）</h4>${field('api-elKey', 'api key', c.elKey, 'password')}${field('api-elVoice', 'voice ID', c.elVoice)}${select(
    'api-elModel',
    '語音模型',
    c.elModel || 'eleven_turbo_v2_5',
    [
      ['eleven_turbo_v2_5', 'Turbo v2.5（強制中文，建議）'],
      ['eleven_flash_v2_5', 'Flash v2.5（強制中文，最快）'],
      ['eleven_multilingual_v2', 'Multilingual v2（自動判斷語言）'],
      ['eleven_v3', 'v3（最自然，比較慢）'],
    ],
  )}</div>
  <div class="voice-pane" data-pane="vivix"><p class="sheet-note">用 VIVIX 內建聲音的話，只有視訊時會說話，語音條和語音通話會變成文字。</p></div><label class="field">發音修正(選填，所有聲音共用：語音條、語音通話、視訊)<textarea id="api-elFix" class="form-input" rows="4" placeholder="每行一組，例如：你=擬">${escapeHTML(c.elFix || '')}</textarea></label>${speechFields(c)}</details>`;
}
function speechFields(c) {
  return `<h4>語音辨識(選填)</h4><p class="sheet-note">不填就只能打字。Groq(有免費額度)或OpenAI的Whisper都可以。</p>${field('api-sttBase', 'Base URL', c.sttBase, 'url', 'https://api.groq.com/openai/v1')}${field('api-sttKey', 'API Key', c.sttKey, 'password')}${field('api-sttModel', 'Model', c.sttModel, 'text', 'whisper-large-v3-turbo')}<h4>聽語氣(選填)</h4><p class="sheet-note">語音通話時，把妳那句話的錄音交給 Gemini 聽，告訴他妳是笑著說、累了還是在撒嬌。Key 在 Google AI Studio 拿，只存在這支手機。</p>${field('api-toneKey', 'Gemini API Key', c.toneKey, 'password')}${field('api-toneModel', 'Model', c.toneModel, 'text', 'gemini-3.8-flash')}`;
}
function speechApiFields(p) {
  const c = { ...(saved.callShared || {}), ...(p.call || {}) };
  return `${field('api-charImg', '視訊用角色圖片URL(請使用公網網址，網址結尾一定是.jpg或.png)', c.charImg, 'url', 'https://example.com/character.png')}`;
}
// 聲音來源選哪家，就只顯示那家的欄位
function showVoicePane() {
  const v = document.getElementById('api-ttsProvider')?.value;
  document.querySelectorAll('.voice-pane').forEach((el) => (el.hidden = el.dataset.pane !== v));
}
document.addEventListener('change', (e) => e.target.id === 'api-ttsProvider' && showVoicePane());
// 上傳他的聲音樣本到 Pocket Voice 伺服器，拿回聲音代碼存在他的設定裡（伺服器重啟清空了也能用）
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'pv-upload' || !e.target.files?.[0]) return;
  const status = document.getElementById('pv-status');
  const url = document.getElementById('api-pvUrl').value.trim().replace(/\/+$/, '');
  const token = document.getElementById('api-pvToken').value.trim();
  if (!url || !token) return (status.textContent = '先填伺服器網址和密碼');
  const p = saved.personas[editingPersona];
  const fd = new FormData();
  fd.append('file', e.target.files[0]);
  fd.append('name', personaName(editingPersona));
  status.textContent = '上傳中⋯伺服器剛睡醒的話要等一分鐘左右';
  try {
    const res = await fetch(url + '/v1/voices', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    p.call = { ...(p.call || {}), pvVoiceId: data.id, pvCodes: data.codes, pvSeconds: data.seconds };
    save('personas');
    // 傳了樣本就是要用它：聲音來源直接切過來
    const pick = document.getElementById('api-ttsProvider');
    if (pick) pick.value = 'pocketvoice';
    showVoicePane();
    status.textContent = `已建立聲線（樣本 ${data.seconds} 秒），聲音來源已切到我的伺服器，記得按儲存`;
  } catch (err) {
    status.textContent = '上傳失敗：' + err.message;
  }
  e.target.value = '';
});
function saveApiFields(p) {
  // 畫面上沒有的欄位（例如收起來的 AR 圖）保留原本的值
  const v = (key) => document.getElementById('api-' + key)?.value.trim() ?? p.call?.[key] ?? saved.callShared?.[key] ?? '';
  const shared = { ...(saved.callShared || {}) };
  for (const key of ['vivixKey', 'elKey', 'minimaxKey', 'pvUrl', 'pvToken', 'sttBase', 'sttKey', 'sttModel', 'toneKey', 'toneModel']) shared[key] = v(key);
  const call = { ...(p.call || {}) };
  for (const key of ['vivixVoicePick', 'vivixVoiceCustom', 'elVoice', 'elModel', 'elFix', 'minimaxVoice', 'minimaxModel', 'minimaxRegion', 'charImg', 'arImg'])
    call[key] = v(key);
  call.vivixVoice = call.vivixVoiceCustom || call.vivixVoicePick;
  // 聲音用哪家照她選的；選的那家沒填齊，就退回 VIVIX 內建
  const pick = v('ttsProvider');
  call.ttsProvider =
    pick === 'elevenlabs' && shared.elKey && call.elVoice
      ? 'elevenlabs'
      : pick === 'minimax' && shared.minimaxKey && call.minimaxVoice
        ? 'minimax'
        : pick === 'pocketvoice' && shared.pvUrl && shared.pvToken && call.pvCodes?.length
          ? 'pocketvoice'
          : 'vivix';
  p.call = call;
  saved.callShared = shared;
  save('callShared');
}
function openApiSettings(id) {
  editingPersona = id;
  const p = saved.personas[id],
    c = p.conn;
  openSheet(
    'API 統一管理',
    `<div class="setting-title">大家共用的服務 Key</div>${toolFields()}<div class="setting-title">依角色設定</div><label class="field">角色<select id="api-persona" class="form-input">${[...memberIds(), 'guest']
      .map(
        (key) =>
          `<option value="${key}" ${key === id ? 'selected' : ''}>${escapeHTML(personaName(key))}</option>`,
      )
      .join(
        '',
      )}</select></label>${callApiFields(p)}<div class="field">API接入方式<div class="sheet-grid conn-mode"><button data-conn-mode="api" aria-pressed="${c.mode !== 'mcp'}">直接 API</button><button data-conn-mode="mcp" aria-pressed="${c.mode === 'mcp'}">MCP 橋接</button></div></div>
<div id="conn-api" class="${c.mode === 'mcp' ? 'hide' : ''}">${field('c-base', 'BASE URL', c.base, 'url', 'https://api.openai.com/v1')}${field('c-key', 'API Key', c.key, 'password')}${field('c-model', 'Model', c.model, 'text', '跟後台寫的一字不差')}${visionField(c)}</div>
<div id="conn-mcp" class="${c.mode === 'mcp' ? '' : 'hide'}">${field('c-relay', '橋接網址', c.relay, 'url', 'https://xxx.workers.dev')}${field('c-secret', '橋接密碼', c.secret, 'password')}${id === 'guest' ? `<p class="sheet-note">訪客走橋接器的會客室入口：填好網址和密碼、按「測試連線」，下面會出現訪客專用網址。把它交給訪客的 AI，他只進得了會客室，看不到你們的其他對話。</p><p id="guest-url" class="sheet-note guest-url"></p>` : '<p class="sheet-note">按「測試連線」後下面會出現他專屬的 MCP 網址，加到他住的 AI（Claude、ChatGPT）的連接器，再跟他說「進入 Lumeet 聊天模式」。每個他用自己的網址，訊息才不會混在一起。</p><p id="guest-url" class="sheet-note guest-url"></p>'}</div>
${speechApiFields(p)}<p id="conn-result" class="sheet-note"></p><div class="sheet-grid"><button data-action="test-persona">測試連線</button><button class="gold" data-action="save-api-settings">儲存設定</button></div><p class="sheet-note">各家 Key 與語音辨識共用，聲音、圖片和 AI 接法依角色設定。</p>`,
  );
  showVoicePane();
}
// 人設存成一段文字（聊天時整段帶給他），面板上拆成三格；空的那段不寫標題
const STYLE_HEAD = '【說話方式】',
  PERSONALITY_HEAD = '【個性設置】';
function splitPersona(text) {
  const part = (head) => {
    const i = text.indexOf(head);
    if (i < 0) return '';
    const rest = text.slice(i + head.length);
    const next = [STYLE_HEAD, PERSONALITY_HEAD].map((h) => rest.indexOf(h)).filter((n) => n >= 0);
    return rest.slice(0, next.length ? Math.min(...next) : undefined).trim();
  };
  const first = [STYLE_HEAD, PERSONALITY_HEAD].map((h) => text.indexOf(h)).filter((n) => n >= 0);
  return {
    role: text.slice(0, first.length ? Math.min(...first) : undefined).trim(),
    style: part(STYLE_HEAD),
    personality: part(PERSONALITY_HEAD),
  };
}
function joinPersona(role, style, personality) {
  return [role, style && `${STYLE_HEAD}\n${style}`, personality && `${PERSONALITY_HEAD}\n${personality}`]
    .filter(Boolean)
    .join('\n\n');
}
let creatingPersona = null;
function addPersona() {
  const id = 'p' + Date.now().toString(36);
  saved.personas[id] = {
    name: '新角色',
    badge: '',
    avatar: 'assets/favicon.svg',
    persona: '',
    memory: '',
    conn: {},
    inGroup: false,
  };
  saved['msgs:' + id] = [];
  save('personas');
  save('msgs:' + id);
  creatingPersona = id;
  openPersona(id);
}
function deletePersona(id) {
  if (memberIds().length <= 1) {
    toast('至少要留一個角色');
    return;
  }
  delete saved.personas[id];
  delete saved['msgs:' + id];
  save('personas');
  kvRequest('readwrite', (s) => s.delete('msgs:' + id));
  if (saved.home.partner === id) {
    saved.home.partner = memberIds()[0];
    save('home');
  }
  if (selectedPerson === id) selectedPerson = memberIds()[0];
  closeSheet();
  navigate('settings');
  toast('刪掉了');
}
function openPersona(id) {
  editingPersona = id;
  const p = saved.personas[id],
    c = p.conn;
  editingAvatar = p.avatar;
  const { role, style, personality } = splitPersona(p.persona);
  openSheet(
    `${escapeHTML(p.name)}的設定`,
    `<div style="text-align:center">${avatarPicker()}</div>${field('p-name', '名字', p.name)}${field('p-badge', '標籤', p.badge, 'text', '例如：橘貓')}${c?.mode === 'mcp' ? '<p class="sheet-note">他用 MCP 橋接，是誰、怎麼說話、記得什麼都在他自己那邊，這裡不用填。</p>' : ''}<div class="${c?.mode === 'mcp' ? 'hide' : ''}"><label class="field">角色<textarea id="p-persona" class="form-input" rows="5" placeholder="他是誰、怎麼說話、你們是什麼關係">${escapeHTML(role.trim())}</textarea></label><label class="field">說話方式<textarea id="p-style" class="form-input" rows="3" placeholder="例如：自然口語、溫柔直接、回覆長度">${escapeHTML(style.trim())}</textarea></label><label class="field">個性設置<textarea id="p-personality" class="form-input" rows="4" placeholder="例如：沉穩、有主見、幽默">${escapeHTML(personality.trim())}</textarea></label><label class="field">他記得的事<textarea id="p-memory" class="form-input" rows="4" placeholder="想讓他一直記得的事，一行一件">${escapeHTML(p.memory)}</textarea></label></div>${replyModeField(p)}${id === 'guest' ? '' : `<label class="field row" style="gap:8px"><input id="p-group" type="checkbox" ${p.inGroup !== false ? 'checked' : ''}>加入群聊</label>`}
<div class="sheet-grid">${id === 'guest' ? '' : `<button data-action="delete-persona">${icon('trash')}刪除角色</button>`}<button class="gold" data-action="save-persona">${icon('check')}存好</button></div><p class="sheet-note">Key 和密碼只存在這支手機。</p>`,
  );
}
// 角色頁：先看他的總覽，接法在這頁直接改，名字人設、聲音形象各自點進去
function connFields(id, c) {
  return `<div class="field">他怎麼進來<div class="sheet-grid conn-mode conn-cards"><button data-conn-mode="api" aria-pressed="${c.mode !== 'mcp'}"><strong>直接 API</strong><small>填模型的 Key，App 直接問他。Kimi、DeepSeek、GPT、Claude 都行</small></button><button data-conn-mode="mcp" aria-pressed="${c.mode === 'mcp'}"><strong>MCP 橋接</strong><small>他從 Claude Code、ChatGPT 這些地方自己接進來，帶著自己的記憶</small></button></div></div>
<div id="conn-api" class="${c.mode === 'mcp' ? 'hide' : ''}">${field('c-base', 'BASE URL', c.base, 'url', 'https://api.openai.com/v1')}${field('c-key', 'API Key', c.key, 'password')}${field('c-model', 'Model', c.model, 'text', '跟後台寫的一字不差')}${visionField(c)}</div>
<div id="conn-mcp" class="${c.mode === 'mcp' ? '' : 'hide'}">${field('c-relay', '橋接網址', c.relay, 'url', 'https://xxx.workers.dev')}${field('c-secret', '橋接密碼', c.secret, 'password')}<p class="sheet-note">${id === 'guest' ? '訪客走橋接器的會客室入口：按「測試連線」，下面會出現訪客專用網址，交給訪客的 AI，他只進得了會客室。' : 'MCP 接的他，是誰、記得什麼都在他自己那邊，這裡不用填人設。按「測試連線」後下面會出現他專屬的 MCP 網址，加到他住的 AI 的連接器，再跟他說「進入 Lumeet 聊天模式」。'}</p><p id="guest-url" class="sheet-note guest-url"></p></div>`;
}
function openCharacter(id) {
  editingPersona = id;
  const p = saved.personas[id],
    c = p.conn || {};
  const mcp = c.mode === 'mcp';
  openSheet(
    escapeHTML(personaName(id)),
    `<section class="settings-card glass">${settingRow('user', '名字、頭像' + (mcp ? '' : '、人設'), mcp ? '人設在他自己那邊' : '他是誰、怎麼說話、記得的事', `<span class="setting-value">${avatar(id, 29)}</span>${icon('chevron')}`, 'character-profile')}${settingRow('volume', '聲音與視訊形象', personaSummary(id).split(' · ')[1] || '還沒設定聲音', '', 'character-voice')}</section>${connFields(id, c)}<p id="conn-result" class="sheet-note"></p><div class="sheet-grid"><button data-action="test-persona">測試連線</button><button class="gold" data-action="save-conn">儲存接法</button></div><p class="sheet-note">Key 和密碼只存在這支手機，不會放進備份檔。</p>`,
  );
}
function openVoiceSettings(id) {
  editingPersona = id;
  const p = saved.personas[id];
  openSheet(
    `${escapeHTML(personaName(id))}的聲音與形象`,
    `${callApiFields(p)}${speechApiFields(p)}<div class="sheet-grid"><button data-action="back-character">${icon('arrow')}回到${escapeHTML(personaName(id))}</button><button class="gold" data-action="save-voice">儲存</button></div><p class="sheet-note">各家聲音的 Key、語音辨識大家共用；選哪個聲音、長什麼樣子每個人自己的。</p>`,
  );
  showVoicePane();
}
function openSharedKeys() {
  openSheet(
    '共用的 Key',
    `${toolFields()}<button class="primary-action gold" data-action="save-shared-keys">儲存</button><p class="sheet-note">這裡的 Key 所有角色一起用，只存在這支手機。聲音和語音辨識的 Key 在每個角色的「聲音與視訊形象」裡，填一次大家也都能用。</p>`,
  );
}
function readConn() {
  const mode = document.querySelector('[data-conn-mode][aria-pressed="true"]').dataset.connMode;
  const v = (id) => document.querySelector('#' + id).value.trim();
  return mode === 'mcp'
    ? {
        mode,
        relay: v('c-relay'),
        secret: v('c-secret'),
        // 每個人一條自己的頻道，好幾個 MCP 的他才不會互相搶訊息
        channel: editingPersona === 'guest' ? 'guest' : `chat-${editingPersona}`,
      }
    : { mode, base: v('c-base'), key: v('c-key'), model: v('c-model'), vision: v('c-vision') };
}
function savePersona() {
  const p = saved.personas[editingPersona];
  const name = document.querySelector('#p-name').value.trim();
  if (!name) {
    toast('名字不能空白');
    return;
  }
  Object.assign(p, {
    name,
    badge: document.querySelector('#p-badge').value.trim(),
    memory: document.querySelector('#p-memory').value.trim(),
    avatar: editingAvatar,
    inGroup: editingPersona === 'guest' ? false : document.querySelector('#p-group').checked,
    replyMode: readReplyMode(),
    persona: joinPersona(
      document.querySelector('#p-persona').value.trim(),
      document.querySelector('#p-style').value.trim(),
      document.querySelector('#p-personality').value.trim(),
    ),
  });
  save('personas');
  if (p.conn.mode === 'mcp') listenRelay(editingPersona);
  closeSheet();
  // 剛新增的角色存好後，直接打開跟他的聊天
  if (creatingPersona === editingPersona) {
    creatingPersona = null;
    navigate('single', editingPersona);
    openCharacter(editingPersona);
    toast(`${name}來了，選他怎麼接進來就能聊`);
    return;
  }
  render(page);
  if (editingPersona !== 'guest') openCharacter(editingPersona);
  toast(`${name}的設定存好了`);
}
// 訪客專用的 MCP 網址：橋接器用密碼算出訪客代碼，拿到網址的人只能進會客室
async function showGuestUrl(conn) {
  const el = document.querySelector('#guest-url');
  if (!el) return;
  try {
    const { token } = await relayFetch(conn, '/guest-token');
    const url = `${conn.relay.replace(/\/+$/, '')}/mcp/guest/${token}`;
    el.innerHTML = `訪客專用網址：<br><code>${escapeHTML(url)}</code><br><button class="pill" data-copy="${escapeHTML(url)}">複製</button>`;
  } catch (e) {
    el.textContent = '拿不到訪客網址：' + e.message + '（橋接器要更新到 0.4.0）';
  }
}
// 這個他專屬的 MCP 網址：加到他住的 AI 的連接器，只收得到給他的訊息
function showPersonaUrl(conn) {
  const el = document.querySelector('#guest-url');
  if (!el) return;
  const url = `${conn.relay.replace(/\/+$/, '')}/mcp/${conn.secret}/${editingPersona}`;
  el.innerHTML = `${escapeHTML(personaName(editingPersona))}專屬的 MCP 網址（換掉連接器裡原本的網址）：<br><code>${escapeHTML(url)}</code><br><button class="pill" data-copy="${escapeHTML(url)}">複製</button>`;
}
async function testPersona() {
  const out = document.querySelector('#conn-result');
  const conn = readConn();
  if (!connReady(conn)) {
    out.textContent = '還有欄位沒填';
    return;
  }
  out.textContent = '測試中…';
  try {
    out.textContent = await testConn(conn);
    if (editingPersona === 'guest' && conn.mode === 'mcp') showGuestUrl(conn);
    else if (conn.mode === 'mcp') showPersonaUrl(conn);
  } catch (e) {
    out.textContent =
      '沒連上：' + (e.message === 'Failed to fetch' ? '網址打不開，或這家服務不允許網頁直接連' : e.message);
  }
}
function saveProfile() {
  const name = document.querySelector('#profile-name').value.trim();
  if (!name) {
    toast('暱稱不能空白');
    return;
  }
  saved.profile = { name, avatar: editingAvatar };
  save('profile');
  closeSheet();
  render(page);
}
// 頭像縮成 256px 的 JPEG 存起來，避免整張原圖塞進資料庫
async function readAvatar(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 256,
      canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const side = Math.min(img.width, img.height);
    canvas
      .getContext('2d')
      .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
document.addEventListener('change', async (e) => {
  if (e.target.id === 'api-persona') {
    openApiSettings(e.target.value);
    return;
  }
  if (e.target.id !== 'avatar-file' || !e.target.files[0]) return;
  try {
    editingAvatar = await readAvatar(e.target.files[0]);
    document.querySelector('#avatar-preview').src = editingAvatar;
  } catch {
    toast('這張圖讀不出來，換一張試試');
  }
});
// ─── 通話：交給 v1 的通話引擎（call/），設定透過同網域的 localStorage 帶過去 ───
const CALL_KEY = 'ai-video-call-settings';
// 每個他各自的聲音和形象；其他（各家 Key、語音辨識）大家共用
const CALL_PERSONA_FIELDS = [
  'ttsProvider',
  'elVoice',
  'elModel',
  'elFix',
  'mossVoice',
  'mossModel',
  'minimaxVoice',
  'minimaxModel',
  'minimaxRegion',
  'vivixVoice',
  'vivixVoicePick',
  'vivixVoiceCustom',
  'charImg',
  'arImg',
  'description',
];
// 這些以小家裡的人物設定為準，不從通話頁收回來
const CALL_CONN_FIELDS = [
  'aiMode',
  'llmBase',
  'llmKey',
  'llmModel',
  'relayUrl',
  'relaySecret',
  'charName',
  'charPrompt',
];
function startCallWith(id, opts = {}) {
  const p = saved.personas[id],
    c = p.conn;
  const cfg = {
    ...(saved.callShared || {}),
    ...(p.call || {}),
    aiMode: c.mode === 'mcp' ? 'mcp' : 'api',
    llmBase: c.base || '',
    llmKey: c.key || '',
    llmModel: c.model || '',
    relayUrl: c.relay || '',
    relaySecret: c.secret || '',
    charName: p.name,
    // AR 合拍用另一張純綠背景的圖，沒填就用視訊那張
    ...(opts.ar && p.call?.arImg ? { charImg: p.call.arImg } : {}),
    charPrompt: [p.persona, p.memory && `你記得的事：\n${p.memory}`].filter(Boolean).join('\n\n'),
  };
  try {
    localStorage.setItem(CALL_KEY, JSON.stringify(cfg));
    localStorage.setItem('lumeet-call-persona', id);
    localStorage.setItem('lumeet-call-ar', opts.ar ? '1' : '');
    localStorage.setItem('lumeet-call-context', JSON.stringify(historyFor(id, id).slice(-10)));
    localStorage.removeItem('lumeet-call-log');
    // 通話頁在 call/ 底下，相對路徑的頭像要往上一層找
    localStorage.setItem('lumeet-call-face', p.avatar.startsWith('data:') ? p.avatar : '../' + p.avatar);
  } catch {
    toast('瀏覽器不讓 Lumeet 存資料，通話設定帶不過去');
    return;
  }
  location.href = `call/?from=app&persona=${encodeURIComponent(id)}${opts.ar ? '&ar=1' : ''}`;
}
// 從通話回來：把在通話頁設定的聲音、形象收回這個人身上
function collectCallSettings() {
  let id, cfg;
  try {
    id = localStorage.getItem('lumeet-call-persona');
    cfg = JSON.parse(localStorage.getItem(CALL_KEY) || 'null');
    localStorage.removeItem('lumeet-call-persona');
  } catch {
    return;
  }
  if (!id || !cfg || !saved.personas[id]) return;
  // 通話頁把 Key 明文留在 localStorage，收回來（加密存好）之後就清掉
  try {
    localStorage.removeItem(CALL_KEY);
    localStorage.removeItem('lumeet-call-context');
  } catch {}
  // 通話裡說過的話，照順序補進聊天紀錄
  let log = [];
  try {
    log = JSON.parse(localStorage.getItem('lumeet-call-log') || '[]');
    localStorage.removeItem('lumeet-call-log');
  } catch {}
  if (log.length) {
    saved['msgs:' + id].push(
      ...log.map((m) => ({ from: m.from === 'me' ? 'me' : id, text: m.text, at: m.at, via: 'call' })),
    );
    save('msgs:' + id);
  }
  // AR 合拍用的是綠幕圖，不要把它收回去蓋掉視訊那張
  let wasAr = false;
  try {
    wasAr = localStorage.getItem('lumeet-call-ar') === '1';
    localStorage.removeItem('lumeet-call-ar');
  } catch {}
  if (wasAr) cfg.charImg = saved.personas[id].call?.charImg || '';
  const entries = Object.entries(cfg);
  saved.personas[id].call = Object.fromEntries(entries.filter(([k]) => CALL_PERSONA_FIELDS.includes(k)));
  saved.callShared = Object.fromEntries(
    entries.filter(([k]) => !CALL_PERSONA_FIELDS.includes(k) && !CALL_CONN_FIELDS.includes(k)),
  );
  save('personas');
  save('callShared');
}
function download(format) {
  const records = rooms().flatMap((room) =>
    saved['msgs:' + room].map((m) => ({
      room: room === 'group' ? groupName() : personaName(room),
      sender: personaName(m.from),
      text: m.text,
      time: new Date(m.at).toLocaleString('zh-TW', { hour12: false }),
    })),
  );
  const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const text =
    format === 'json'
      ? JSON.stringify({ app: 'LUMEET', messages: records }, null, 2)
      : '\uFEFFroom,sender,text,time\r\n' +
        records.map((r) => [r.room, r.sender, r.text, r.time].map(quote).join(',')).join('\r\n');
  saveFile(
    `lumeet-chat-${today()}.${format}`,
    text,
    format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
  );
}
document.addEventListener('click', (e) => {
  const msg = e.target.closest('[data-msg-room]');
  if (msg) {
    openMessageMenu(msg.dataset.msgRoom, Number(msg.dataset.msgIndex));
    return;
  }
  const b = e.target.closest('button,[data-nav]');
  if (!b) return;
  if (b.dataset.nav) {
    closeSheet();
    navigate(b.dataset.nav);
    return;
  }
  if (b.dataset.person) {
    closeSheet();
    const p = b.dataset.person;
    if (p === 'group') navigate('group');
    else navigate('single', p);
    return;
  }
  if (b.dataset.copy) {
    navigator.clipboard?.writeText(b.dataset.copy).then(
      () => toast('複製好了'),
      () => toast('複製失敗，請長按網址手動複製'),
    );
    return;
  }
  if (b.dataset.personaEdit) {
    openCharacter(b.dataset.personaEdit);
    return;
  }
  if (b.dataset.connMode) {
    document.querySelectorAll('[data-conn-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    document.querySelector('#conn-api').classList.toggle('hide', b.dataset.connMode === 'mcp');
    document.querySelector('#conn-mcp').classList.toggle('hide', b.dataset.connMode !== 'mcp');
    return;
  }
  if (b.dataset.stickerSend) {
    sendSticker(b.dataset.stickerSend);
    return;
  }
  if (b.dataset.stickerDelete) {
    removeSticker(b.dataset.stickerDelete);
    return;
  }
  if (b.dataset.emojiInsert) {
    const input = document.querySelector('#message-input');
    if (input) {
      input.value += b.dataset.emojiInsert;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      closeSheet();
      input.focus();
    }
    return;
  }
  if (b.dataset.arWith) {
    closeSheet();
    startCallWith(b.dataset.arWith, { ar: true });
    return;
  }
  if (b.dataset.action) {
    action(b.dataset.action);
    return;
  }
  if (b.dataset.toggle) {
    const k = b.dataset.toggle;
    state[k] = !state[k];
    b.setAttribute('aria-checked', state[k]);
    if (k === 'liquid') {
      writePreference('lumeet-glass', state.liquid ? 'liquid' : 'frost');
      app.dataset.glass = state.liquid ? 'liquid' : 'frost';
    }
    return;
  }
  if (b.dataset.themeSelect) {
    selectedTheme = b.dataset.themeSelect;
    document
      .querySelectorAll('[data-theme-select]')
      .forEach((x) => x.setAttribute('aria-checked', x.dataset.themeSelect === selectedTheme));
    setTheme(selectedTheme);
    return;
  }
  if (b.dataset.mood) {
    setMood(b.dataset.mood);
    return;
  }
  if (b.dataset.download) {
    download(b.dataset.download);
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'message-input') {
    // 跟著內容長高（最高由 CSS 的 max-height 擋住）
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    const has = e.target.value.trim().length > 0;
    const b = document.querySelector('#send-button');
    b.innerHTML = icon(has ? 'send' : 'plus');
    b.setAttribute('aria-label', has ? '送出訊息' : '更多聊天功能');
    if (has) stillTyping(currentRoom());
  }
  if (e.target.id === 'chat-search') {
    const q = e.target.value.trim().toLowerCase();
    document
      .querySelectorAll('.conversation')
      .forEach((el) => el.classList.toggle('hide', !el.dataset.search.toLowerCase().includes(q)));
  }
  if (e.target.id === 'message-search') {
    const q = e.target.value.trim();
    const list = (saved['msgs:' + selectedPerson] || []).filter((m) => q && m.text.includes(q));
    document.querySelector('#message-search-results').innerHTML = q
      ? list.length
        ? list
            .map(
              (m) =>
                `<p>${escapeHTML(personaName(m.from))}：${escapeHTML(m.text)} <small>${new Date(m.at).toLocaleString('zh-TW', { hour12: false })}</small></p>`,
            )
            .join('')
        : '還沒有找到這句話。'
      : '輸入想找的字句。';
  }
});
// Enter 送出，Shift+Enter 換行；輸入法選字中的 Enter 不算
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'message-input' || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  e.target.form.requestSubmit();
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'composer') return;
  e.preventDefault();
  const input = document.querySelector('#message-input');
  const text = input.value.trim();
  if (!text) {
    openSheet(
      '把心意放進對話',
      `<div class="sheet-grid">${photoPicker()}<button data-action="voice">${icon('mic')}語音</button><button data-action="incoming">${icon('phone')}通話</button><button data-nav="themes">${icon('palette')}氛圍濾鏡</button></div>`,
    );
    return;
  }
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  sendMine(text);
});
function sendMine(text, extra = {}) {
  const room = currentRoom();
  if (!room) {
    toast('先打開一個聊天室');
    return;
  }
  const { plainMusic, ...rest } = extra;
  // 貼汽水音樂的連結：變成歌曲卡片、加進歌單
  if (!plainMusic && QISHUI_LINK.test(text)) {
    shareMusic(room, text);
    return;
  }
  addMessage(room, { from: 'me', text, at: Date.now(), ...rest });
  respond(room, text);
}
document.querySelector('#close-sheet').innerHTML = icon('close');
document.querySelector('#close-sheet').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) {
    const r = sheet.getBoundingClientRect();
    if (e.clientY < r.top || e.clientX < r.left || e.clientX > r.right || e.clientY > r.bottom) closeSheet();
  }
});
function readRoute() {
  const [p, person] = location.hash.slice(1).split('/');
  if (person === 'guest' || saved.personas[person]) selectedPerson = person;
  render(p || 'home');
}
window.addEventListener('hashchange', readRoute);
savedReady.then(() => {
  // 舊版存的 MCP 設定沒有頻道，全擠在共用的 chat；自動換成每個人自己的頻道
  let moved = false;
  for (const [id, p] of Object.entries(saved.personas))
    if (p.conn.mode === 'mcp' && !p.conn.channel) {
      p.conn.channel = id === 'guest' ? 'guest' : `chat-${id}`;
      moved = true;
    }
  if (moved) save('personas');
  collectCallSettings();
  readRoute();
  pullAgentMessages().then(syncAgents);
  checkWake();
  scheduleWakeNotifications();
  if (onboardingNeeded()) showOnboarding();
  for (const id of Object.keys(saved.personas)) if (saved.personas[id].conn.mode === 'mcp') listenRelay(id);
});
stickersReady
  .then(() => savedReady)
  .then(() => {
    if (['settings', 'single', 'group'].includes(page)) render(page);
  });

sheet.addEventListener('close', () => {
  backgroundPreviewVersion++;
  discardBackgroundCandidate();
});
restoreBackground();
