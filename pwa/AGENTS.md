# Project Rules

## Golden Rule
- **必須先問再執行。** 任何修改前都要向我確認，不要自行決定。
- Only modify what I explicitly ask. Do NOT add extra changes beyond the request.
- If you see a potential issue or have a better approach, ASK FIRST before implementing.
- Discuss → Confirm → Execute. No surprises.
- **討論時請都用中文回應我**

## File Structure
- 所有主要檔案都在 `pwa\` 目錄下
- `pwa\YYYYMMDD\` — 每日備份目錄，內有序號 001~NNN，不作為主要開發目錄
- `core.js` — shared logic: state, storage, nav helpers, settlements, **CRUD 純資料操作** (book/item/entry/member/payMethod 的 data + saveState，不碰 DOM/UI)，modal helpers, swipe gesture, utilities
- `app.js` — mobile-only UI: 所有 `render*`, auth, CRUD 的 **UI 觸發層** (讀 DOM → call core.js → toast/closeModal/render), settings, account, context menu
- `index.html` loads `core.js` first, then `app.js`
- PC version will use `core.js` + `desktop.js` — desktop.js 需自行實作 UI 層並複用 core.js 的 CRUD 資料函式

## Date & Timezone
- Always use local timezone methods: `getFullYear()`, `getMonth()`, `getDate()`
- NEVER use `new Date().toISOString().slice(0, 10)` (returns UTC date, wrong for UTC+8 users)

## Settlement Logic (`shouldShare` in core.js)
- Members without explicit `memberJoinTimes` entry default to `sheetCreatedDate`
- Such members are "original members" and always share all entries (even those before sheet creation)
- `shouldShare(member, entry, joinTimes, sheetCreatedDate, rawJoinISO)` takes 5 params (extracted from `renderSheetView`)

## Modal UX
- When modal opens, auto-focus first input (`.modal-body input/textarea/select`) — only for **create** modals; edit modals (`modalEditBook`, `modalRename`, `modalEditSheet`, `modalEntry` in edit mode) skip auto-focus
- Input placeholder hides immediately on focus (`input:focus::placeholder { color:transparent }`)
- Modal titles use `var(--primary)` (fluorescent green) color
- `visualViewport` API detects keyboard open/close
- Only short modals (height < visible area - 20px) get pushed up above keyboard; tall modals stay and use internal scroll

## Modal Locking
- When any modal opens, `body.modal-lock` class is applied (CSS: `position:fixed; overflow:hidden; touch-action:none; overscroll-behavior:none`)
- `body.modal-lock` is separate from `body.lock` (page-level lock for calc/settings tabs) to avoid conflict
- Uses `position:fixed` + `top` offset to prevent iOS/Android scroll (plain `overflow:hidden` doesn't work on mobile Safari)
- JavaScript saves/restores `window.scrollY` so body doesn't jump to top
- Adds `touchmove` event listener on `document` that blocks touches outside `.modal` elements (required for iOS Safari)
- Remove `body.modal-lock` + remove `touchmove` listener when modal closes
- Applies to both mobile and PC versions

## Scroll Locking
- Page-level: toggle `body.lock` CSS class (`overflow:hidden; touch-action:none; overscroll-behavior:none`)
- Login page: `touch-action:none` on `#authScreen`
- Calc tab: `main.style.overflow='hidden'`
- Settings tab: `main.style.display='flex'` + inner container `flex:1;overflow-y:auto`

## CSS Conventions
- Use CSS custom properties for theming: `--bg`, `--primary`, `--text`, `--surface`, etc.
- Use `classList.toggle('hide', bool)` with `!important` for visibility toggles (not inline `style.display`)
- Version text: `font-size:14px`, `color:#ccc`
- Eye icons: standard SVG (`<svg>...</svg>`), not emoji
- Google logo: official brand SVG (full color)
- No emojis unless explicitly requested
- Avoid `margin-top` / `transform` for logo positioning (breaks visual centering)

## SVG Icons
- Password eye icons: use proper SVG with `stroke="currentColor"`
- Backspace button: SVG icon, not text
- Use SVGs consistently instead of emoji characters

## Server
- `start-server.bat`: auto-elevates to admin, kills existing process on port 8080, starts Python http.server 8080
- Opens QR code in browser via `python -c "import webbrowser; ..."` (NOT `start ""` to avoid batch escaping issues)
- QR code API: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=URL`

## Mobile Layout
- Login/register pages: one screen height, vertically centered, no scroll
- Calculator tab: locked screen, not scrollable
- Settings tab: locked screen, inner container scrollable (no bounce-back)
- All pages responsive to different phone screen sizes
- Use `maximum-scale=1.0` in viewport meta, `font-size:16px` on inputs to prevent iOS zoom

## Code Convention
- No comments in code unless explicitly asked
- Extract pure-logic functions from nested closures to global scope when splitting files
- `init()` stays in mobile file (it calls mobile-specific `enterApp()`, `showPage()`)

## Deploy
- 使用根目錄的 `deploy.bat` 部署到 Firebase Hosting
- 流程：syntax check → 自動備份到 `pwa\當天日期\NNN\` → `firebase deploy`
- 主要檔案目錄：`pwa\`，備份目錄：`pwa\當天日期\`

## Backup Rule
- 部署前自動備份到 `pwa\當天日期\NNN\`（NNN 自動遞增 001→002→003…）
- 每天一個日期資料夾，內含當天的序號備份
- 備份所有檔案：`index.html`, `index_mobile.html`, `index_pc.html`, `core.js`, `app.js`, `desktop.js`, `style.css`, `style_pc.css`, `firebase-config.js`, `sw.js`, `manifest.json`, `icon.svg`

## Version Rule
- **只要有修改就要改版號**
- 改動 `index_mobile.html`、`index_pc.html` 底部的 `V2.1.XX` 以及所有 `?v=N` 參數
- 改版時往尾數加 1（`V2.1.24` → `V2.1.25` → `V2.1.26` …）

## Pre-response Checklist
每次修改完成後、回覆使用者之前，必須依序執行：
1. `node --check` 確認所有 JS 檔案語法正確
2. **立即升版號** — `index_mobile.html`、`index_pc.html` 底部 `V2.1.XX`、所有 `?v=N` 參數
3. 檢查所有項目無誤後，才回覆使用者結果

## 還原規範
- **還原到某個版本時，必須完整檢查所有檔案**，對照該版本的所有改動逐項確認沒有被遺漏或留下不屬於該版本的程式碼。
- 還原後需逐一核對 `core.js`、`app.js`、`style.css`、`index.html` 中與該版本相關的所有函式和變數，確保沒有殘留的舊程式碼或遺漏的改動。
