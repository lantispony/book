/* ═══════════════════════════════════════════════
   共用帳本 — mobile.js (手機版 UI)
═══════════════════════════════════════════════ */

// ════════════════════════════════
// AUTH — 登入 / 建立帳號
// ════════════════════════════════
function showPage(page) {
  document.getElementById('pageLogin').style.display = page === 'login' ? 'flex' : 'none';
  document.getElementById('pageRegister').style.display = page === 'register' ? 'flex' : 'none';
}

function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

function handleAvatarUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    document.getElementById('avatarImg').src = url;
    document.getElementById('avatarImg').style.display = 'block';
    document.getElementById('avatarPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function triggerAvatarUpload() {
  document.getElementById('avatarInput').click();
}

async function loginWithEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd = document.getElementById('loginPassword').value;
  if (!email || !pwd) { toast('請輸入電子郵件與密碼', 'error'); return; }

  // 模擬驗證：若已有儲存的使用者且 email 匹配就登入
  const stored = await loadUser();
  if (stored && currentUser.email === email) {
    enterApp();
  } else {
    toast('找不到帳號，請先建立帳號', 'error');
  }
}
async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    setCurrentUserFromFirebase(result.user);
    const migrated = migrateLocalStorage();
    if (migrated) await saveState(); else await loadState();
    enterApp();
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') toast('Google 登入失敗', 'error');
  }
}
function loginWithApple() {
  if (!currentUser) {
    currentUser = {
      id: uid(), name: 'Apple 使用者', nickname: 'AppleUser',
      email: 'user@icloud.com', gender: '', phone: '', birthday: '',
      avatarDataUrl: '', lang: 'zh-TW', createdAt: new Date().toISOString()
    };
    saveUser();
  }
  enterApp();
  toast('已以 Apple ID 登入', 'success');
}

async function registerUser() {
  const name = document.getElementById('regName').value.trim();
  const nickname = document.getElementById('regNickname').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pwd = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!name || !nickname || !email) { toast('請填寫必填欄位（姓名、暱稱、Email）', 'error'); return; }
  if (!pwd || pwd.length < 8) { toast('密碼至少需要 8 個字元', 'error'); return; }
  if (pwd !== confirm) { toast('兩次密碼輸入不一致', 'error'); return; }

  const avatarImg = document.getElementById('avatarImg');
  const avatarUrl = avatarImg.style.display !== 'none' ? avatarImg.src : '';

  currentUser = {
    id: uid(), name, nickname, email,
    gender: document.getElementById('regGender').value,
    phone: document.getElementById('regPhone').value.trim(),
    birthday: document.getElementById('regBirthday').value,
    avatarDataUrl: avatarUrl,
    lang: 'zh-TW',
    createdAt: new Date().toISOString()
  };
  await saveUser();
  enterApp();
  toast(`歡迎，${nickname}！帳號已建立`, 'success');
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  applySettings();
  try { render(); }
  catch(e) {
    console.error('Render error:', e);
    document.getElementById('main').innerHTML = '<div style="padding:40px;color:#FF4B4B;font-size:14px">Error: ' +
      e.message + '<br><br>' + e.stack?.split('\n').slice(0,3).join('<br>') + '</div>';
  }
}

function logout() {
  auth.signOut();
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  showPage('login');
}


// ════════════════════════════════
// BREADCRUMB
// ════════════════════════════════
function updateBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (nav.tab !== 'home') { bc.innerHTML = ''; return; }

  let html = `<span class="bc-item${!nav.path.length ? ' active' : ''}" onclick="goHome()">首頁</span>`;
  if (!nav.path.length) { bc.innerHTML = html; return; }
  const book = currentBook();
  if (book) {
    html += `<span class="bc-sep"> › </span><span class="bc-item${nav.path.length === 1 ? ' active' : ''}" onclick="goDepth(0)">${book.name}</span>`;
  }
  if (nav.path.length > 1) {
    let list = book.rootItems;
    for (let i = 1; i < nav.path.length; i++) {
      const node = list.find(x => x.id === nav.path[i]); if (!node) break;
      const isLast = i === nav.path.length - 1;
      html += `<span class="bc-sep"> › </span><span class="bc-item${isLast ? ' active' : ''}" onclick="goDepth(${i})">${node.name}</span>`;
      if (node.type === 'folder') list = node.items;
    }
  }
  bc.innerHTML = html;
}

// ════════════════════════════════
// BOTTOM NAV
// ════════════════════════════════
function updateBottomNav() {
  ['home','calc','settings','account'].forEach(id =>
    document.getElementById('nav-' + id)?.classList.remove('active')
  );
  const activeId = 'nav-' + (nav.tab || 'home');
  document.getElementById(activeId)?.classList.add('active');
}

let _savedHomePath = null;

function switchToTab(tab) {
  if (tab === 'home') {
    if (nav.tab === 'home') {
      _savedHomePath = null;
      nav.path = [];
    } else {
      if (_savedHomePath !== null) {
        nav.path = _savedHomePath;
        _savedHomePath = null;
      }
    }
  } else {
    if (nav.tab === 'home') {
      _savedHomePath = [...nav.path];
    }
  }
  nav.tab = tab;
  render();
}

function topbarAddAction() {
  if (nav.tab !== 'home') return;
  if (!nav.path.length) { openCreateBook(); return; }
  const node = currentNode();
  // 在資料夾或帳本根目錄：只能新增子資料夾或記帳表單
  if (!node || node.type === 'folder') openNewItem(null);
  else openAddEntry();
}

// ════════════════════════════════
// TOPBAR
// ════════════════════════════════
function renderTopbar() {
  const u = currentUser;
  if (!u) return;

  // 頭像
  const avatarLetter = document.getElementById('topbarAvatarLetter');
  const avatarImg = document.getElementById('topbarAvatarImg');
  if (u.avatarDataUrl) {
    avatarImg.src = u.avatarDataUrl;
    avatarImg.style.display = 'block';
    avatarLetter.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarLetter.style.display = 'block';
    avatarLetter.textContent = (u.nickname || u.name || 'U').charAt(0).toUpperCase();
  }

  // 暱稱 + 問候語
  document.getElementById('topbarNickname').textContent = u.nickname || u.name;
  document.getElementById('topbarGreeting').textContent = getGreeting(u.lang || state.settings.lang);

  // 新增按鈕：只在 home tab 顯示
  document.getElementById('topbarAddBtn').style.display = nav.tab === 'home' ? 'flex' : 'none';
}

// ════════════════════════════════
// FAB
// ════════════════════════════════
function renderFab() {
  const fab = document.getElementById('fab');
  fab.style.display = 'none'; // 使用頁面內「＋新增帳目」按鈕取代浮動按鈕
}

// ════════════════════════════════
// MAIN RENDER CONTROLLER
// ════════════════════════════════
function render() {
  // 切換非首頁頁面時隱藏 topbar / breadcrumb
  var isNonHome = nav.tab === 'calc' || nav.tab === 'settings' || nav.tab === 'account';
  var tb = document.querySelector('.topbar');
  if (tb) tb.classList.toggle('hide', isNonHome);
  var bc = document.querySelector('.breadcrumb');
  if (bc) bc.classList.toggle('hide', isNonHome);

  updateBreadcrumb();
  updateBottomNav();
  renderFab();

  document.body.classList.remove('lock');
  const main = document.getElementById('main');
  main.style.overflow = '';
  main.style.display = '';
  main.style.alignItems = '';
  main.style.padding = '';

  if (nav.tab === 'calc') { renderCalc(main); return; }
  if (nav.tab === 'settings') { renderSettings(main); return; }
  if (nav.tab === 'account') { renderAccount(main); return; }

  // Home tab
  renderTopbar();
  if (!nav.path.length) { renderHome(main); return; }
  const node = currentNode();
  if (!node || node.type === 'folder') renderFolderView(main);
  else if (node.type === 'sheet') renderSheetView(main);
}

// ════════════════════════════════
// HOME VIEW
// ════════════════════════════════
function renderHome(main) {
  const totalAll = state.books.reduce((a, b) => {
    const s = countBookStats(b);
    return { entries: a.entries + s.entries, total: a.total + s.total };
  }, { entries: 0, total: 0 });
  const bookCount = state.books.length;

  const hero = `
    <div class="home-hero">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div class="hero-label" style="margin:0">所有帳本總支出</div>
        <div class="hero-currency-badge" onclick="cycleHeroCurrency()" title="點擊切換幣別">${heroDisplayCurrency}</div>
      </div>
      <div class="hero-amount" style="color:var(--primary)">
        <span class="currency" id="heroCurrencySymbol" style="color:var(--primary)">${CURRENCY_SYMBOLS[heroDisplayCurrency] || '$'}</span><span id="heroAmt">0</span>
      </div>
      <div class="hero-growth">▲ ${bookCount} 個帳本</div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">帳目筆數</div>
          <div class="hero-stat-val">${totalAll.entries}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">帳本數量</div>
          <div class="hero-stat-val">${bookCount}</div>
        </div>
      </div>
    </div>`;

  let bookCards = '';
  if (!state.books.length) {
    bookCards = `<div class="empty-state">
      <div class="empty-title">尚無帳本</div>
      <div class="empty-sub">點擊右上角 ⊕ 建立第一個帳本</div>
    </div>`;
  } else {
    bookCards = state.books.map(b => {
      const s = countBookStats(b);
      // 成員頭像疊排（最多顯示 3 個）
      const memberAvatars = b.members.slice(0, 3).map(m =>
        `<div class="member-stack-avatar">${m.charAt(0).toUpperCase()}</div>`
      ).join('');
      const moreMember = b.members.length > 3
        ? `<div class="member-stack-avatar" style="background:var(--surface3);color:var(--text3);font-size:9px">+${b.members.length-3}</div>` : '';

      return `<div class="book-card" onclick="goBook('${b.id}')">
        <div class="book-card-accent folder-accent" style="background:linear-gradient(90deg,#FFD040,transparent)"></div>

        <!-- 左側：名稱 + 說明 + 金額 -->
        <div class="book-card-left">
          <div class="book-card-name">${b.name}</div>
          ${b.desc ? `<div class="book-card-desc">${b.desc}</div>` : ''}
          <div class="book-card-total">${fmt(s.total, b.currency)}</div>
        </div>

        <!-- 右側：info在左，⋮獨立靠右垂直置中 -->
        <div class="book-card-right">
          <div class="book-card-right-info">
            <div class="book-card-currency">${b.currency || 'TWD'}</div>
            <div class="book-card-right-bottom">
              <div class="member-stack-wrap">${memberAvatars}${moreMember}</div>
              <div class="book-card-entry-count">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>${s.entries}</span>
              </div>
            </div>
          </div>
          <button class="book-card-menu-btn"
            onclick="event.stopPropagation();openBookMenu(event,'${b.id}')">⋮</button>
        </div>
      </div>`;
    }).join('');
  }

  main.innerHTML = `${hero}
    <div class="section-label" style="margin-top:4px">我的帳本</div>
    <div class="book-list">${bookCards}</div>`;

  animateNumber('heroAmt', totalAll.total, 800, heroDisplayCurrency);
}

// ════════════════════════════════
// BOOK MENU (⋮ 按鈕 → 置中彈窗)
// ════════════════════════════════
function openBookMenu(ev, bookId) {
  ev.stopPropagation();
  if (typeof closeAllEntryDropdowns === 'function') closeAllEntryDropdowns();
  const menu = document.getElementById('ctxMenu');
  if (menu.classList.contains('open') && ctxTarget?.scope === 'book' && ctxTarget?.bookId === bookId) {
    closeCtxMenu(); return;
  }
  ctxTarget = { scope: 'book', bookId };
  document.getElementById('ctxEdit').style.display = 'flex';
  document.getElementById('ctxEdit').textContent = '編輯';
  document.getElementById('ctxRename').style.display = 'none';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxClose').style.display = 'none';
  document.getElementById('ctxSep').style.display = 'block';

  // 取得按鈕位置，彈窗固定在按鈕下方、畫面右側
  const btn = ev.currentTarget || ev.target;
  const rect = btn.getBoundingClientRect();

  // 設定文字置中
  menu.style.textAlign = 'center';

  // 計算 x 位置：右對齊按鈕，確保不超出左邊界
  const menuW = 140;
  let x = rect.right - menuW;
  if (x < 12) x = 12;
  if (x + menuW > window.innerWidth - 12) x = window.innerWidth - menuW - 12;

  // 計算 y 位置：在按鈕正下方
  let y = rect.bottom + 8;
  if (y + 100 > window.innerHeight - 20) y = rect.top - 108;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('open');
  if (window._ctxScrollHandler) window.removeEventListener('scroll', window._ctxScrollHandler);
  window._ctxScrollHandler = closeCtxMenu;
  window.addEventListener('scroll', window._ctxScrollHandler, { once: true });
}

// ════════════════════════════════
// FOLDER VIEW
// ════════════════════════════════
function renderFolderView(main) {
  const book = currentBook(); if (!book) return goHome();
  const items = currentItemsList() || [];
  const node = currentNode();
  const isRoot = nav.path.length === 1;
  const name = node ? node.name : book.name;
  const s = node ? countFolderStats(node) : countBookStats(book);

  let itemsHtml = '';
  if (!items.length) {
    itemsHtml = `<div class="empty-state" style="padding:40px 0">
      <div class="empty-title">尚無項目</div>
      <div class="empty-sub">點擊右上角 ⊕ 新增子資料夾或記帳表單</div>
    </div>`;
  } else {
    itemsHtml = `<div class="items-grid">${items.map(it => {
      if (it.type === 'folder') {
        const fs = countFolderStats(it);
        const isFolderClosed = it.closed;
        const folderOpacity = isFolderClosed ? 'opacity:0.6;' : '';
        const folderClosedBadge = isFolderClosed
          ? `<span style="font-size:10px;color:var(--primary);margin-left:6px">已關閉</span>` : '';
        const folderCreatedBadge = it.createdAt
          ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${it.createdAt}</div>` : '';
        return `<div class="book-card" style="cursor:pointer;${folderOpacity}" onclick="pushNav('${it.id}')">
          <div class="book-card-accent folder-accent" style="background:linear-gradient(90deg,#FFD040,transparent)"></div>
          <div class="book-card-left">
            ${it.desc ? `<div class="book-card-desc">${it.desc}</div>` : ''}
            <div class="book-card-total" style="font-size:14px;color:var(--text2)">${it.items.length} 個項目</div>
            ${folderCreatedBadge}
          </div>
          <div class="book-card-right">
            <div class="book-card-right-info">
              <div style="height:22px"></div>
              <div class="book-card-right-bottom">
                ${fs.entries ? `<div class="book-card-entry-count"><span>${fs.entries}</span> 筆</div>` : ''}
              </div>
            </div>
            <button class="book-card-menu-btn" onclick="event.stopPropagation();openCtxItem(event,'${it.id}')">⋮</button>
          </div>
        </div>`;
      } else {
        const total = it.entries.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
        const sheetMembers = (it.members || book?.members || []).slice(0,3).map(m =>
          `<div class="member-stack-avatar">${m.charAt(0).toUpperCase()}</div>`).join('');
        const isClosedCard = it.closed;
        const cardOpacity = isClosedCard ? 'opacity:0.6;' : '';
        const closedCardBadge = isClosedCard
          ? `<span style="font-size:10px;color:var(--primary);margin-left:6px">已結清</span>` : '';
        const createdCardBadge = it.createdAt
          ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${it.createdAt}</div>` : '';
        return `<div class="book-card" style="cursor:pointer;${cardOpacity}" onclick="pushNav('${it.id}')">
          <div class="book-card-accent sheet-accent" style="background:linear-gradient(90deg,var(--primary),transparent)"></div>
          <div class="book-card-left">
            <div class="book-card-name">${it.name}${closedCardBadge}</div>
            ${it.desc ? `<div class="book-card-desc">${it.desc}</div>` : ''}
            <div class="book-card-total" style="${isClosedCard ? 'color:#777;text-decoration:line-through' : ''}">${it.entries.length ? fmt(total, book?.currency) : '—'}</div>
            ${createdCardBadge}
          </div>
          <div class="book-card-right">
            <div class="book-card-right-info">
              <div class="book-card-currency">${book?.currency || 'TWD'}</div>
              <div class="book-card-right-bottom">
                <div class="member-stack-wrap">${sheetMembers}</div>
                <div class="book-card-entry-count">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>${it.entries.length}</span>
                </div>
              </div>
            </div>
            <button class="book-card-menu-btn" onclick="event.stopPropagation();openCtxItem(event,'${it.id}')">⋮</button>
          </div>
        </div>`;
      }
    }).join('')}</div>`;
  }

  main.innerHTML = `
    <div class="home-hero">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div class="hero-label" style="margin:0">${name}</div>
        <div class="hero-currency-badge">${book.currency||'TWD'}</div>
      </div>
      <div class="hero-amount" style="color:var(--primary)">
        <span class="currency" style="color:var(--primary)">${CURRENCY_SYMBOLS[book.currency||'TWD']||'$'}</span><span id="folderAmt">${NO_DECIMAL_CURRENCIES.has(book.currency||'TWD') ? Math.ceil(s.total||0).toLocaleString('zh-TW',{maximumFractionDigits:0}) : ((s.total||0)).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      <div class="hero-growth" style="margin-top:8px">▲ ${book.name}</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-label">總支出</div><div class="hero-stat-val">${fmt(s.total||0,book.currency)}</div></div>
        <div class="hero-stat"><div class="hero-stat-label">項目數</div><div class="hero-stat-val">${items.length}</div></div>
        <div class="hero-stat"><div class="hero-stat-label">帳目筆數</div><div class="hero-stat-val">${s.entries||0}</div></div>
      </div>
    </div>
    <div class="section-label">項目列表</div>
    ${itemsHtml}`;
}

// ════════════════════════════════
// SHEET VIEW
// ════════════════════════════════
function renderSheetView(main) {
  const book = currentBook(); if (!book) return goHome();
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;

  const totalS = sheet.entries.filter(e => e.type === 'shared').reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  const totalA = sheet.entries.filter(e => e.type === 'advance').reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  const total = totalS + totalA;

  // 計算每位成員的支出與代墊結算
  const members = (sheet.members?.length ? sheet.members : book.members?.length ? book.members : (currentUser ? [currentUser.nickname||currentUser.name] : []));
  const memberStats = {};
  members.forEach(m => { memberStats[m] = { paid: 0, shouldPay: 0, advanceOut: 0, advanceIn: 0 }; });

  // E: 公平分攤 — 依成員加入日期切割（本地時區 YYYY-MM-DD）
  const joinTimes = {};
  const rawJoin = sheet.memberJoinTimes || {};
  // 統一轉為本地 YYYY-MM-DD
  const sheetCreatedDate = sheet.createdAt
    ? (() => { const d = new Date(sheet.createdAt.replace(' ','T').replace(/\//g,'-')); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })()
    : '2000-01-01';
  members.forEach(m => {
    const raw = rawJoin[m];
    if (!raw) { joinTimes[m] = sheetCreatedDate; return; }
    if (raw.length <= 10) { joinTimes[m] = raw; return; }
    // ISO string → 本地日期
    const d = new Date(raw);
    joinTimes[m] = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  });

  const rawJoinISO = sheet.memberJoinTimes || {}; // 原始 ISO 用於同天精確比對

  // 共用支出：每筆帳目依當時應分攤的成員平均
  const sharedEntries = sheet.entries.filter(e => e.type === 'shared');
  sharedEntries.forEach(e => {
    const activeMembers = members.filter(m => shouldShare(m, e, joinTimes, sheetCreatedDate, rawJoinISO));
    const share = activeMembers.length ? (parseFloat(e.amount)||0) / activeMembers.length : 0;
    activeMembers.forEach(m => { memberStats[m].shouldPay += share; });
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });

  // 代墊：payer 代墊給 debtor，等同 payer 借錢給 debtor
  // advance 對 payer 是「應收」，對 debtor 是「應付」
  sheet.entries.filter(e => e.type === 'advance').forEach(e => {
    const amt = parseFloat(e.amount)||0;
    // payer 借出去這筆錢，應收回 → +amt
    if (memberStats[e.payer]) memberStats[e.payer].advanceOut += amt;
    // debtor 借了這筆錢，應還出去 → -amt
    if (e.debtor && memberStats[e.debtor]) memberStats[e.debtor].advanceIn += amt;
  });

  // 自用：個人支出，payer 全額自付，不影響結算
  sheet.entries.filter(e => e.type === 'self').forEach(e => {
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });

  // 直接計算每對成員間的原始債務，不整合
  // 每筆共用帳目：payer 對每位其他 activeMembers 有應收
  // 每筆代墊帳目：payer 對 debtor 有應收
  const pairBalances = {}; // key: `A→B` 表示 B 欠 A 多少（正數）

  // 共用帳目
  const sharedDebug = [];
  sheet.entries.filter(e => e.type === 'shared').forEach(e => {
    const activeMembers = members.filter(m => shouldShare(m, e, joinTimes, sheetCreatedDate, rawJoinISO));
    sharedDebug.push({entry:e, activeMembers, members, joinTimes, rawJoinISO});
    if (!activeMembers.length) return;
    const share = (parseFloat(e.amount)||0) / activeMembers.length;
    activeMembers.forEach(debtor => {
      if (debtor === e.payer) return;
      const k = getPair(e.payer, debtor, pairBalances);
      if (k.startsWith(e.payer + '→')) pairBalances[k] += share;
      else pairBalances[k] -= share;
    });
  });
  console.log('SETTLE DEBUG:', JSON.stringify(sharedDebug, (k,v)=>k==='entry'?v.id:v, 2));

  // 代墊帳目：payer 直接借給 debtor
  sheet.entries.filter(e => e.type === 'advance' && e.debtor && e.debtor !== e.payer).forEach(e => {
    const amt = parseFloat(e.amount)||0;
    const k = getPair(e.payer, e.debtor, pairBalances);
    if (k.startsWith(e.payer)) pairBalances[k] += amt;
    else pairBalances[k] -= amt;
  });

  // 轉換成 transfers 陣列，正數表示 from 欠 to
  const transfers = [];
  Object.entries(pairBalances).forEach(([key, val]) => {
    const [creditor, debtor] = key.split('→');
    if (val > 0.01) transfers.push({ from: debtor, to: creditor, amount: Math.round(val) });
    else if (val < -0.01) transfers.push({ from: creditor, to: debtor, amount: Math.round(-val) });
  });

  // Store for settle status modal
  window._currentTransfers = transfers;
  window._currentMembers = members;

  // 建立每人的收付明細
  const memberTransfers = {};
  members.forEach(m => memberTransfers[m] = { receive: [], pay: [] });
  transfers.forEach(t => {
    memberTransfers[t.to].receive.push({ from: t.from, amount: t.amount, key: `${t.from}→${t.to}` });
    memberTransfers[t.from].pay.push({ to: t.to, amount: t.amount, key: `${t.from}→${t.to}` });
  });

  if (!sheet.settleStatus) sheet.settleStatus = {};



  const settlementHtml = members.map(m => {
    const st = memberStats[m] || { paid:0, advanceOut:0, advanceIn:0, shouldPay:0 };
    const mt = memberTransfers[m];
    const avatar = `<div class="settle-avatar">${m.charAt(0).toUpperCase()}</div>`;
    const totalPaid = st.paid + st.advanceOut;

    let rightHtml = '';
    if (mt.receive.length === 0 && mt.pay.length === 0) {
      rightHtml = '';
    } else {
      rightHtml += mt.receive.map(r => {
        const isPaid = sheet.settleStatus[r.key] === 'paid';
        return `<div style="font-size:13px;font-weight:700;${isPaid?'color:#777;text-decoration:line-through':'color:var(--primary)'}">向 ${r.from} 收款 ${fmt(r.amount, book.currency)}</div>`;
      }).join('');
      rightHtml += mt.pay.map(p => {
        const isPaid = sheet.settleStatus[p.key] === 'paid';
        return `<div style="font-size:13px;font-weight:700;${isPaid?'color:#777;text-decoration:line-through':'color:var(--red)'}">付款給 ${p.to} ${fmt(p.amount, book.currency)}</div>`;
      }).join('');
    }

    return `<div class="settle-row" style="cursor:pointer" onclick="openSettleStatus('${m}')">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${avatar}
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${m}</div>
          <div style="font-size:17px;color:var(--text3);margin-top:8px">支出 ${fmt(totalPaid, book.currency)}</div>
        </div>
      </div>
      <div style="text-align:right">${rightHtml}</div>
    </div>`;
  }).join('');

  const isClosed = sheet.closed;
  const closedStyle = isClosed ? 'color:#777;text-decoration:line-through;' : '';
  const closedBadge = isClosed
    ? `<div style="font-size:11px;color:#777;margin-top:4px">已結清 · ${sheet.closedAt||''}</div>`
    : '';
  const createdBadge = sheet.createdAt
    ? `<span style="font-size:11px;color:var(--text3);margin-left:6px">${sheet.createdAt}</span>` : '';
  main.innerHTML = `
    <div class="sheet-hero">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div class="sheet-hero-label">📄 ${sheet.name}${createdBadge}</div>
          <div class="sheet-hero-amount" id="sheetHeroAmt" style="${closedStyle}">—</div>
          ${closedBadge}
          <div class="sheet-hero-sub">${sheet.entries.length} 筆記錄 · ${book.name}</div>
        </div>
        <button class="book-card-menu-btn" onclick="openCtxSheet(event,'${sheet.id}')">⋮</button>
      </div>
      <div class="members-row" id="sheetMembers"></div>
    </div>
    <div class="section-label">結算金額</div>
    <div class="settle-list">${settlementHtml}</div>
    <div class="section-label" style="margin-top:16px">交易紀錄</div>
    <div class="tx-list" id="txList"></div>
    ${isClosed ? `<div style="text-align:center;color:var(--text3);font-size:13px;padding:12px 0">帳本已關閉，無法新增帳目</div>` : `<button class="add-tx-btn" onclick="openAddEntry()" style="margin-top:8px">＋ 新增帳目</button>`}`;

  const amtEl = document.getElementById('sheetHeroAmt');
  if (amtEl) {
    const sheetCurrency = sheet?.currency || book?.currency || 'TWD';
    const noDecimal = NO_DECIMAL_CURRENCIES.has(sheetCurrency);
    const start = performance.now(), dur = 600;
    const sym = CURRENCY_SYMBOLS[sheetCurrency] || '$';
    const fmtN = n => {
      const val = noDecimal ? Math.ceil(n) : Math.ceil(n * 100) / 100;
      return sym + (noDecimal
        ? val.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
        : val.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    };
    function step(now) {
      const pct = Math.min((now - start) / dur, 1), ease = 1 - Math.pow(1 - pct, 3);
      amtEl.textContent = fmtN(total * ease);
      if (pct < 1) requestAnimationFrame(step); else {
        amtEl.textContent = fmtN(total);
        if (isClosed) { amtEl.style.color = '#777'; amtEl.style.textDecoration = 'line-through'; }
      }
    }
    requestAnimationFrame(step);
  }

  const mEl = document.getElementById('sheetMembers');
  book.members.forEach(m => {
    mEl.insertAdjacentHTML('beforeend',
      `<div class="member-avatar"><div class="member-avatar-dot">${m.charAt(0).toUpperCase()}</div></div>`);
  });
  renderTxList(sheet, book);
}

function renderTxList(sheet, book) {
  const list = document.getElementById('txList'); if (!list) return;
  if (!sheet.entries.length) {
    list.innerHTML = `<div class="empty-state" style="padding:30px 0">
      <div class="empty-title">尚無帳目</div>
      <div class="empty-sub">點擊下方 ＋ 新增帳目 開始記錄</div>
    </div>`;
    return;
  }
  const getIcon = item => {
    const k = item.toLowerCase();
    if (/餐|食|飯|吃|料理|咖啡/.test(k)) return '🍽️';
    if (/車|計程|捷運|交通|油|高鐵|火車|機票/.test(k)) return '🚗';
    if (/住|旅館|飯店|民宿/.test(k)) return '🏨';
    if (/購|買|商|超市|便利|衣/.test(k)) return '🛍️';
    if (/票|門|活動|娛樂|電影/.test(k)) return '🎟️';
    return '💳';
  };
  list.innerHTML = sheet.entries.map((e, i) => {
    const tTag = e.type === 'shared'
      ? '<span class="tx-tag shared">共用</span>'
      : e.type === 'advance'
        ? '<span class="tx-tag advance">代墊</span>'
        : '<span class="tx-tag self">自用</span>';
    const pTag = (e.payMethod || '現金') === '現金'
      ? '<span class="tx-tag cash">現金</span>'
      : `<span class="tx-tag card">${e.payMethod}</span>`;
    const debtorLine = (e.type === 'advance' && e.debtor)
      ? `<div style="font-size:12px;color:var(--yellow);margin-top:3px;font-weight:600">${e.debtor}</div>` : '';
    const seq = `#${String(i + 1).padStart(3, '0')}`;
    return `<div class="tx-item">
      <div class="tx-seq-col">${seq}</div>
      <div class="tx-body">
        <div class="tx-name">${e.item}</div>
        <div class="tx-meta">${tTag}${pTag}<span class="tx-payer">${e.payer || ''}</span></div>
        ${debtorLine}
        ${e.note ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${e.note}</div>` : ''}
      </div>
      <div class="tx-right">
        <div class="tx-amount ${e.type}">${fmt(e.amount, e.currency)}</div>
        <div class="tx-date">${e.date}</div>
      </div>
      <button class="tx-more" onclick="openCtxEntry(event,'${e.id}')">⋮</button>
    </div>`;
  }).join('');
}

// ════════════════════════════════
// B. 個別結清 Modal
// ════════════════════════════════
function openSettleStatus(memberName) {
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;
  const book = currentBook(); if (!book) return;
  if (!sheet.settleStatus) sheet.settleStatus = {};

  const transfers = window._currentTransfers || [];
  // Find all pairs involving this member
  const pairs = transfers.filter(t => t.from === memberName || t.to === memberName);

  if (!pairs.length) {
    toast('此成員目前無待結清款項', 'info'); return;
  }

  const body = document.getElementById('settleStatusBody');
  body.dataset.member = memberName;

  body.innerHTML = `
    <div style="font-size:13px;color:var(--text3);margin-bottom:14px">
      點擊成員名稱旁的下拉選單更改結清狀態
    </div>
    ${pairs.map(t => {
      const key = `${t.from}→${t.to}`;
      const status = sheet.settleStatus[key] || 'unpaid';
      const otherName = t.from === memberName ? t.to : t.from;
      return `<div class="settle-status-row" id="ssr-${key.replace(/[^a-z0-9]/gi,'_')}">
        <div style="font-size:15px;font-weight:700;color:var(--text)">${otherName}</div>
        <div style="position:relative">
          <div class="select-btn" id="ss_btn_${key.replace(/[^a-z0-9]/gi,'_')}" onclick="toggleSettleStatus('${key}')"
            style="padding:8px 12px;gap:6px;width:auto;min-width:100px">
            <span id="ss_label_${key.replace(/[^a-z0-9]/gi,'_')}">${status === 'paid' ? '已結清' : '尚未結清'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div id="ss_dd_${key.replace(/[^a-z0-9]/gi,'_')}" class="dropdown-panel" style="display:none;position:absolute;z-index:10;left:0;right:0;top:calc(100% + 4px);border:1.5px solid var(--border);border-radius:var(--radius-xs);overflow:hidden;min-width:100%">
            <div class="select-option${status === 'unpaid' ? ' selected' : ''}" onclick="setSettleStatus('${key}','unpaid')" style="padding:10px 14px">尚未結清</div>
            <div class="select-option${status === 'paid' ? ' selected' : ''}" onclick="setSettleStatus('${key}','paid')" style="padding:10px 14px">已結清</div>
          </div>
        </div>
      </div>`;
    }).join('')}`;

  openModal('modalSettleStatus');
}

// ── 結算狀態下拉選單（按鈕展開式） ──
function toggleSettleStatus(key) {
  const id = 'ss_dd_' + key.replace(/[^a-z0-9]/gi,'_');
  const d = document.getElementById(id);
  if (!d) return;
  const open = d.style.display === 'block';
  document.querySelectorAll('[id^="ss_dd_"]').forEach(el => el.style.display = 'none');
  if (!open) d.style.display = 'block';
}
function setSettleStatus(key, value) {
  const label = document.getElementById('ss_label_' + key.replace(/[^a-z0-9]/gi,'_'));
  const dd = document.getElementById('ss_dd_' + key.replace(/[^a-z0-9]/gi,'_'));
  if (label) label.textContent = value === 'paid' ? '已結清' : '尚未結清';
  if (dd) dd.style.display = 'none';
  if (dd) dd.querySelectorAll('.select-option').forEach(o => {
    if (o.getAttribute('onclick') === `setSettleStatus('${key}','${value}')`) o.classList.add('selected');
    else o.classList.remove('selected');
  });
  updateSettleStatus(key, value);
}

function updateSettleStatus(key, value) {
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;
  if (!sheet.settleStatus) sheet.settleStatus = {};
  sheet.settleStatus[key] = value;
  saveState();
  // Re-render the settle list in the background so cards reflect change
  renderSettleRows();
}

function renderSettleRows() {
  // Re-render just the settle-list section without full page reload
  const settleList = document.querySelector('.settle-list');
  if (!settleList) return;
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;
  const book = currentBook(); if (!book) return;
  if (!sheet.settleStatus) sheet.settleStatus = {};

  const transfers = window._currentTransfers || [];
  const members = window._currentMembers || [];

  // Rebuild member transfer map
  const memberTransfers = {};
  members.forEach(m => memberTransfers[m] = { receive: [], pay: [] });
  transfers.forEach(t => {
    memberTransfers[t.to] .receive.push({ from: t.from, amount: t.amount, key: `${t.from}→${t.to}` });
    memberTransfers[t.from].pay .push({ to: t.to, amount: t.amount, key: `${t.from}→${t.to}` });
  });

  const memberStats = {};
  members.forEach(m => { memberStats[m] = { paid: 0, advanceOut: 0, advanceIn: 0, shouldPay: 0 }; });
  sheet.entries.filter(e => e.type === 'shared').forEach(e => {
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });
  sheet.entries.filter(e => e.type === 'advance').forEach(e => {
    const amt = parseFloat(e.amount)||0;
    if (memberStats[e.payer]) memberStats[e.payer].advanceOut += amt;
    if (e.debtor && memberStats[e.debtor]) memberStats[e.debtor].advanceIn += amt;
  });
  sheet.entries.filter(e => e.type === 'self').forEach(e => {
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });

  settleList.innerHTML = members.map(m => {
    const st = memberStats[m] || { paid:0, advanceOut:0, advanceIn:0 };
    const mt = memberTransfers[m] || { receive:[], pay:[] };
    const totalPaid = st.paid + st.advanceOut;
    const avatar = `<div class="settle-avatar">${m.charAt(0).toUpperCase()}</div>`;

    let rightHtml = '';
    if (mt.receive.length === 0 && mt.pay.length === 0) {
      rightHtml = '';
    } else {
      rightHtml += mt.receive.map(r => {
        const isPaid = sheet.settleStatus[r.key] === 'paid';
        return `<div style="font-size:13px;font-weight:700;${isPaid?'color:#777;text-decoration:line-through':'color:var(--primary)'}">
          向 ${r.from} 收款 ${fmt(r.amount, book.currency)}</div>`;
      }).join('');
      rightHtml += mt.pay.map(p => {
        const isPaid = sheet.settleStatus[p.key] === 'paid';
        return `<div style="font-size:13px;font-weight:700;${isPaid?'color:#777;text-decoration:line-through':'color:var(--red)'}">
          付款給 ${p.to} ${fmt(p.amount, book.currency)}</div>`;
      }).join('');
    }

    return `<div class="settle-row" style="cursor:pointer" onclick="openSettleStatus('${m}')">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${avatar}
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${m}</div>
          <div style="font-size:17px;color:var(--text3);margin-top:8px">支出 ${fmt(totalPaid, book.currency)}</div>
        </div>
      </div>
      <div style="text-align:right">${rightHtml}</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════
// CALCULATOR TAB
// ════════════════════════════════
function renderCalc(main) {
  document.body.classList.add('lock');
  main.style.overflow = 'hidden';
  main.style.padding = '0';
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;box-sizing:border-box;padding:0 20px calc(env(safe-area-inset-bottom,0px) + 90px)">
      <div style="width:100%">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
                    padding:20px 22px;margin-bottom:16px;min-height:100px;display:flex;flex-direction:column;justify-content:flex-end">
          <div id="calcExpr" style="font-size:15px;color:var(--text3);min-height:22px;
               font-family:'JetBrains Mono',monospace;margin-bottom:6px;text-align:right"></div>
          <div id="calcDisp" style="font-size:48px;font-weight:800;font-family:'JetBrains Mono',monospace;
               color:var(--primary);text-align:right;line-height:1.1">0</div>
        </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(5,1fr);gap:10px;min-height:300px">
        <button onclick="calcPress('⌫')" style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:transform .1s;user-select:none;grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:center;padding:20px 0"
          ontouchstart="this.style.transform='scale(.93)'" ontouchend="this.style.transform=''" onmousedown="this.style.transform='scale(.93)'" onmouseup="this.style.transform=''">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
            <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
          </svg>
        </button>
        ${calcBtn('C','clear','grid-column:2;grid-row:1')}
        ${calcBtn('÷','op','grid-column:3;grid-row:1')}
        ${calcBtn('×','op','grid-column:4;grid-row:1')}
        ${calcBtn('7','','grid-column:1;grid-row:2')}
        ${calcBtn('8','','grid-column:2;grid-row:2')}
        ${calcBtn('9','','grid-column:3;grid-row:2')}
        ${calcBtn('−','op','grid-column:4;grid-row:2')}
        ${calcBtn('4','','grid-column:1;grid-row:3')}
        ${calcBtn('5','','grid-column:2;grid-row:3')}
        ${calcBtn('6','','grid-column:3;grid-row:3')}
        ${calcBtn('＋','op','grid-column:4;grid-row:3')}
        ${calcBtn('1','','grid-column:1;grid-row:4')}
        ${calcBtn('2','','grid-column:2;grid-row:4')}
        ${calcBtn('3','','grid-column:3;grid-row:4')}
        ${calcBtn('＝','eq','grid-column:4;grid-row:4/6')}
        ${calcBtn('0','','grid-column:1/3;grid-row:5')}
        ${calcBtn('.','','grid-column:3;grid-row:5')}
      </div>
      </div>
    </div>`;

  window._calcExpr = '';
  window.calcPress = function(k) {
    const disp = document.getElementById('calcDisp');
    const expr = document.getElementById('calcExpr');
    if (!disp) return;
    if (k === 'C') { window._calcExpr = ''; disp.textContent = '0'; expr.textContent = ''; _calcFitDisp(); return; }
    if (k === '⌫') { window._calcExpr = window._calcExpr.slice(0,-1); disp.textContent = window._calcExpr || '0'; _calcFitDisp(); return; }
    if (k === '＝' || k === '=') {
      try {
        const raw = window._calcExpr.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-').replace(/＋/g,'+');
        const res = Function('"use strict";return (' + raw + ')')();
        expr.textContent = window._calcExpr + ' =';
        window._calcExpr = String(Math.round(res * 100) / 100);
        disp.textContent = window._calcExpr;
        _calcFitDisp();
      } catch(e) { disp.textContent = '錯誤'; _calcFitDisp(); }
      return;
    }
    if (window._calcExpr === '0' && /\d/.test(k)) window._calcExpr = k;
    else window._calcExpr += k;
    disp.textContent = window._calcExpr;
    _calcFitDisp();
  };

  function _calcFitDisp() {
    const disp = document.getElementById('calcDisp');
    if (!disp) return;
    const len = disp.textContent.length;
    let size = 48;
    if (len > 18) size = 22;
    else if (len > 14) size = 26;
    else if (len > 10) size = 32;
    else if (len > 6) size = 40;
    disp.style.fontSize = size + 'px';
  }
}

function calcBtn(k, type='num', extra='') {
  if (type === 'hidden') return `<button style="visibility:hidden;background:none;border:none"></button>`;
  const bg = type==='eq' ? 'var(--primary)' : type==='op' ? 'var(--surface2)' : type==='clear' ? 'var(--surface2)' : 'var(--surface)';
  const col = type==='eq' ? '#000' : type==='op' ? 'var(--primary)' : type==='clear' ? 'var(--red)' : 'var(--text)';
  return `<button onclick="calcPress('${k}')"
    style="background:${bg};border:1px solid var(--border);border-radius:var(--radius-sm);
           padding:20px 0;font-size:27px;font-weight:700;color:${col};
           font-family:'Inter',sans-serif;cursor:pointer;transition:transform .1s;user-select:none;${extra}"
    ontouchstart="this.style.transform='scale(.93)'" ontouchend="this.style.transform=''"
    onmousedown="this.style.transform='scale(.93)'" onmouseup="this.style.transform=''"
  >${k}</button>`;
}

// ════════════════════════════════
// SETTINGS TAB
// ════════════════════════════════
function renderSettings(main) {
  document.body.classList.add('lock');
  main.style.overflow = 'hidden';
  main.style.padding = '0';
  main.style.display = 'flex';
  const s = state.settings;
  const langs = [['zh-TW','繁體中文'],['zh-CN','简体中文'],['en','English'],['ja','日本語'],['ko','한국어']];
  const curLang = langs.find(([c]) => c === s.lang)?.[1] || '繁體中文';

  main.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:16px 20px 100px;box-sizing:border-box">
      <div style="position:relative">
        <div class="section-label">語言</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px;overflow:visible">
          <div onclick="toggleLangDropdown()"
            style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;cursor:pointer;font-size:16px;font-weight:600">
            <span id="langCurrentLabel">${curLang}</span>
            <svg id="langChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 style="transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div id="langDropdown" style="display:none;position:absolute;z-index:10;left:-1px;right:-1px;background:rgba(0,0,0,.85);border:1.5px solid var(--border);border-radius:var(--radius);overflow:hidden">
            ${langs.map(([code,label]) => `
              <div onclick="setLang('${code}')"
                style="display:flex;align-items:center;justify-content:space-between;padding:15px 18px;
                       font-size:15px;font-weight:500;cursor:pointer;
                       background:${s.lang===code?'var(--primary-dim)':'transparent'};
                       color:${s.lang===code?'var(--primary)':'var(--text2)'};
                       border-bottom:1px solid var(--border)">
                ${label}
                ${s.lang===code?'<div style="width:10px;height:10px;border-radius:50%;background:var(--primary)"></div>':''}
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="section-label">字體大小</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:4px;margin-bottom:24px">
        <div class="setting-row" style="padding:14px 16px;border:none">
          <div><div class="setting-label">文字大小</div><div class="setting-sub">目前：${s.fontSize}px</div></div>
          <div class="stepper">
            <button class="stepper-btn" onclick="setFontSize(${s.fontSize-1})">−</button>
            <div class="stepper-val">${s.fontSize}</div>
            <button class="stepper-btn" onclick="setFontSize(${s.fontSize+1})">+</button>
          </div>
        </div>
      </div>

      <div class="section-label">顯示顏色</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px">
        ${[['文字顏色','textColor'],['金額顏色','amountColor'],['背景顏色','bgColor']].map(([label,key],i,arr) => `
          <div class="setting-row" style="padding:15px 18px;${i<arr.length-1?'border-bottom:1px solid var(--border)':''}">
            <div class="setting-label">${label}</div>
            <div class="color-block" style="background:${s[key]||'#FFF'};width:36px;height:36px;
                 border-radius:8px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0"
                 onclick="openColorPicker('${key}','${label}')"></div>
          </div>`).join('')}
      </div>
      <!-- 恢復初始設定 -->
      <div style="margin-top:8px">
        <button onclick="resetSettings()"
          style="width:100%;padding:14px;background:transparent;
                 border:1.5px solid var(--border2);border-radius:var(--radius-sm);
                 color:var(--text2);font-size:15px;font-weight:600;
                 font-family:'Inter',sans-serif;cursor:pointer;transition:all .18s"
          onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
          onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text2)'">
          恢復初始設定
        </button>
      </div>
    </div>

    <!-- 調色盤 Modal -->
    <div id="colorPickerOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);
         backdrop-filter:blur(8px);z-index:500;align-items:center;justify-content:center;padding:20px">
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:20px;
                  padding:22px;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <div style="font-size:16px;font-weight:700" id="colorPickerTitle">選擇顏色</div>
          <button onclick="closeColorPicker()"
            style="background:var(--surface3);border:none;color:var(--text2);font-size:18px;
                   cursor:pointer;padding:4px 10px;border-radius:20px;line-height:1">✕</button>
        </div>
        <!-- 色板 -->
        <div id="colorCanvas"
          style="width:100%;height:190px;border-radius:12px;margin-bottom:14px;position:relative;
                 cursor:crosshair;border:1px solid var(--border);
                 background:linear-gradient(to bottom,transparent,#000),linear-gradient(to right,#fff,hsl(120,100%,50%))"
          onmousedown="startCanvasDrag(event)" ontouchstart="startCanvasDrag(event)">
          <div id="cpDot" style="position:absolute;width:18px;height:18px;border-radius:50%;
               border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.6);
               transform:translate(-50%,-50%);pointer-events:none;top:20%;left:80%"></div>
        </div>
        <!-- 色相 -->
        <input type="range" id="hueSlider" min="0" max="360" value="120" oninput="onHueChange()"
          style="width:100%;height:18px;border-radius:9px;outline:none;cursor:pointer;
                 background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);
                 -webkit-appearance:none;margin-bottom:10px;border:none">
        <!-- 透明度 -->
        <input type="range" id="alphaSlider" min="0" max="100" value="100" oninput="onAlphaChange()"
          style="width:100%;height:18px;border-radius:9px;outline:none;cursor:pointer;
                 -webkit-appearance:none;margin-bottom:18px;border:none;
                 background:linear-gradient(to right,transparent,hsl(120,100%,50%))">
        <!-- HEX + Preview -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
          <div style="background:var(--surface3);border:1px solid var(--border);border-radius:10px;
               padding:11px 14px;flex:1;display:flex;align-items:center;gap:8px">
            <span style="color:var(--text3);font-family:'JetBrains Mono',monospace;font-size:16px">#</span>
            <input id="hexInput" maxlength="6" placeholder="A8FF00"
              style="background:none;border:none;color:var(--text);font-family:'JetBrains Mono',monospace;
                     font-size:16px;font-weight:600;outline:none;width:100%;letter-spacing:2px"
              oninput="onHexInput(this.value)">
          </div>
          <div id="colorPreview" style="width:42px;height:42px;border-radius:10px;border:2px solid var(--border2);flex-shrink:0"></div>
        </div>
        <button onclick="applyColorPicker()" class="btn primary" style="width:100%;padding:14px;font-size:15px">套用</button>
      </div>
    </div>`;

  window._langOpen = false;
}

function toggleLangDropdown() {
  window._langOpen = !window._langOpen;
  document.getElementById('langDropdown').style.display = window._langOpen ? 'block' : 'none';
  document.getElementById('langChevron').style.transform = window._langOpen ? 'rotate(180deg)' : '';
}

// ── Color Picker ──
let _cpKey = '', _cpH = 120, _cpS = 0.8, _cpV = 1.0;

function openColorPicker(key, label) {
  _cpKey = key;
  const hex = (state.settings[key] || '#A8FF00').replace('#','');
  document.getElementById('colorPickerTitle').textContent = label;
  document.getElementById('hexInput').value = hex.toUpperCase();
  syncPreview(hex);
  hexToHSV(hex);
  updateCanvas();
  document.getElementById('colorPickerOverlay').style.display = 'flex';
}
function closeColorPicker() { document.getElementById('colorPickerOverlay').style.display = 'none'; }
function applyColorPicker() {
  const hex = '#' + document.getElementById('hexInput').value.replace('#','');
  setColor(_cpKey, hex); closeColorPicker();
}
function syncPreview(hex) {
  document.getElementById('colorPreview').style.background = '#' + hex;
}
function hexToHSV(hex) {
  const r=parseInt(hex.slice(0,2),16)/255, g=parseInt(hex.slice(2,4),16)/255, b=parseInt(hex.slice(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  _cpV = max;
  _cpS = max ? d/max : 0;
  let h=0;
  if(d){if(max===r)h=(g-b)/d%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;}
  _cpH = Math.round(h*60); if(_cpH<0)_cpH+=360;
  document.getElementById('hueSlider').value = _cpH;
}
function hsvToHex(h,s,v) {
  const f=n=>{const k=(n+h/60)%6;return Math.round((v-v*s*Math.max(0,Math.min(k,4-k,1)))*255);};
  return [f(5),f(3),f(1)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function updateCanvas() {
  const c = document.getElementById('colorCanvas');
  if(!c)return;
  c.style.background=`linear-gradient(to bottom,transparent,#000),linear-gradient(to right,#fff,hsl(${_cpH},100%,50%))`;
  const dot=document.getElementById('cpDot');
  dot.style.left=(_cpS*100)+'%'; dot.style.top=((1-_cpV)*100)+'%';
  document.getElementById('alphaSlider').style.background=
    `linear-gradient(to right,transparent,hsl(${_cpH},100%,50%))`;
}
function onHueChange() {
  _cpH=parseInt(document.getElementById('hueSlider').value);
  updateCanvas(); syncFromHSV();
}
function onAlphaChange() { /* alpha for future use */ }
function syncFromHSV() {
  const hex=hsvToHex(_cpH,_cpS,_cpV);
  document.getElementById('hexInput').value=hex; syncPreview(hex);
}
function onHexInput(v) {
  if(v.length===6){ hexToHSV(v); updateCanvas(); syncPreview(v); }
}
function startCanvasDrag(e) {
  const move = ev => {
    const c=document.getElementById('colorCanvas');
    const r=c.getBoundingClientRect();
    const cx=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left;
    const cy=(ev.touches?ev.touches[0].clientY:ev.clientY)-r.top;
    _cpS=Math.max(0,Math.min(1,cx/r.width));
    _cpV=Math.max(0,Math.min(1,1-cy/r.height));
    updateCanvas(); syncFromHSV();
  };
  move(e);
  const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
                document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);};
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
  document.addEventListener('touchmove',move); document.addEventListener('touchend',up);
}

function setLang(lang) {
  state.settings.lang = lang;
  if (currentUser) { currentUser.lang = lang; }
  saveState(); render();
}
function setFontSize(size) {
  state.settings.fontSize = Math.max(12, Math.min(22, size));
  applySettings(); saveState(); render();
}
function setColor(key, val) {
  state.settings[key] = val;
  applySettings(); saveState(); render();
}

// ════════════════════════════════
// ACCOUNT TAB
// ════════════════════════════════
function renderAccount(main) {
  const u = currentUser || {};
  const avatarHtml = u.avatarDataUrl
    ? `<img src="${u.avatarDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<div class="profile-avatar-letter">${(u.nickname||u.name||'U').charAt(0).toUpperCase()}</div>`;
  const genderMap = { male:'男', female:'女', other:'其他', prefer_not:'不透露', '':'—' };

  main.style.overflow = '';
  main.style.padding = '0';
  main.innerHTML = `
    <div style="padding:10px 20px 0 20px">
      <!-- 頭像區 -->
      <div style="display:flex;flex-direction:column;align-items:center;padding:24px 0 20px">
        <div style="position:relative;margin-bottom:14px">
          <div class="profile-avatar">${avatarHtml}</div>
          <button onclick="triggerProfileAvatarUpload()"
            style="position:absolute;bottom:4px;right:-4px;width:32px;height:32px;border-radius:50%;
                   background:var(--bg);border:2.5px solid var(--primary);color:var(--primary);
                   display:flex;align-items:center;justify-content:center;cursor:pointer;
                   font-size:18px;line-height:1;padding:0">＋</button>
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none"
            onchange="handleProfileAvatarUpload(event)">
        </div>
        <div class="profile-name">${u.name || '—'}</div>
        <div class="profile-nickname">@${u.nickname || '—'}</div>
      </div>

      <!-- 個人資料列表 -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:0 18px">
        ${[
          ['姓名', u.name || '—', 'name'],
          ['暱稱', u.nickname || '—', 'nickname'],
          ['電子郵件', u.email || '—', 'email'],
          ['性別', genderMap[u.gender||''] || '—', 'gender'],
          ['電話', u.phone || '—', 'phone'],
          ['生日', u.birthday || '—', 'birthday'],
          ['密碼', '••••••••', 'password'],
        ].map(([label, val, field], i, arr) => `
          <div class="profile-field" style="${i<arr.length-1?'border-bottom:1px solid var(--border)':''}">
            <div style="flex:1;min-width:0">
              <div class="pf-label">${label}</div>
              <div class="pf-val">${val}</div>
            </div>
            <button class="pf-edit" onclick="editProfileField('${field}')">編輯</button>
          </div>`).join('')}
      </div>

      <!-- 管理成員 -->
      <div style="margin-top:24px">
        <div class="section-label" style="margin-bottom:8px">管理成員</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="font-size:12px;color:var(--text3);margin-bottom:10px">新增後可在建立表單時從名單快速選取</div>
          <div id="managedMemberTags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px"></div>
          <button type="button" onclick="toggleManagedMemberAdd()"
            style="display:flex;align-items:center;gap:6px;background:var(--surface2);
                   border:1px solid var(--border2);color:var(--primary);border-radius:8px;
                   padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;width:100%;
                   font-family:'Inter',sans-serif">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新增成員
          </button>
          <div id="managedMemberAddPanel" style="display:none;margin-top:10px;border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--surface)">
            <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">EMAIL 邀請</div>
            <div class="invite-input-wrap">
              <input id="acctMemberEmail" placeholder="輸入 email 或名稱" style="flex:1">
              <button class="invite-add-btn" onclick="addManagedMember()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
          <div id="managedMemberList" style="display:none"></div>
        </div>
      </div>

      <!-- 登出 -->
      <div style="margin-top:28px">
        <button class="logout-btn" onclick="logout()">登出</button>
        <div style="text-align:center;color:#ccc;font-size:14px;margin-top:16px">V2.1.41</div>
        <div style="height:80px"></div>
      </div>
    </div>`;
  // Render managed member list after DOM is set
  renderManagedMemberList();
}

function toggleManagedMemberAdd() {
  const panel = document.getElementById('managedMemberAddPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function renderManagedMemberList() {
  if (!state.managedMembers) state.managedMembers = [];
  // Render as tags (same style as member tags in modals)
  const tagWrap = document.getElementById('managedMemberTags');
  if (tagWrap) {
    tagWrap.innerHTML = state.managedMembers.map((m, i) =>
      `<span class="member-tag" style="cursor:pointer" onclick="removeManagedMember(${i})">
        ${m}&nbsp;<span style="opacity:.5;font-size:11px">✕</span>
      </span>`
    ).join('');
  }
}

function addManagedMember() {
  const input = document.getElementById('acctMemberEmail'); if (!input) return;
  const name = input.value.trim();
  if (!name) { toast('請輸入名稱或 email', 'error'); return; }
  if (!managedMemberAdd(name)) { toast('已在名單中', 'info'); return; }
  input.value = '';
  renderManagedMemberList();
  toast(`已新增 ${name}`, 'success');
}

function removeManagedMember(i) {
  const email = state.managedMembers?.[i];
  if (!email) return;
  const name = managedMemberRemove(email);
  if (!name) return;
  renderManagedMemberList();
  toast(`已移除 ${name}`, 'success');
}


function triggerProfileAvatarUpload() {
  document.getElementById('profileAvatarInput').click();
}
function handleProfileAvatarUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (currentUser) {
      currentUser.avatarDataUrl = e.target.result;
      saveState(); renderTopbar(); render();
      toast('頭像已更新', 'success');
    }
  };
  reader.readAsDataURL(file);
}
function editProfileField(field) {
  toast(`${field} 編輯功能即將推出`, 'info');
}

// ════════════════════════════════
// BOOK CRUD
// ════════════════════════════════
function openCreateBook() {
  document.getElementById('bookName').value = '';
  document.getElementById('bookDesc').value = '';
  openModal('modalBook');
}
function saveBook() {
  const name = document.getElementById('bookName').value.trim();
  if (!name) { toast('請輸入帳本名稱', 'error'); return; }
  const book = bookCreate(name, document.getElementById('bookDesc').value.trim());
  closeModal('modalBook');
  nav.path = [book.id]; nav.tab = 'home';
  render();
}
function openEditBook(bookId) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  document.getElementById('editBookName').value = book.name;
  document.getElementById('editBookDesc').value = book.desc || '';
  document.getElementById('modalEditBook').dataset.bookId = bookId;
  openModal('modalEditBook', true);
}
function saveEditBook() {
  const bookId = document.getElementById('modalEditBook').dataset.bookId;
  const name = document.getElementById('editBookName').value.trim();
  if (!name) { toast('請輸入帳本名稱', 'error'); return; }
  bookUpdate(bookId, name, document.getElementById('editBookDesc').value.trim());
  closeModal('modalEditBook'); toast('帳本已更新', 'success'); render();
}
function confirmDeleteBook(bookId) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  document.getElementById('confirmTitle').textContent = '確認刪除帳本';
  document.getElementById('confirmMsg').textContent = `確定要刪除帳本「${book.name}」及其所有內容？此操作無法復原。`;
  confirmCb = () => { bookDelete(bookId); toast('帳本已刪除', 'success'); render(); };
  openModal('modalConfirm');
}

// ════════════════════════════════
// NEW ITEM
// ════════════════════════════════
function openNewItem(preselect = 'sheet') {
  preselect = preselect || 'sheet';
  newItemType = preselect;
  document.getElementById('newItemName').value = '';
  document.getElementById('newItemDesc').value = '';
  document.getElementById('newItemInviteEmail').value = '';
  // reset panel to closed
  const panel = document.getElementById('newItemMemberAddPanel');
  if (panel) panel.style.display = 'none';
  const book = currentBook();
  const existingMembers = book?.members?.length ? [...book.members]
    : (currentUser ? [currentUser.nickname || currentUser.name] : []);
  window._newItemMembers = [...existingMembers];
  const curEl = document.getElementById('newItemCurrencyText');
  if (curEl && book) {
    const v = book.currency || 'TWD';
    curEl.textContent = v;
    _newItemCurrency = v;
  }
  selectNewType(preselect);
  openModal('modalNewItem');
}
function removeNewItemMember(i) {
  if (window._newItemMembers) {
    window._newItemMembers.splice(i, 1);
    renderNewItemHistoryMembers();
  }
}
function addInviteMember() {
  const email = document.getElementById('newItemInviteEmail').value.trim();
  if (!email) { toast('請輸入電子郵件', 'error'); return; }
  if (!window._newItemMembers) window._newItemMembers = [];
  if (window._newItemMembers.some(m => m.toLowerCase() === email.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._newItemMembers.push(email);
  // 同步寫入帳號管理成員清單
  syncToManagedMembers(email);
  renderNewItemHistoryMembers();
  document.getElementById('newItemInviteEmail').value = '';
  toast(`已加入 ${email}`, 'success');
}
function toggleNewItemMemberAdd() {
  const panel = document.getElementById('newItemMemberAddPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    renderNewItemHistoryMembers();
    const el = document.getElementById('newItemInviteEmail');
    if (el) {
      el.focus();
      setTimeout(() => {
        const wrap = document.getElementById('newItemHistoryMembers');
        if (wrap) {
          const modal = document.querySelector('.modal-overlay.open .modal');
          if (modal) {
            wrap.scrollIntoView({ block: 'nearest' });
            modal.scrollTop += 100;
          }
        }
      }, 400);
    }
  }
}

function renderNewItemHistoryMembers() {
  const panel = document.getElementById('newItemMemberAddPanel');
  if (!panel) return;
  const history = getGlobalMemberHistory();
  const current = new Set(window._newItemMembers || []);
  const existing = window._newItemMembers || [];
  const available = history.filter(m => !current.has(m));
  const parts = [];
  if (existing.length) {
    parts.push(`<div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">已加入成員</div>`);
    parts.push(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${existing.map((m,i) =>
      `<span class="member-tag" style="background:var(--primary);color:#000;cursor:pointer" onclick="removeNewItemMember(${i})">${m} ✕</span>`
    ).join('')}</div>`);
  }
  if (available.length) {
    parts.push(`<div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">從成員名單增添</div>`);
    parts.push(`<div style="display:flex;flex-wrap:wrap;gap:6px">${available.map(m =>
      `<span class="member-tag" style="cursor:pointer" onclick="addHistoryMember('${m.replace(/'/g,"\\'")}')">${m} ＋</span>`
    ).join('')}</div>`);
  }
  const wrap = document.createElement('div');
  wrap.id = 'newItemHistoryMembers';
  wrap.style.marginTop = '10px';
  if (!parts.length) {
    wrap.innerHTML = '<span style="font-size:13px;color:var(--text3)">無可選成員</span>';
  } else {
    wrap.innerHTML = parts.join('');
  }
  const old = document.getElementById('newItemHistoryMembers');
  if (old) old.remove();
  panel.appendChild(wrap);
}

function addHistoryMember(name) {
  if (!window._newItemMembers) window._newItemMembers = [];
  if (window._newItemMembers.some(m => m.toLowerCase() === name.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._newItemMembers.push(name);
  renderNewItemHistoryMembers();
  toast(`已加入 ${name}`, 'success');
}


function selectNewType(t) {
  newItemType = t;
  document.getElementById('tpFolder').classList.toggle('selected', t === 'folder');
  document.getElementById('tpSheet').classList.toggle('selected', t === 'sheet');
  document.getElementById('newItemLabel').textContent = t === 'folder' ? '資料夾名稱' : '表單名稱';
  // 幣別欄位只在記帳表單時顯示
  const curRow = document.getElementById('newItemCurrencyLabel')?.closest('.form-row');
  if (curRow) curRow.style.display = t === 'sheet' ? '' : 'none';
  // 成員區塊只在記帳表單時顯示
  const memberSection = document.getElementById('newItemMemberSection');
  if (memberSection) memberSection.style.display = t === 'sheet' ? '' : 'none';
  // 收起成員展開面板
  const panel = document.getElementById('newItemMemberAddPanel');
  if (panel) panel.style.display = 'none';
}
function saveNewItem() {
  const name = document.getElementById('newItemName').value.trim();
  if (!name) { toast(`請輸入${newItemType === 'folder' ? '資料夾' : '表單'}名稱`, 'error'); return; }
  const desc = document.getElementById('newItemDesc').value.trim();
  const currency = _newItemCurrency || 'TWD';
  const members = [...(window._newItemMembers || (currentUser ? [currentUser.nickname || currentUser.name] : []))];
  const item = itemCreate(name, desc, currency, members, newItemType);
  if (!item) { toast('發生錯誤', 'error'); return; }
  closeModal('modalNewItem');
  nav.path.push(item.id);
  render();
}

// ════════════════════════════════
// RENAME
// ════════════════════════════════

function openRenameNode(itemId) {
  const item = findItemAnywhere(itemId); if (!item) return;
  if (item.type === 'sheet') { openEditSheet(itemId); return; }
  document.getElementById('renameInput').value = item.name;
  document.getElementById('renameDescInput').value = item.desc || '';
  renameCb = (name, desc) => { item.name = name; item.desc = desc; saveState(); toast('已重新命名', 'success'); render(); };
  openModal('modalRename', true);
}
function toggleEditSheetMemberAdd() {
  const panel = document.getElementById('editSheetMemberAddPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) { renderEditSheetQuickSelect(); const el = document.getElementById('editSheetInviteEmail'); if (el) el.focus(); }
}

function renderEditSheetQuickSelect() {
  const wrap = document.getElementById('editSheetQuickSelectWrap'); if (!wrap) return;
  const history = getGlobalMemberHistory();
  const current = new Set(window._editSheetMembers || []);
  // Only show members not already in the sheet
  const available = history.filter(m => !current.has(m));
  if (!available.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">從成員名單增添</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${available.map(m =>
        `<span class="member-tag" style="cursor:pointer" onclick="addEditSheetMemberQuick('${m.replace(/'/g,"\\'")}')">
          ${m} <span style="opacity:.5;font-size:11px">＋</span>
        </span>`
      ).join('')}
    </div>`;
}

function addEditSheetMemberQuick(name) {
  if (!window._editSheetMembers) window._editSheetMembers = [];
  if (window._editSheetMembers.some(m => m.toLowerCase() === name.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._editSheetMembers.push(name);
  renderEditSheetMemberTags();
  renderEditSheetQuickSelect();
  toast(`已加入 ${name}`, 'success');
}
function openEditSheet(itemId) {
  const item = findItemAnywhere(itemId); if (!item || item.type !== 'sheet') return;
  document.getElementById('editSheetName').value = item.name;
  document.getElementById('editSheetDesc').value = item.desc || '';
  const cur = item.currency || 'TWD';
  document.getElementById('editSheetCurrencyText').textContent = cur;
  _editSheetCurrency = cur;
  document.getElementById('editSheetInviteEmail').value = '';
  const panel = document.getElementById('editSheetMemberAddPanel');
  if (panel) panel.style.display = 'none';
  window._editSheetId = itemId;
  window._editSheetMembers = [...(item.members || [])];
  renderEditSheetMemberTags();
  openModal('modalEditSheet', true);
}
function renderEditSheetMemberTags() {
  const wrap = document.getElementById('editSheetMemberTags'); if (!wrap) return;
  const me = currentUser?.nickname || currentUser?.name;
  wrap.innerHTML = (window._editSheetMembers || []).map((m, i) => {
    const isDeletable = m !== me;
    return `<span class="member-tag" style="cursor:${isDeletable ? 'pointer' : 'default'}" onclick="${isDeletable ? `removeEditSheetMember(${i})` : ''}">
      ${m}${isDeletable ? `&nbsp;<span style="opacity:.5;font-size:11px">✕</span>` : ''}
    </span>`;
  }).join('');
}
function removeEditSheetMember(i) {
  if (window._editSheetMembers) {
    window._editSheetMembers.splice(i, 1);
    renderEditSheetMemberTags();
  }
}
function addEditSheetMember() {
  const email = document.getElementById('editSheetInviteEmail').value.trim();
  if (!email) { toast('請輸入電子郵件', 'error'); return; }
  if (!window._editSheetMembers) window._editSheetMembers = [];
  if (window._editSheetMembers.some(m => m.toLowerCase() === email.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._editSheetMembers.push(email);
  syncToManagedMembers(email);
  renderEditSheetMemberTags();
  renderEditSheetQuickSelect();
  document.getElementById('editSheetInviteEmail').value = '';
  toast(`已加入 ${email}`, 'success');
}
function saveEditSheet() {
  const name = document.getElementById('editSheetName').value.trim();
  if (!name) { toast('請輸入表單名稱', 'error'); return; }
  const item = findItemAnywhere(window._editSheetId); if (!item) return;
  const oldMembers = new Set(item.members || []);
  const newMembers = [...(window._editSheetMembers || [])];
  const now = new Date();
  const localDate = localDateString(now);
  const joinTimes = {};
  newMembers.forEach(m => {
    if (!oldMembers.has(m)) {
      joinTimes[m] = now.toISOString();
    }
  });
  const desc = document.getElementById('editSheetDesc').value.trim();
  const currency = _editSheetCurrency || 'TWD';
  itemUpdate(item, name, desc, currency, newMembers, joinTimes);
  closeModal('modalEditSheet'); toast('表單已更新', 'success'); render();
}
function saveRename() {
  const name = document.getElementById('renameInput').value.trim();
  if (!name) { toast('請輸入名稱', 'error'); return; }
  if (renameCb) { renameCb(name, document.getElementById('renameDescInput').value.trim()); renameCb = null; }
  closeModal('modalRename');
}

// ════════════════════════════════
// CONTEXT MENU
// ════════════════════════════════
function openCtxItem(ev, itemId) {
  ev.stopPropagation();
  if (document.getElementById('ctxMenu').classList.contains('open') && ctxTarget?.scope === 'item' && ctxTarget?.itemId === itemId) {
    closeCtxMenu(); return;
  }
  ctxTarget = { scope: 'item', itemId };
  document.getElementById('ctxEdit').style.display = 'none';
  document.getElementById('ctxRename').style.display = 'flex';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxSep').style.display = 'block';
  // 關閉/開啟按鈕
  const item = findItemAnywhere(itemId);
  const closeBtn = document.getElementById('ctxClose');
  if (closeBtn && item) {
    const label = item.type === 'folder'
      ? (item.closed ? '開啟資料夾' : '關閉資料夾')
      : (item.closed ? '開啟帳本' : '關閉帳本');
    closeBtn.textContent = label;
    closeBtn.style.display = 'flex';
  }
  showCtx(ev);
}
function openCtxEntry(ev, entryId) {
  ev.stopPropagation();
  if (document.getElementById('ctxMenu').classList.contains('open') && ctxTarget?.scope === 'entry' && ctxTarget?.entryId === entryId) {
    closeCtxMenu(); return;
  }
  ctxTarget = { scope: 'entry', entryId };
  document.getElementById('ctxEdit').style.display = 'flex';
  document.getElementById('ctxRename').style.display = 'none';
  document.getElementById('ctxClose').style.display = 'none';
  document.getElementById('ctxSep').style.display = 'block';
  // 查看收據：只有該帳目有收據才顯示
  const entry = findEntryAnywhere(entryId);
  const hasReceipt = entry?.receipts?.length > 0;
  document.getElementById('ctxReceipt').style.display = hasReceipt ? 'flex' : 'none';
  showCtx(ev);
}
function showCtx(ev) {
  if (typeof closeAllEntryDropdowns === 'function') closeAllEntryDropdowns();
  const m = document.getElementById('ctxMenu');
  const mW = 150, mH = 110;
  const src = ev.currentTarget || ev.target;
  let x, y;
  if (src && src.getBoundingClientRect) {
    const r = src.getBoundingClientRect();
    x = r.right - mW;
    y = r.bottom + 6;
    if (y + mH > window.innerHeight - 20) y = r.top - mH - 6;
  } else {
    x = ev.clientX; y = ev.clientY;
  }
  if (x < 12) x = 12;
  if (x + mW > window.innerWidth - 12) x = window.innerWidth - mW - 12;
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  m.style.textAlign = 'center';
  m.classList.add('open');
  if (window._ctxScrollHandler) window.removeEventListener('scroll', window._ctxScrollHandler);
  window._ctxScrollHandler = closeCtxMenu;
  window.addEventListener('scroll', window._ctxScrollHandler, { once: true });
}
function closeCtxMenu() {
  document.getElementById('ctxMenu').classList.remove('open');
  if (window._ctxScrollHandler) {
    window.removeEventListener('scroll', window._ctxScrollHandler);
    window._ctxScrollHandler = null;
  }
}
function ctxAction(action) {
  closeCtxMenu();
  if (!ctxTarget) return;
  if (ctxTarget.scope === 'book') {
    if (action === 'edit') openEditBook(ctxTarget.bookId);
    if (action === 'delete') confirmDeleteBook(ctxTarget.bookId);
  } else if (ctxTarget.scope === 'item') {
    if (action === 'edit') openRenameNode(ctxTarget.itemId);
    if (action === 'rename') openRenameNode(ctxTarget.itemId);
    if (action === 'delete') confirmDeleteItem(ctxTarget.itemId);
    if (action === 'close') toggleCloseItem(ctxTarget.itemId);
  } else if (ctxTarget.scope === 'entry') {
    if (action === 'edit') editEntry(ctxTarget.entryId);
    if (action === 'receipt') viewReceipt(ctxTarget.entryId);
    if (action === 'delete') confirmDeleteEntry(ctxTarget.entryId);
  }
}
function viewReceipt(entryId) {
  const entry = findEntryAnywhere(entryId);
  if (!entry?.receipts?.length) return;
  const receipts = entry.receipts;
  const total = receipts.length;
  let current = 0;
  let scale = 1, translateX = 0, translateY = 0;
  let isDragging = false, lastX = 0, lastY = 0;
  let touchStartX = 0, touchStartY = 0, touchStartDist = 0, touchStartScale = 1;
  let isSwiping = false, isPinching = false;
  let isAnimating = false;

  const existing = document.getElementById('receiptViewer');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'receiptViewer';
  el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;user-select:none;touch-action:none;';
  const dotsHtml = receipts.map((_, i) =>
    `<div style="width:6px;height:6px;border-radius:50%;background:${i===0?'#fff':'#555'};transition:background .2s"></div>`
  ).join('');
  el.innerHTML = `
    <div style="position:relative;flex:1;overflow:hidden" id="rvImgWrap">
      <div id="rvSlideTrack" style="height:100%;display:flex;align-items:center;transition:none;width:200%">
        <div style="width:50%;display:flex;justify-content:center;align-items:center;height:100%;flex-shrink:0" id="rvSlide0">
          <img id="rvImg" src="${receipts[0]}" style="max-width:100%;max-height:100%;object-fit:contain;transform-origin:center;cursor:grab;display:block">
        </div>
        <div style="width:50%;display:flex;justify-content:center;align-items:center;height:100%;flex-shrink:0" id="rvSlide1">
          <img id="rvImgAdj" style="max-width:100%;max-height:100%;object-fit:contain;display:block">
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 20px 12px;background:rgba(0,0,0,.6);flex-shrink:0">
      <span id="rvCounter" style="color:#fff;font-size:14px;font-weight:600">1 / ${total}</span>
      <div id="rvDots" style="display:flex;gap:5px;margin-top:6px">${dotsHtml}</div>
    </div>
    <button onclick="document.getElementById('receiptViewer').remove()"
      style="position:absolute;top:16px;right:16px;background:none;border:none;color:#fff;width:44px;height:44px;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1">✕</button>`;
  document.body.appendChild(el);

  const img = document.getElementById('rvImg');
  const imgAdj = document.getElementById('rvImgAdj');
  const track = document.getElementById('rvSlideTrack');

  function preloadAdj(dir) {
    const idx = (current + dir + total) % total;
    imgAdj.src = receipts[idx];
  }

  function updateDots() {
    const dots = document.getElementById('rvDots').children;
    for (let i = 0; i < dots.length; i++) dots[i].style.background = i === current ? '#fff' : '#555';
  }

  function swapTo(newIdx, animDir) {
    current = newIdx;
    document.getElementById('rvImg').src = receipts[current];
    document.getElementById('rvCounter').textContent = `${current + 1} / ${total}`;
    imgAdj.src = receipts[(current + 1) % total];
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    updateDots();
  }

  function goTo(dir) {
    if (isAnimating) return;
    const to = (current + dir + total) % total;
    if (to === current) return;
    isAnimating = true;

    if (dir === 1) {
      preloadAdj(1);
      track.style.transition = 'none';
      track.style.transform = 'translateX(0)';
      void track.offsetHeight;
      track.style.transition = 'transform .25s cubic-bezier(.22,1,.36,1)';
      track.style.transform = 'translateX(-50%)';
    } else {
      imgAdj.src = receipts[current];
      track.style.transition = 'none';
      track.style.transform = 'translateX(-50%)';
      void track.offsetHeight;
      document.getElementById('rvImg').src = receipts[to];
      track.style.transition = 'transform .25s cubic-bezier(.22,1,.36,1)';
      track.style.transform = 'translateX(0)';
    }

    const onEnd = () => {
      track.removeEventListener('transitionend', onEnd);
      swapTo(to, dir);
      resetTransform();
      isAnimating = false;
    };
    track.addEventListener('transitionend', onEnd);
  }

  window.rvGo = goTo;

  function applyTransform(transition = false) {
    img.style.transition = transition ? 'transform .15s ease' : 'none';
    img.style.transform = `scale(${scale}) translate(${translateX/scale}px, ${translateY/scale}px)`;
  }
  function resetTransform() { scale = 1; translateX = 0; translateY = 0; applyTransform(true); }

  el.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.min(5, Math.max(0.5, scale * factor));
    applyTransform();
  }, { passive: false });

  img.addEventListener('mousedown', e => {
    if (scale <= 1) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    img.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    translateX += e.clientX - lastX; translateY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  });
  document.addEventListener('mouseup', () => { isDragging = false; img.style.cursor = 'grab'; });

  el.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      isPinching = true; isSwiping = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.hypot(dx, dy);
      touchStartScale = scale;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isPinching = false; isSwiping = false;
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2 && isPinching) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      scale = Math.min(5, Math.max(0.5, touchStartScale * (dist / touchStartDist)));
      applyTransform();
    } else if (e.touches.length === 1 && !isPinching) {
      if (scale > 1) {
        translateX += e.touches[0].clientX - touchStartX;
        translateY += e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        applyTransform();
      } else if (!isAnimating) {
        const dx = e.touches[0].clientX - touchStartX;
        if (Math.abs(dx) > 5) {
          isSwiping = true;
          resetTransform();
          track.style.transition = 'none';
          if (dx < 0) {
            preloadAdj(1);
            track.style.transform = `translateX(${Math.max(dx, -window.innerWidth + 1)}px)`;
          } else {
            const prevIdx = (current - 1 + total) % total;
            document.getElementById('rvImg').src = receipts[prevIdx];
            imgAdj.src = receipts[current];
            const dragPct = (dx / window.innerWidth) * 50;
            track.style.transform = `translateX(${-50 + dragPct}%)`;
          }
        }
      }
    }
  }, { passive: false });

  el.addEventListener('touchend', e => {
    if (isSwiping && e.changedTouches.length === 1 && !isAnimating) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        goTo(dx < 0 ? 1 : -1);
      } else {
        if (dx > 0) {
          track.style.transition = 'transform .2s cubic-bezier(.22,1,.36,1)';
          track.style.transform = 'translateX(-50%)';
          const onRestore = () => {
            track.removeEventListener('transitionend', onRestore);
            document.getElementById('rvImg').src = receipts[current];
            imgAdj.src = receipts[(current + 1) % total];
            track.style.transition = 'none';
            track.style.transform = 'translateX(0)';
          };
          track.addEventListener('transitionend', onRestore);
        } else {
          track.style.transition = 'transform .2s cubic-bezier(.22,1,.36,1)';
          track.style.transform = 'translateX(0)';
        }
      }
    }
    isSwiping = false; isPinching = false;
  }, { passive: true });

  function rvKeyHandler(e) {
    if (e.key === 'ArrowLeft') goTo(-1);
    if (e.key === 'ArrowRight') goTo(1);
    if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', rvKeyHandler); }
  }
  document.addEventListener('keydown', rvKeyHandler);
  el.addEventListener('remove', () => document.removeEventListener('keydown', rvKeyHandler));
}
document.addEventListener('click', () => closeCtxMenu());

function confirmDeleteItem(itemId) {
  const item = findItemAnywhere(itemId); if (!item) return;
  const label = item.type === 'folder' ? `資料夾「${item.name}」及其所有子項目` : `記帳表單「${item.name}」及其所有帳目`;
  document.getElementById('confirmTitle').textContent = '確認刪除';
  document.getElementById('confirmMsg').textContent = `確定要刪除${label}？此操作無法復原。`;
  confirmCb = () => { itemDelete(itemId); toast('已刪除', 'success'); render(); };
  openModal('modalConfirm');
}

// ════════════════════════════════
// ENTRY CRUD
// ════════════════════════════════
function openAddEntry(noFocus) {
  const book = currentBook();
  document.getElementById('entryPayMethodPanel').style.display = 'none';
  document.getElementById('entryItem').value = '';
  document.getElementById('entryDate').value = today();
  document.getElementById('entryAmount').value = '';
  document.getElementById('entryNote').value = '';
  _entryType = 'shared';
  _entryPayer = '';
  _entryDebtor = '';
  document.getElementById('entryTypeText').textContent = '共用';
  document.getElementById('entryPayerText').textContent = '選擇成員';
  document.getElementById('entryDebtorText').textContent = '請選擇欠款人';
  document.getElementById('modalEntryTitle').textContent = '新增帳目';
  document.getElementById('modalEntry').dataset.editId = '';
  document.getElementById('receiptThumbs').innerHTML = '';
  window._entryReceipts = [];
  const sheet = currentNode();
  const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
    : book?.members?.length ? book.members
    : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
  if (members.length) _entryPayer = members[0];
  document.getElementById('entryPayerText').textContent = _entryPayer || '選擇成員';
  onEntryTypeChange();
  _selectedPayMethod = (currentBook()?.payMethods?.[0]) || '現金';
  renderPayMethodTags();
  openModal('modalEntry', noFocus);
}
function onEntryTypeChange() {
  const sel = document.getElementById('entryDebtorSelector');
  const row = document.getElementById('debtorRow');
  if (_entryType === 'advance') {
    sel.style.pointerEvents = 'auto';
    sel.style.opacity = '1';
  } else {
    sel.style.pointerEvents = 'none';
    sel.style.opacity = '.45';
    _entryDebtor = '';
    document.getElementById('entryDebtorText').textContent = '請選擇欠款人';
  }
}
// ── 幣別 ──
let _newItemCurrency = 'TWD';
let _editSheetCurrency = 'TWD';

function toggleNewItemCurrency() {
  const d = document.getElementById('newItemCurrencyDropdown');
  const open = d.style.display === 'block';
  closeAllEntryDropdowns();
  if (!open) d.style.display = 'block';
}
function setNewItemCurrency(val) {
  _newItemCurrency = val;
  document.getElementById('newItemCurrencyText').textContent = val;
  document.querySelectorAll('#newItemCurrencyDropdown .select-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === val);
  });
  document.getElementById('newItemCurrencyDropdown').style.display = 'none';
}
function toggleEditSheetCurrency() {
  const d = document.getElementById('editSheetCurrencyDropdown');
  const open = d.style.display === 'block';
  closeAllEntryDropdowns();
  if (!open) d.style.display = 'block';
}
function setEditSheetCurrency(val) {
  _editSheetCurrency = val;
  document.getElementById('editSheetCurrencyText').textContent = val;
  document.querySelectorAll('#editSheetCurrencyDropdown .select-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === val);
  });
  document.getElementById('editSheetCurrencyDropdown').style.display = 'none';
}

// 目前選中的付款／款項類別／付款人／欠款人
let _selectedPayMethod = '現金';
let _entryType = 'shared';
let _entryPayer = '';
let _entryDebtor = '';

// ── 款項類別 ──
function toggleEntryType() {
  const d = document.getElementById('entryTypeDropdown');
  const open = d.style.display === 'block';
  closeAllEntryDropdowns();
  if (!open) { d.style.display = 'block'; }
}
function setEntryType(val) {
  _entryType = val;
  document.getElementById('entryTypeText').textContent = val === 'shared' ? '共用' : val === 'advance' ? '代墊' : '自用';
  document.querySelectorAll('#entryTypeDropdown .select-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === val);
  });
  document.getElementById('entryTypeDropdown').style.display = 'none';
  onEntryTypeChange();
}
// ── 付款人 ──
function toggleEntryPayer() {
  const d = document.getElementById('entryPayerDropdown');
  const open = d.style.display === 'block';
  closeAllEntryDropdowns();
  if (!open) {
    const book = currentBook();
    const sheet = currentNode();
    const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
      : book?.members?.length ? book.members
      : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
    d.innerHTML = members.map(m => {
      const sel = m === _entryPayer;
      return `<div class="select-option${sel?' selected':''}" onclick="setEntryPayer('${m}')">${m}</div>`;
    }).join('');
    d.style.display = 'block';
  }
}
function setEntryPayer(name) {
  _entryPayer = name;
  document.getElementById('entryPayerText').textContent = name;
  document.getElementById('entryPayerDropdown').style.display = 'none';
}
// ── 欠款人 ──
function toggleEntryDebtor() {
  const d = document.getElementById('entryDebtorDropdown');
  const open = d.style.display === 'block';
  closeAllEntryDropdowns();
  if (!open) {
    const book = currentBook();
    const sheet = currentNode();
    const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
      : book?.members?.length ? book.members
      : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
    d.innerHTML = '<div class="select-option" onclick="setEntryDebtor(\'\')">不限</div>' +
      members.map(m => {
        const sel = m === _entryDebtor;
        return `<div class="select-option${sel?' selected':''}" onclick="setEntryDebtor('${m}')">${m}</div>`;
      }).join('');
    d.style.display = 'block';
  }
}
function setEntryDebtor(name) {
  _entryDebtor = name;
  document.getElementById('entryDebtorText').textContent = name || '請選擇欠款人';
  document.getElementById('entryDebtorDropdown').style.display = 'none';
}
function closeAllEntryDropdowns() {
  ['entryTypeDropdown','entryPayerDropdown','entryDebtorDropdown','newItemCurrencyDropdown','editSheetCurrencyDropdown'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('[id^="ss_dd_"]').forEach(el => el.style.display = 'none');
}

function renderPayMethodTags() {
  const book = currentBook(); if (!book) return;
  const wrap = document.getElementById('payMethodTags'); if (!wrap) return;
  if (!book.payMethods) book.payMethods = ['現金'];
  if (!_selectedPayMethod || !book.payMethods.includes(_selectedPayMethod)) {
    _selectedPayMethod = book.payMethods[0];
  }
  wrap.innerHTML = book.payMethods.map((m, i) => {
    const isSelected = m === _selectedPayMethod;
    const isDeletable = m !== '現金';
    return `<span class="member-tag" style="cursor:pointer;${isSelected ? 'background:var(--primary);color:#000;' : ''}"
      onclick="selectPayMethod('${m}')"
    >${m}${isDeletable ? `&nbsp;<span onclick="event.stopPropagation();removePayMethod(${i})" style="opacity:.5;font-size:11px">✕</span>` : ''}</span>`;
  }).join('');
}
function selectPayMethod(method) {
  _selectedPayMethod = method;
  renderPayMethodTags();
}
function removePayMethod(i) {
  const book = currentBook(); if (!book) return;
  const removed = payMethodRemove(book, i);
  if (!removed) return;
  if (_selectedPayMethod === removed) _selectedPayMethod = book.payMethods[0];
  renderPayMethodTags();
  toast(`已移除「${removed}」`, 'success');
}
function toggleEntryPayMethod() {
  const panel = document.getElementById('entryPayMethodPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    const el = document.getElementById('payMethodInput');
    if (el) el.focus();
  }
}
function addPayMethod() {
  const input = document.getElementById('payMethodInput');
  const name = input ? input.value.trim() : '';
  if (!name) { toast('請輸入付款方式名稱', 'error'); return; }
  const book = currentBook(); if (!book) return;
  if (!payMethodAdd(book, name)) { toast('已存在此付款方式', 'info'); return; }
  _selectedPayMethod = name;
  renderPayMethodTags();
  document.getElementById('payMethodInput').value = '';
  document.getElementById('payMethodInput').focus();
  toast(`已新增「${name}」`, 'success');
}
function triggerReceiptUpload() {
  document.getElementById('receiptInput').click();
}
function handleReceiptUpload(event) {
  const files = Array.from(event.target.files); if (!files.length) return;
  if (!window._entryReceipts) window._entryReceipts = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      window._entryReceipts.push(e.target.result);
      renderReceiptThumbs();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}
function renderReceiptThumbs() {
  const wrap = document.getElementById('receiptThumbs'); if (!wrap) return;
  wrap.innerHTML = (window._entryReceipts || []).map((src, i) =>
    `<div class="receipt-thumb" style="position:relative">
      <img src="${src}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border2)">
      <button onclick="removeReceipt(${i})"
        style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;
               background:var(--red);border:none;color:#fff;font-size:11px;cursor:pointer;
               display:flex;align-items:center;justify-content:center;padding:0">✕</button>
    </div>`
  ).join('');
}
function removeReceipt(i) {
  if (window._entryReceipts) { window._entryReceipts.splice(i, 1); renderReceiptThumbs(); }
}
// sheet ⋮ 選單
function openCtxSheet(ev, sheetId) {
  ev.stopPropagation();
  if (document.getElementById('ctxMenu').classList.contains('open') && ctxTarget?.scope === 'item' && ctxTarget?.itemId === sheetId) {
    closeCtxMenu(); return;
  }
  ctxTarget = { scope: 'item', itemId: sheetId };
  document.getElementById('ctxEdit').style.display = 'flex';
  document.getElementById('ctxEdit').textContent = '編輯';
  document.getElementById('ctxRename').style.display = 'none';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxSep').style.display = 'block';
  const closeBtn2 = document.getElementById('ctxClose');
  const sheetItem = findItemAnywhere(sheetId);
  if (closeBtn2 && sheetItem) {
    closeBtn2.textContent = sheetItem.closed ? '開啟帳本' : '關閉帳本';
    closeBtn2.style.display = 'flex';
  }
  showCtx(ev);
}
function openManageMembers() {
  const book = currentBook(); if (!book) return;
  renderBookMemberList();
  openModal('modalMembers');
}
function renderBookMemberList() {
  const book = currentBook(); if (!book) return;
  const wrap = document.getElementById('bookMemberList'); if (!wrap) return;
  const me = currentUser?.nickname || currentUser?.name;
  wrap.innerHTML = book.members.map((m, i) =>
    `<div style="display:flex;align-items:center;justify-content:space-between;
                 padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="settle-avatar">${m.charAt(0).toUpperCase()}</div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">${m}${m === me ? '<span style="font-size:11px;color:var(--text3);margin-left:6px">（我）</span>' : ''}</div>
      </div>
      ${m !== me ? `<button onclick="removeBookMember(${i})"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:4px 8px;border-radius:6px">移除</button>` : ''}
    </div>`
  ).join('');
}
function addBookMember() {
  const email = document.getElementById('memberInviteEmail').value.trim();
  if (!email) { toast('請輸入電子郵件', 'error'); return; }
  const book = currentBook(); if (!book) return;
  if (!bookMemberAdd(book, email)) { toast('此成員已在帳本中', 'info'); return; }
  document.getElementById('memberInviteEmail').value = '';
  renderBookMemberList();
  toast(`已新增 ${email}`, 'success');
}
function removeBookMember(i) {
  const book = currentBook(); if (!book) return;
  const me = currentUser?.nickname || currentUser?.name;
  if (!bookMemberRemove(book, i, me)) { toast('無法移除自己', 'error'); return; }
  renderBookMemberList();
  toast(`已移除成員`, 'success');
}
function saveEntry() {
  const item = document.getElementById('entryItem').value.trim();
  if (!item) { toast('請輸入支出項目', 'error'); return; }
  const amount = parseFloat(document.getElementById('entryAmount').value);
  if (!amount || amount <= 0) { toast('請輸入有效金額', 'error'); return; }
  const date = document.getElementById('entryDate').value;
  if (!date) { toast('請選擇日期', 'error'); return; }
  if (_entryType === 'advance' && !_entryDebtor) { toast('請選擇欠款人', 'error'); return; }
  const sheet = getSheet(); if (!sheet) return;
  const editId = document.getElementById('modalEntry').dataset.editId;
  const entry = {
    item, date, amount,
    type: _entryType,
    payMethod: _selectedPayMethod || '現金',
    payer: _entryPayer,
    debtor: _entryDebtor || '',
    note: document.getElementById('entryNote').value.trim(),
    receipts: window._entryReceipts || [],
    createdBy: currentUser?.nickname || '—',
    createdAt: new Date().toISOString()
  };
  entrySave(sheet, entry, editId);
  const action = editId ? '更新' : '新增';
  closeModal('modalEntry'); toast(`帳目已${action}`, 'success'); render();
}
function editEntry(entryId) {
  const sheet = getSheet(); if (!sheet) return;
  const e = sheet.entries.find(x => x.id === entryId); if (!e) return;
  openAddEntry(true);
  document.getElementById('entryItem').value = e.item;
  document.getElementById('entryDate').value = e.date;
  document.getElementById('entryAmount').value = e.amount;
  _entryType = e.type;
  document.getElementById('entryTypeText').textContent = e.type === 'shared' ? '共用' : e.type === 'advance' ? '代墊' : '自用';
  _selectedPayMethod = e.payMethod || '現金';
  _entryPayer = e.payer || '';
  document.getElementById('entryPayerText').textContent = e.payer || '選擇成員';
  _entryDebtor = e.debtor || '';
  document.getElementById('entryDebtorText').textContent = e.debtor || '請選擇欠款人';
  document.getElementById('entryNote').value = e.note || '';
  window._entryReceipts = e.receipts ? [...e.receipts] : [];
  renderReceiptThumbs();
  onEntryTypeChange();
  document.getElementById('modalEntryTitle').textContent = '編輯帳目';
  document.getElementById('modalEntry').dataset.editId = entryId;
}
function confirmDeleteEntry(entryId) {
  const sheet = getSheet(); if (!sheet) return;
  const e = sheet.entries.find(x => x.id === entryId); if (!e) return;
  document.getElementById('confirmTitle').textContent = '確認刪除帳目';
  document.getElementById('confirmMsg').textContent = `確定要刪除「${e.item}」（${fmt(e.amount, e.currency)}）？此操作無法復原。`;
  confirmCb = () => { entryDelete(sheet, entryId); toast('帳目已刪除', 'success'); render(); };
  openModal('modalConfirm');
}
// ════════════════════════════════
// INVITE
// ════════════════════════════════
function openInvite(bookId) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${bookId}`;
  document.getElementById('inviteLink').textContent = link;
  document.getElementById('inviteMembers').innerHTML = book.members.map(m =>
    `<div class="member-avatar"><div class="member-avatar-dot">${m.charAt(0).toUpperCase()}</div>${m}</div>`
  ).join('') || '<span style="font-size:13px;color:var(--text3)">尚無其他成員</span>';
  openModal('modalInvite');
}
function copyInviteLink() {
  navigator.clipboard.writeText(document.getElementById('inviteLink').textContent)
    .then(() => toast('連結已複製', 'success')).catch(() => toast('請手動複製連結', 'error'));
}

// ════════════════════════════════
// INIT
// ════════════════════════════════
async function init() {
  const unsub = auth.onAuthStateChanged(async user => {
    unsub();
    if (user) {
      setCurrentUserFromFirebase(user);
      await loadState();
      enterApp();
    } else {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      showPage('login');
    }
  });

  initSwipeBack();
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'payMethodInput') {
      e.preventDefault();
      addPayMethod();
      return;
    }
    if (e.target.id === 'entryAmount' || e.target.id === 'entryItem') return;
    const entryModal = document.querySelector('#modalEntry.open');
    if (entryModal && entryModal.contains(e.target)) {
      e.preventDefault();
      saveEntry();
    }
  });
}
init();
