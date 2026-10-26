'use strict';
// 設定頁「小機專用」：使用說明、所有 SKILL、錯誤代碼排查

// 出錯時記一筆，排查頁看得到（只留最近 50 筆）
function logError(where, message) {
  (saved.errorLog ||= []).push({ where, message: String(message).slice(0, 300), at: Date.now() });
  saved.errorLog = saved.errorLog.slice(-50);
  save('errorLog');
}

const GUIDE = [
  [
    '先接上 AI',
    '設定 → 角色 → 點他，在「他怎麼進來」選接法：直接 API 填 Base URL、Key、模型；住在 Claude／ChatGPT 的他選 MCP 橋接，填橋接網址和密碼，再跟他說「進入 Lumeet 聊天模式」。聲音和視訊形象在同一頁的「聲音與視訊形象」。',
  ],
  [
    '角色',
    '設定 → 角色 →「新增角色」或聊天頁的「＋ 新增角色」可以加人。「名字、頭像、人設」裡寫他是誰、怎麼說話、個性，勾選要不要加入群聊。群聊的名字在群聊右上角的設定裡改。',
  ],
  ['聊天', '私聊、三人世界都存在這支手機。群聊裡妳說一句，他們會各回一句，最多再互接兩句。'],
  [
    '通話',
    '私聊右上角：電話鍵是語音通話（只有聲音，要填語音辨識；他的聲音沒設定就用手機內建的唸），視訊鍵是有角色畫面的視訊通話（要 Vivix）。通話內容會寫回聊天，時間前面有 📞。',
  ],
  [
    '記憶庫',
    '每個角色各自選：本地 warmup（記在手機，他會自己記新的事）或記憶庫 MCP（填網址和 token，開聊先 warmup，聊天中他能自己用記憶庫的工具）。',
  ],
  ['自喚醒', '設好時間和人，到時間他會主動傳訊息；App 關著時先跳通知，點開後他才寫好傳來。'],
  ['會客室', '給客人用的聊天室。訪客可以用 API，或用橋接器的會客室專用網址接進來，他看不到妳跟家人的對話。'],
  [
    '小家',
    '首頁的日記、紀念日、心情、記帳、生理期；情侶空間的動態和相簿；小家的留言匣。全部只存在這支手機。',
  ],
  [
    '搜尋、生圖、翻譯',
    '在設定「共用的 Key」填搜尋和百煉（Qwen）的 Key，直接 API 的他就會自己上網查、自己畫圖傳給妳。點任何一個泡泡可以翻譯或複製，點圖片可以存進相簿。',
  ],
  [
    '照片、語音條',
    '聊天框右邊的 ＋ →「傳照片」；左邊的麥克風錄語音條，點一下開始、再點一下送出。填了語音辨識，他聽得到妳說什麼。DeepSeek 這類看不懂圖的模型，會用百煉的識圖模型先看照片再告訴他。角色面板裡可以選他「打字回」或「語音回」。',
  ],
  ['換手機', '設定 →「備份與還原」存成檔案，新手機打開同一個檔案還原。Key 不會放進備份，要重填。'],
];
function openGuide() {
  openSheet(
    '使用說明',
    GUIDE.map(([t, d]) => `<div class="record"><strong>${t}</strong><p>${d}</p></div>`).join(''),
  );
}

// 每個角色現在能做的事
function skillsOf(id) {
  const p = saved.personas[id],
    c = p.conn,
    shared = saved.callShared || {};
  const ready = connReady(c);
  const mode = memoryMode(p);
  return [
    ['聊天', ready, ready ? (c.mode === 'mcp' ? 'MCP 橋接' : '直接 API') : '還沒接上 AI'],
    [
      groupName(),
      ready && id !== 'guest' && p.inGroup !== false,
      id === 'guest' ? '訪客不進群' : p.inGroup === false ? '沒有勾選進群' : '',
    ],
    [
      '記憶',
      ready,
      c.mode === 'mcp'
        ? '記憶在他住的 AI 那邊'
        : mode === 'mcp'
        ? `記憶庫 MCP${p.memMcp?.url ? '' : '（還沒填網址）'}`
        : `本地 warmup・${liveMemories(p).length} 則`,
    ],
    [
      '記憶庫工具',
      ready && mode === 'mcp' && c.mode !== 'mcp' && !!p.memMcp?.url,
      c.mode === 'mcp'
        ? '記憶庫要加在他住的 AI 那邊'
        : mode !== 'mcp'
          ? '沒有接記憶庫 MCP'
          : !p.memMcp?.url
            ? '還沒填記憶庫網址'
            : '可以自己查、寫記憶庫',
    ],
    ['視訊通話', ready && !!shared.vivixKey && id !== 'guest', shared.vivixKey ? '' : '還沒填 Vivix Key'],
    [
      '自喚醒',
      wakeCfg().enabled && wakeCfg().who.includes(id),
      wakeCfg().who.includes(id) ? '' : '沒有在自喚醒名單',
    ],
    [
      '網路搜尋',
      ready && c.mode !== 'mcp' && !!toolCfg().searchKey,
      toolCfg().searchKey ? '' : '還沒填搜尋的 Key',
    ],
    [
      '生圖',
      ready && imageReady(),
      !imageReady() ? '還沒填生圖的 Key（Gemini、OpenAI 或百煉）' : c.mode === 'mcp' ? '在訊息裡寫 [生圖:描述]' : '',
    ],
    [
      '看照片',
      ready && (c.mode !== 'mcp' && seesImages(c) ? true : !!toolCfg().qwenKey),
      c.mode !== 'mcp' && seesImages(c)
        ? '自己看圖'
        : toolCfg().qwenKey
          ? '識圖模型幫他看'
          : '看不懂圖，要填百煉的 Key',
    ],
    ['聽語音條', ready && !!shared.sttKey, shared.sttKey ? '' : '還沒填語音辨識'],
    [
      '語音回覆',
      ready && p.replyMode === 'voice' && ttsReady(id),
      p.replyMode !== 'voice' ? '設定成打字回' : ttsReady(id) ? '' : '還沒設定聲音',
    ],
    [
      '寫紙條・空間留言',
      ready && c.mode !== 'mcp' && id !== 'guest',
      c.mode === 'mcp' ? 'MCP 的他要在聊天裡找' : '',
    ],
  ];
}
// 給他自己看的說明書：他住在哪個 App、現在有哪些功能開著、最近出過什麼錯
function aiManual(id) {
  const skills = skillsOf(id)
    .map(([name, on, note]) => `- ${name}：${on ? '可以' : '還不行'}${note ? `（${note}）` : ''}`)
    .join('\n');
  const errors = (saved.errorLog || [])
    .filter((e) => e.where.startsWith(personaName(id)))
    .slice(-3)
    .map((e) => `- ${new Date(e.at).toLocaleString('zh-TW', { hour12: false })} ${e.where}：${e.message}`)
    .join('\n');
  return [
    `【Lumeet 說明書】你現在在 Lumeet 裡，這是${saved.profile.name}手機上的 App，有私聊、三人世界群聊、會客室、通話、小家（日記、紀念日、心情、記帳、生理期、相簿、留言匣）。資料都存在她的手機。`,
    `【你的技能】\n${skills}`,
    `【傳訊息的小技巧】想分幾則就換行，一行一個泡泡。想傳語音條，就在那則開頭寫 [語音]（例如「[語音] 早安」），會用你的聲音唸成語音條${ttsReady(id) ? '' : '（你的聲音還沒設定，暫時會變成文字）'}。想畫圖給她，就另起一行寫 [生圖:畫面描述]，App 會畫好傳給她。想打電話給她，就另起一行寫 [來電]，她手機會跳來電畫面；接了就是語音通話（改用 call_wait_message／call_reply），拒接或沒接會傳 [來電] 開頭的訊息告訴你。${saved.profile.name}傳的語音條會先轉成文字給你，前面標 [語音]。${
      customStickers.length
        ? `想傳表情包，就另起一行寫 [表情包:名字]，名字從這些挑：${customStickers
            .slice(0, 60)
            .map((s) => s.name)
            .join('、')}。`
        : ''
    }`,
    musicManual(),
    errors && `【你最近出過的錯】\n${errors}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
function skillCount() {
  return memberIds().reduce((n, id) => n + skillsOf(id).filter(([, on]) => on).length, 0);
}
function openSkills() {
  openSheet(
    '所有 SKILL',
    [...memberIds(), 'guest']
      .map(
        (id) =>
          `<div class="setting-title">${avatar(id, 24)} ${escapeHTML(personaName(id))}</div>${skillsOf(id)
            .map(
              ([name, on, note]) =>
                `<div class="record row"><span class="skill-dot ${on ? 'on' : ''}"></span><div class="grow">${name}${note ? `<small>${escapeHTML(note)}</small>` : ''}</div></div>`,
            )
            .join('')}`,
      )
      .join(''),
  );
}

// 一鍵檢查：每個角色的 AI 連線、記憶庫；下面列最近的錯誤
async function runDiagnosis() {
  const out = document.querySelector('#diag-result');
  out.innerHTML = '<p class="sheet-note">檢查中…</p>';
  const rows = [];
  const show = () =>
    (out.innerHTML = rows
      .map(
        ([who, what, ok, msg]) =>
          `<div class="record row"><span class="skill-dot ${ok === true ? 'on' : ok === false ? 'bad' : ''}"></span><div class="grow">${escapeHTML(who)}・${what}<small>${escapeHTML(msg)}</small></div></div>`,
      )
      .join(''));
  for (const id of [...memberIds(), 'guest']) {
    const p = saved.personas[id],
      name = personaName(id);
    if (!connReady(p.conn)) {
      rows.push([name, 'AI 連線', null, '還沒設定']);
    } else {
      try {
        rows.push([name, 'AI 連線', true, await testConn(p.conn)]);
      } catch (e) {
        rows.push([
          name,
          'AI 連線',
          false,
          e.message === 'Failed to fetch' ? '網址打不開，或這家服務不允許網頁直接連' : e.message,
        ]);
      }
    }
    show();
    if (memoryMode(p) === 'mcp' && p.memMcp?.url) {
      try {
        delete mcpSessions[p.memMcp.url];
        delete toolCache[p.memMcp.url];
        delete warmupCache[id];
        const text = await mcpWarmup(id);
        rows.push([name, '記憶庫', true, `讀到 ${text.length} 字`]);
      } catch (e) {
        rows.push([name, '記憶庫', false, e.message]);
      }
      show();
    }
  }
}
// 把直接 API 的他開聊時真正收到的系統提示（含說明書、記憶庫 warmup）原封不動列出來，方便對照他說的「沒收到」
async function showPromptPreview() {
  const id = document.querySelector('#diag-persona').value;
  const out = document.querySelector('#diag-prompt');
  out.textContent = '讀取中…';
  const p = saved.personas[id];
  if (p.conn.mode === 'mcp') {
    out.textContent = `${personaName(id)}用 MCP 橋接。App 開著時會把下面這份【Lumeet 說明書】存到橋接器，他每次進聊天模式用 lumeet_manual 工具自己讀：\n\n${aiManual(id)}`;
    return;
  }
  delete warmupCache[id];
  const mem = await memoryContext(id);
  const text = systemPrompt(id, id) + (mem ? `\n\n${mem}` : '');
  out.textContent = `共 ${text.length} 字\n\n${text}`;
}
function openDiagnosis() {
  const log = (saved.errorLog || []).slice().reverse();
  openSheet(
    '錯誤代碼排查',
    `<button class="primary-action gold" data-action="diag-run">一鍵檢查所有角色</button><div id="diag-result"></div>
<div class="setting-title">他實際收到什麼</div><label class="field"><select id="diag-persona" class="form-input">${memberIds()
      .map((id) => `<option value="${id}">${escapeHTML(personaName(id))}</option>`)
      .join('')}</select></label><button class="primary-action" data-action="diag-prompt">顯示他開聊時收到的完整說明</button><pre id="diag-prompt" class="diag-prompt"></pre>
<div class="setting-title">最近的錯誤</div>${log.length ? log.map((e) => `<div class="record"><strong>${escapeHTML(e.where)}</strong><small>${ago(e.at)}</small><p>${escapeHTML(e.message)}</p></div>`).join('') + '<button class="primary-action" data-action="diag-clear">清空紀錄</button>' : '<p class="sheet-note">沒有錯誤紀錄。</p>'}`,
  );
}
