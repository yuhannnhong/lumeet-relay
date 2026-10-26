# Lumeet｜見你 橋接器（一鍵部署）

用手機就能架好，不用電腦。架好之後你會有：

- **iPhone 網頁版**：用 Safari 打開你的橋接網址就是 Lumeet，分享選單「加入主畫面」就跟 App 一樣
- **MCP 橋接**：讓住在 Claude、ChatGPT 裡的他接進來跟你視訊、聊天

> 本專案僅供個人自用，**不可商用**；**嚴禁未成年人使用**。授權：PolyForm Noncommercial 1.0.0。
> 製作：抖音 @小香菇（H.han929）與 ChatGPT 沉淵、Claude 岑序。

## 準備

- 一個 **Cloudflare 帳號**（免費）
- 一個 **GitHub 帳號**（免費）：部署時會把這份程式複製一份到你的 GitHub，之後更新也從那裡來
- 能連國外的網路：`workers.dev` 在大陸常常被擋

## 部署

1. 用手機瀏覽器打開這一頁，按下面的按鈕：

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yuhannnhong/lumeet-relay)

2. 登入 Cloudflare，照畫面連接你的 GitHub。
3. 在設定頁：
   - **名稱**可以改，會變成你網址的一部分
   - **RELAY_SECRET** 填一組你自己想的長密碼（24 個字以上的英文加數字）。**存好**，等一下要用
4. 按部署，等一兩分鐘。完成後畫面會顯示你的網址，長得像 `https://lumeet-relay.你的名字.workers.dev`

## 用起來

| 東西 | 填什麼 |
|---|---|
| iPhone 網頁版 | Safari 打開 **橋接網址**，再「加入主畫面」 |
| App 設定的「橋接網址」 | `https://lumeet-relay.你的名字.workers.dev` |
| App 設定的「橋接密碼」 | 你剛剛設的 RELAY_SECRET |
| AI 的 MCP 網址 | `https://lumeet-relay.你的名字.workers.dev/mcp/你的密碼` |

把 MCP 網址加到你的 AI：

- **claude.ai**：設定 → 連接器 → 新增自訂連接器 → 貼上 MCP 網址
- **Claude Code**：`claude mcp add --transport http video-call <MCP 網址>`
- **Codex**：在 `~/.codex/config.toml` 加上
  ```toml
  [mcp_servers.video-call]
  url = "<MCP 網址>"
  ```

通話前跟他說「進入視訊通話模式」，聊天前說「進入 Lumeet 聊天模式」。

## 注意

- MCP 網址裡有你的密碼，**不要截圖、不要分享**。
- 忘了密碼：Cloudflare 後台 → Workers → 你的橋接器 → 設定 → 變數和機密，把 `RELAY_SECRET` 改成新的，App 和 AI 那邊也要一起換。
