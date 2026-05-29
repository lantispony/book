// ════════════════════════════════
// 統一頭像函數
// ════════════════════════════════
function getAvatarHtml(user, size=40, extraStyle='') {
  const photo = user?.avatarDataUrl || user?.photoURL || '';
  const label = (user?.nickname || user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const sz = 'width:' + size + 'px;height:' + size + 'px';
  const fs = 'font-size:' + Math.round(size * 0.4) + 'px';
  if (photo) {
    return '<img src="' + photo + '" style="' + sz + ';border-radius:50%;object-fit:cover;' + extraStyle + '">';
  }
  return '<div style="' + sz + ';border-radius:50%;background:var(--primary);color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;' + fs + ';' + extraStyle + '">' + label + '</div>';
}

function getBookMemberAvatarHtml(book, memberName, size=32) {
  // 從 memberInfo 找到對應成員的頭像
  const info = book?.memberInfo ? Object.values(book.memberInfo).find(m =>
    m.name === memberName || m.nickname === memberName || m.email === memberName
  ) : null;
  return getAvatarHtml(info || { name: memberName }, size);
}

console.log('DESKTOP.JS LOADED');
/* ═══════════════════════════════════════════════
   共用帳本 — desktop.js  (PC 版 UI)
   依賴 core.js 的 state / CRUD / nav helpers
═══════════════════════════════════════════════ */

// ════════════════════════════════
// AUTH — 登入 / 建立帳號
// ════════════════════════════════
function showPage(page) {
  document.getElementById('pageLogin').style.display    = page === 'login'    ? 'flex' : 'none';
  document.getElementById('pageRegister').style.display = page === 'register' ? 'flex' : 'none';
}

function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function handleAvatarUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    document.getElementById('avatarImg').src         = url;
    document.getElementById('avatarImg').style.display        = 'block';
    document.getElementById('avatarPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function triggerAvatarUpload() {
  document.getElementById('avatarInput').click();
}

async function loginWithEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
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
    console.log('[Auth] Google login uid:', result.user.uid);
    const migrated = migrateLocalStorage();
    if (migrated) {
      console.log('[Auth] migrated from localStorage v3');
      await saveState();
    } else {
      console.log('[Auth] loading from Firestore / backup...');
      await loadState();
      console.log('[Auth] books loaded:', state.books.length);
    }
    enterApp();
  } catch (e) {
    console.error('[Auth] Google login error:', e);
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
  const name     = document.getElementById('regName').value.trim();
  const nickname = document.getElementById('regNickname').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pwd      = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;

  if (!name || !nickname || !email) { toast('請填寫必填欄位（姓名、暱稱、Email）', 'error'); return; }
  if (!pwd || pwd.length < 8)       { toast('密碼至少需要 8 個字元', 'error'); return; }
  if (pwd !== confirm)              { toast('兩次密碼輸入不一致', 'error'); return; }

  const avatarImg = document.getElementById('avatarImg');
  const avatarUrl = avatarImg.style.display !== 'none' ? avatarImg.src : '';

  currentUser = {
    id: uid(), name, nickname, email,
    gender:       document.getElementById('regGender').value,
    phone:        document.getElementById('regPhone').value.trim(),
    birthday:     document.getElementById('regBirthday').value,
    avatarDataUrl: avatarUrl,
    lang:         'zh-TW',
    createdAt:    new Date().toISOString()
  };
  await saveUser();
  enterApp();
  toast(`歡迎，${nickname}！帳號已建立`, 'success');
}

function logout() {
  if (typeof stopRealtimeSync === 'function') stopRealtimeSync();
  auth.signOut().then(() => {
    currentUser = null;
    state.books = [];
    state.ownedBooks = [];
    state.joinedBooks = [];
    state.managedMembers = [];
    nav.tab = 'home';
    nav.path = [];
    document.getElementById('app').style.display        = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    showPage('login');
  });
}

function switchToTab(tab) {
  nav.tab = tab;
  if (tab === 'home') nav.path = [];
  render();
}

function topbarAddAction() {
  if (nav.tab !== 'home') return;
  if (!nav.path.length)  { openCreateBook(); return; }
  const node = currentNode();
  if (!node || node.type === 'folder') openNewItem(null);
  else openAddEntry();
}

// ════════════════════════════════
// BOOK MENU (⋮ 按鈕 → 置中彈窗)
// ════════════════════════════════
function openBookMenu(ev, bookId) {
  ev.stopPropagation();
  ctxTarget = { scope: 'book', bookId };
  document.getElementById('ctxEdit').style.display    = 'flex';
  document.getElementById('ctxEdit').textContent      = '編輯';
  document.getElementById('ctxInvite').style.display  = 'none'; // 邀請已停用
  document.getElementById('ctxRename').style.display  = 'none';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxClose').style.display   = 'none';
  document.getElementById('ctxSep').style.display     = 'block';

  // 取得按鈕位置，彈窗固定在按鈕下方、畫面右側
  const btn  = ev.currentTarget || ev.target;
  const rect = btn.getBoundingClientRect();
  const menu = document.getElementById('ctxMenu');

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
  menu.style.top  = y + 'px';
  menu.classList.add('open');
}

// ════════════════════════════════
// SHEET VIEW
// ════════════════════════════════
function renderSheetView(main) {
  const book  = currentBook(); if (!book) return goHome();
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;

  const totalS = sheet.entries.filter(e => e.type === 'shared').reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  const totalA = sheet.entries.filter(e => e.type === 'advance').reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  const total  = totalS + totalA;

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

  // 判斷某成員是否應該分攤某筆帳目
  // 規則：若成員加入日期 < 帳目 date → 分攤
  //       若成員加入日期 = 帳目 date → 只分攤當天「成員加入後」建立的帳目（用 entry.createdAt 比對）
  //       若成員加入日期 > 帳目 date → 不分攤
  const rawJoinISO = sheet.memberJoinTimes || {}; // 原始 ISO 用於同天精確比對
  function shouldShare(member, entry) {
    const jDate = joinTimes[member];
    const eDate = entry.date; // YYYY-MM-DD
    if (jDate < eDate) return true;
    if (jDate > eDate) return false;
    // 同天：用精確時間判斷
    const rawJ = rawJoinISO[member];
    if (!rawJ || rawJ.length <= 10) return true; // 舊資料無時間，保守視為當天開始加入→分攤
    const joinTs  = new Date(rawJ).getTime();
    const entryTs = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
    return entryTs >= joinTs; // 帳目在成員加入後建立才分攤
  }

  // 共用支出：每筆帳目依當時應分攤的成員平均
  const sharedEntries = sheet.entries.filter(e => e.type === 'shared');
  sharedEntries.forEach(e => {
    const activeMembers = members.filter(m => shouldShare(m, e));
    const share = activeMembers.length ? (parseFloat(e.amount)||0) / activeMembers.length : 0;
    activeMembers.forEach(m => { memberStats[m].shouldPay += share; });
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });

  // 代墊：payer 代墊給 debtor，等同 payer 借錢給 debtor
  // advance 對 payer 是「應收」，對 debtor 是「應付」
  sheet.entries.filter(e => e.type === 'advance').forEach(e => {
    const amt = parseFloat(e.amount)||0;
    // payer 借出去這筆錢，應收回 → +amt
    if (memberStats[e.payer])  memberStats[e.payer].advanceOut += amt;
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
  const getPair = (creditor, debtor) => {
    const k1 = `${creditor}→${debtor}`;
    const k2 = `${debtor}→${creditor}`;
    if (!(k1 in pairBalances) && !(k2 in pairBalances)) pairBalances[k1] = 0;
    return k1 in pairBalances ? k1 : k2;
  };

  // 共用帳目
  sheet.entries.filter(e => e.type === 'shared').forEach(e => {
    const activeMembers = members.filter(m => shouldShare(m, e));
    if (!activeMembers.length) return;
    const share = (parseFloat(e.amount)||0) / activeMembers.length;
    activeMembers.forEach(debtor => {
      if (debtor === e.payer) return;
      const k = getPair(e.payer, debtor);
      if (k.startsWith(e.payer + '→')) pairBalances[k] += share;
      else pairBalances[k] -= share;
    });
  });

  // 代墊帳目：payer 直接借給 debtor
  sheet.entries.filter(e => e.type === 'advance' && e.debtor && e.debtor !== e.payer).forEach(e => {
    const amt = parseFloat(e.amount)||0;
    const k = getPair(e.payer, e.debtor);
    if (k.startsWith(e.payer)) pairBalances[k] += amt;
    else pairBalances[k] -= amt;
  });

  // 轉換成 transfers 陣列，正數表示 from 欠 to
  const transfers = [];
  Object.entries(pairBalances).forEach(([key, val]) => {
    const [creditor, debtor] = key.split('→');
    if (val > 0.01)       transfers.push({ from: debtor,   to: creditor, amount: Math.round(val) });
    else if (val < -0.01) transfers.push({ from: creditor, to: debtor,   amount: Math.round(-val) });
  });

  // Store for settle status modal
  window._currentTransfers = transfers;
  window._currentMembers   = members;

  // 建立每人的收付明細
  const memberTransfers = {};
  members.forEach(m => memberTransfers[m] = { receive: [], pay: [] });
  transfers.forEach(t => {
    memberTransfers[t.to].receive.push({ from: t.from, amount: t.amount, key: `${t.from}→${t.to}` });
    memberTransfers[t.from].pay.push({ to: t.to, amount: t.amount, key: `${t.from}→${t.to}` });
  });

  if (!sheet.settleStatus) sheet.settleStatus = {};

  const settlementHtml = members.map(m => {
    const st      = memberStats[m] || { paid:0, advanceOut:0, advanceIn:0, shouldPay:0 };
    const mt      = memberTransfers[m];
    const avatar  = `<div class="settle-avatar">${m.charAt(0).toUpperCase()}</div>`;
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
    <div class="tx-list" id="txList"></div>`;

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
    const photo = getMemberPhoto(book, m);
    mEl.insertAdjacentHTML('beforeend', photo
      ? `<div class="member-avatar"><img src="${photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover"></div>`
      : `<div class="member-avatar"><div class="member-avatar-dot">${m.charAt(0).toUpperCase()}</div></div>`);
  });
  renderTxList(sheet, book);
}

function renderTxList(sheet, book) {
  const list = document.getElementById('txList'); if (!list) return;
  const isClosed = sheet.closed;
  if (!sheet.entries.length) {
    list.innerHTML = `
      <div class="pc-empty-hint">
        <div class="pc-empty-hint-title">尚無帳目</div>
        <div class="pc-empty-hint-sub">點擊下方新增帳目開始記錄</div>
      </div>
      ${isClosed ? '' : '<div style="margin-top:12px"><button class="add-tx-btn" onclick="openAddEntry()" style="width:100%">＋ 新增帳目</button></div>'}`;
    return;
  }
  const getIcon = item => {
    const k = item.toLowerCase();
    if (/餐|食|飯|吃|料理|咖啡/.test(k))          return '🍽️';
    if (/車|計程|捷運|交通|油|高鐵|火車|機票/.test(k)) return '🚗';
    if (/住|旅館|飯店|民宿/.test(k))              return '🏨';
    if (/購|買|商|超市|便利|衣/.test(k))           return '🛍️';
    if (/票|門|活動|娛樂|電影/.test(k))            return '🎟️';
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
    const debtorStr = (e.type === 'advance' && e.debtor)
      ? `<span class="tx-debtor">(${e.debtor})</span>` : '';
    const seq = `#${String(i + 1).padStart(3, '0')}`;
    return `<div class="tx-item">
      <div class="tx-left-group">
        <span class="tx-seq">${seq}</span>
        <span class="tx-name">${e.item}</span>
      </div>
      <div class="tx-center-group">
        <span class="tx-tag-group">${tTag}${pTag}</span>
        ${debtorStr}
        <span class="tx-payer">${e.payer || ''}</span>
        <span class="tx-amount ${e.type}">${fmt(e.amount, e.currency)}</span>
      </div>
      <div class="tx-right-group">
        <span class="tx-date">${e.date}</span>
        <button class="tx-more" onclick="openCtxEntry(event,'${e.id}')">⋮</button>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════
// B. 個別結清 Modal
// ════════════════════════════════
function openSettleStatus(memberName) {
  const sheet = currentNode(); if (!sheet || sheet.type !== 'sheet') return;
  const book  = currentBook(); if (!book) return;
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
      // The "other" person from the clicked member's perspective
      const otherName = t.from === memberName ? t.to : t.from;
      return `<div class="settle-status-row" id="ssr-${key.replace(/[^a-z0-9]/gi,'_')}">
        <div style="font-size:15px;font-weight:700;color:var(--text)">${otherName}</div>
        <select onchange="updateSettleStatus('${key}',this.value)"
          style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);
                 border-radius:8px;padding:6px 10px;font-size:13px;font-weight:600;cursor:pointer;
                 outline:none;font-family:'Inter',sans-serif">
          <option value="unpaid" ${status==='unpaid'?'selected':''}>尚未結清</option>
          <option value="paid"   ${status==='paid'  ?'selected':''}>已結清</option>
        </select>
      </div>`;
    }).join('')}`;

  openModal('modalSettleStatus');
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
  const book  = currentBook(); if (!book) return;
  if (!sheet.settleStatus) sheet.settleStatus = {};

  const transfers = window._currentTransfers || [];
  const members   = window._currentMembers   || [];

  // Rebuild member transfer map
  const memberTransfers = {};
  members.forEach(m => memberTransfers[m] = { receive: [], pay: [] });
  transfers.forEach(t => {
    memberTransfers[t.to]  .receive.push({ from: t.from, amount: t.amount, key: `${t.from}→${t.to}` });
    memberTransfers[t.from].pay    .push({ to:   t.to,   amount: t.amount, key: `${t.from}→${t.to}` });
  });

  const memberStats = {};
  members.forEach(m => { memberStats[m] = { paid: 0, advanceOut: 0, advanceIn: 0, shouldPay: 0 }; });
  sheet.entries.filter(e => e.type === 'shared').forEach(e => {
    if (memberStats[e.payer]) memberStats[e.payer].paid += parseFloat(e.amount)||0;
  });
  sheet.entries.filter(e => e.type === 'advance').forEach(e => {
    const amt = parseFloat(e.amount)||0;
    if (memberStats[e.payer])  memberStats[e.payer].advanceOut += amt;
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

function calcBtn(k, type='num', wide=false) {
  if (type === 'hidden') return `<button style="visibility:hidden;background:none;border:none"></button>`;
  const bg  = type==='eq' ? 'var(--primary)' : type==='op' ? 'var(--surface2)' : type==='clear' ? 'var(--surface2)' : 'var(--surface)';
  const col = type==='eq' ? '#000' : type==='op' ? 'var(--primary)' : type==='clear' ? 'var(--red)' : 'var(--text)';
  return `<button onclick="calcPress('${k}')"
    style="background:${bg};border:1px solid var(--border);border-radius:var(--radius-sm);
           padding:20px 0;font-size:27px;font-weight:700;color:${col};
           font-family:'Inter',sans-serif;cursor:pointer;transition:transform .1s;user-select:none"
    ontouchstart="this.style.transform='scale(.93)'" ontouchend="this.style.transform=''"
    onmousedown="this.style.transform='scale(.93)'"   onmouseup="this.style.transform=''"
  >${k}</button>`;
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
  if (currentUser) currentUser.lang = lang;
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

function toggleManagedMemberAdd() {
  const panel = document.getElementById('managedMemberAddPanel');
  if (!panel) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'block' : 'none';
  if (opening) setTimeout(() => document.getElementById('acctMemberEmail')?.focus(), 100);
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
  if (!state.managedMembers) state.managedMembers = [];
  if (state.managedMembers.some(m => m.toLowerCase() === name.toLowerCase())) {
    toast('已在名單中', 'info'); return;
  }
  state.managedMembers.push(name);
  saveState();
  input.value = '';
  renderManagedMemberList();
  toast(`已新增 ${name}`, 'success');
}

function removeManagedMember(i) {
  if (!state.managedMembers) return;
  const name = state.managedMembers[i];
  state.managedMembers.splice(i, 1);
  saveState();
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
  if (field !== 'nickname') { toast(`${field} 暫不支援編輯`, 'info'); return; }
  const valEl = document.getElementById('pfv-' + field);
  const inpEl = document.getElementById('pfi-' + field);
  const btnEl = document.getElementById('pfb-' + field);
  if (!valEl || !inpEl) return;
  if (inpEl.style.display === 'block') return;
  valEl.style.display = 'none';
  inpEl.value = currentUser?.nickname || '';
  inpEl.style.display = 'block';
  inpEl.focus();
  inpEl.select();
  btnEl.textContent = '取消';
  btnEl.onclick = () => cancelEditProfileField(field);
}
function cancelEditProfileField(field) {
  const valEl = document.getElementById('pfv-' + field);
  const inpEl = document.getElementById('pfi-' + field);
  const btnEl = document.getElementById('pfb-' + field);
  if (!valEl || !inpEl) return;
  valEl.style.display = 'block';
  inpEl.style.display = 'none';
  btnEl.textContent = '編輯';
  btnEl.onclick = () => editProfileField(field);
}
function saveProfileField(field) {
  if (field !== 'nickname') return;
  const valEl = document.getElementById('pfv-' + field);
  const inpEl = document.getElementById('pfi-' + field);
  const btnEl = document.getElementById('pfb-' + field);
  if (!valEl || !inpEl) return;
  const val = inpEl.value.trim();
  if (!val || val === currentUser.nickname) { cancelEditProfileField(field); return; }
  currentUser.nickname = val;
  if (currentUser) currentUser.nickname = val;
  saveState();
  valEl.textContent = val;
  cancelEditProfileField(field);
  renderTopbar();
  toast('暱稱已更新', 'success');
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
  if (!name) { toast('請輸入帳本名稱', 'error', 'bookName', 'above'); return; }
  const book = {
    id: uid(), name,
    desc:       document.getElementById('bookDesc').value.trim(),
    currency:   'TWD',
    members:    currentUser ? [currentUser.nickname || currentUser.name] : [],
    payMethods: ['現金'],
    rootItems:  [],
    inviteCode: uid(),
    createdAt:  new Date().toISOString()
  };
  state.books.push(book);
  saveState(); closeModal('modalBook');
  nav.path = [book.id]; nav.tab = 'home';
  render();
}
function openEditBook(bookId) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  document.getElementById('editBookName').value = book.name;
  document.getElementById('editBookDesc').value = book.desc || '';
  document.getElementById('modalEditBook').dataset.bookId = bookId;
  openModal('modalEditBook');
}
function saveEditBook() {
  const bookId = document.getElementById('modalEditBook').dataset.bookId;
  const book   = state.books.find(b => b.id === bookId); if (!book) return;
  const name   = document.getElementById('editBookName').value.trim();
  if (!name) { toast('請輸入帳本名稱', 'error', 'editBookName', 'above'); return; }
  book.name = name;
  book.desc = document.getElementById('editBookDesc').value.trim();
  saveState(); closeModal('modalEditBook'); toast('帳本已更新', 'success'); render();
}
function confirmDeleteBook(bookId) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  document.getElementById('confirmTitle').textContent = '確認刪除帳本';
  document.getElementById('confirmMsg').textContent   = `確定要刪除帳本「${book.name}」及其所有內容？此操作無法復原。`;
  confirmCb = () => {
    state.books = state.books.filter(b => b.id !== bookId);
    if (nav.path[0] === bookId) nav.path = [];
    saveState(); toast('帳本已刪除', 'success'); render();
  };
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
  document.getElementById('newItemMemberTags').innerHTML = '';
  const book = currentBook();
  const existingMembers = book?.members?.length ? [...book.members]
    : (currentUser ? [currentUser.nickname || currentUser.name] : []);
  window._newItemMembers = [...existingMembers];
  renderNewItemMemberTags();
  const curEl = document.getElementById('newItemCurrency');
  if (curEl && book) curEl.value = book.currency || 'TWD';
  selectNewType(preselect);
  openModal('modalNewItem');
}
function renderNewItemMemberTags() {
  const wrap = document.getElementById('newItemMemberTags'); if (!wrap) return;
  wrap.innerHTML = (window._newItemMembers || []).map((m, i) =>
    `<span class="member-tag" style="cursor:pointer" onclick="removeNewItemMember(${i})">
      ${m}&nbsp;<span style="opacity:.5;font-size:11px">✕</span>
    </span>`
  ).join('');
}
function removeNewItemMember(i) {
  if (window._newItemMembers) {
    window._newItemMembers.splice(i, 1);
  syncToManagedMembers(email);
  renderNewItemMemberTags();
  }
}
async function addInviteMember() {
  const email = document.getElementById('newItemInviteEmail').value.trim();
  if (!email) { toast('請輸入電子郵件', 'error'); return; }
  if (!window._newItemMembers) window._newItemMembers = [];
  if (window._newItemMembers.some(m => m.toLowerCase() === email.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._newItemMembers.push(email);
  syncToManagedMembers(email);
  renderNewItemMemberTags();
  document.getElementById('newItemInviteEmail').value = '';
  const book = currentBook();
  if (book) {
    const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${book.id}`;
    const inviter = currentUser?.nickname || currentUser?.name || '朋友';
    const ok = await sendBookInvite(email, book.name, inviter, link);
    toast(ok ? `邀請已寄送至 ${email}` : `已加入 ${email}（邀請信寄送失敗）`, ok ? 'success' : 'info');
  } else {
    toast(`已加入 ${email}`, 'success');
  }
}

function toggleNewItemMemberAdd() {
  const panel = document.getElementById('newItemMemberAddPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) { renderNewItemHistoryMembers(); setTimeout(() => document.getElementById('newItemInviteEmail')?.focus(), 100); }
}

function renderNewItemHistoryMembers() {
  const wrap = document.getElementById('newItemHistoryMembers'); if (!wrap) return;
  const history = getGlobalMemberHistory();
  const current = new Set(window._newItemMembers || []);
  if (!history.length) {
    wrap.innerHTML = `<span style="font-size:13px;color:var(--text3)">尚無歷史成員</span>`;
    return;
  }
  wrap.innerHTML = history.map(m => {
    const isAdded = current.has(m);
    return `<span class="member-tag" style="cursor:pointer;${isAdded?'background:var(--primary);color:#000;':''}"
      onclick="addHistoryMember('${m.replace(/'/g,"\\'")}')">
      ${m}${isAdded ? ' ✓' : ' ＋'}
    </span>`;
  }).join('');
}

function addHistoryMember(name) {
  if (!window._newItemMembers) window._newItemMembers = [];
  if (window._newItemMembers.some(m => m.toLowerCase() === name.toLowerCase())) {
    toast('已加入此成員', 'info'); return;
  }
  window._newItemMembers.push(name);
  renderNewItemMemberTags();
  renderNewItemHistoryMembers();
  toast(`已加入 ${name}`, 'success');
}

let _newItemCurrency = 'TWD';
let _editSheetCurrency = 'TWD';
function toggleNewItemCurrency() {
  const d = document.getElementById('newItemCurrencyDropdown');
  if (d) d.style.display = d.style.display === 'block' ? 'none' : 'block';
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
  if (d) d.style.display = d.style.display === 'block' ? 'none' : 'block';
}
function setEditSheetCurrency(val) {
  _editSheetCurrency = val;
  document.getElementById('editSheetCurrencyText').textContent = val;
  document.querySelectorAll('#editSheetCurrencyDropdown .select-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === val);
  });
  document.getElementById('editSheetCurrencyDropdown').style.display = 'none';
}
function selectNewType(t) {
  newItemType = t;
  document.getElementById('tpFolder').classList.toggle('selected', t === 'folder');
  document.getElementById('tpSheet').classList.toggle('selected',  t === 'sheet');
  document.getElementById('newItemLabel').textContent = t === 'folder' ? '資料夾名稱' : '表單名稱';
  const curRow = document.getElementById('newItemCurrencyLabel')?.closest('.form-row');
  if (curRow) curRow.style.display = t === 'sheet' ? '' : 'none';
  const memberSection = document.getElementById('newItemMemberSection');
  if (memberSection) memberSection.style.display = t === 'sheet' ? '' : 'none';
  const panel = document.getElementById('newItemMemberAddPanel');
  if (panel) panel.style.display = 'none';
}
function saveNewItem() {
  const name = document.getElementById('newItemName').value.trim();
  if (!name) { toast(`請輸入${newItemType === 'folder' ? '資料夾' : '表單'}名稱`, 'error'); return; }
  const desc     = document.getElementById('newItemDesc').value.trim();
  const currency = _newItemCurrency || 'TWD';
  const members  = [...(window._newItemMembers || (currentUser ? [currentUser.nickname || currentUser.name] : []))];
  const now = new Date();
  const createdAt = now.getFullYear() + '/' +
    String(now.getMonth()+1).padStart(2,'0') + '/' +
    String(now.getDate()).padStart(2,'0') + ' ' +
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0');
  const memberJoinTimes = {};
  const localDate = now.getFullYear() + '-' +
    String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0');
  members.forEach(m => { memberJoinTimes[m] = localDate; });
  const newIt = newItemType === 'folder'
    ? { id: uid(), type: 'folder', name, desc, items: [], createdAt, closed: false }
    : { id: uid(), type: 'sheet',  name, desc, currency, members, memberJoinTimes, entries: [], createdAt, closed: false };
  const list = currentItemsList();
  if (!list) { toast('發生錯誤', 'error'); return; }
  list.push(newIt);
  saveState(); closeModal('modalNewItem');
  nav.path.push(newIt.id);
  render();
}

// ════════════════════════════════
// RENAME
// ════════════════════════════════

function openRenameNode(itemId) {
  const item = findItemAnywhere(itemId); if (!item) return;
  if (item.type === 'sheet') { openEditSheet(itemId); return; }
  document.getElementById('renameInput').value     = item.name;
  document.getElementById('renameDescInput').value = item.desc || '';
  renameCb = (name, desc) => { item.name = name; item.desc = desc; saveState(); toast('已重新命名', 'success'); render(); };
  openModal('modalRename');
}
function toggleEditSheetMemberAdd() {
  const panel = document.getElementById('editSheetMemberAddPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) { renderEditSheetQuickSelect(); setTimeout(() => document.getElementById('editSheetInviteEmail')?.focus(), 100); }
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
  document.getElementById('editSheetName').value    = item.name;
  document.getElementById('editSheetDesc').value    = item.desc || '';
  _editSheetCurrency = item.currency || 'TWD';
  document.getElementById('editSheetCurrencyText').textContent = _editSheetCurrency;
  document.getElementById('editSheetInviteEmail').value = '';
  const panel = document.getElementById('editSheetMemberAddPanel');
  if (panel) panel.style.display = 'none';
  window._editSheetId = itemId;
  window._editSheetMembers = [...(item.members || [])];
  renderEditSheetMemberTags();
  openModal('modalEditSheet');
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
async function addEditSheetMember() {
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
  const book = currentBook();
  if (book) {
    const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${book.id}`;
    const inviter = currentUser?.nickname || currentUser?.name || '朋友';
    const ok = await sendBookInvite(email, book.name, inviter, link);
    toast(ok ? `邀請已寄送至 ${email}` : `已加入 ${email}（邀請信寄送失敗）`, ok ? 'success' : 'info');
  } else {
    toast(`已加入 ${email}`, 'success');
  }
}
function saveEditSheet() {
  const name = document.getElementById('editSheetName').value.trim();
  if (!name) { toast('請輸入表單名稱', 'error', 'editSheetName', 'above'); return; }
  const item = findItemAnywhere(window._editSheetId); if (!item) return;
  const oldMembers = new Set(item.members || []);
  const newMembers = [...(window._editSheetMembers || [])];
  const now = new Date();
  // Store join date as local YYYY-MM-DD to avoid UTC timezone shift
  const localDate = now.getFullYear() + '-' +
    String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0');
  if (!item.memberJoinTimes) item.memberJoinTimes = {};
  newMembers.forEach(m => {
    if (!oldMembers.has(m)) {
      // Store as ISO string for same-day precision; shouldShare() will parse it correctly
      item.memberJoinTimes[m] = now.toISOString();
    }
  });
  item.name     = name;
  item.desc     = document.getElementById('editSheetDesc').value.trim();
  item.currency = _editSheetCurrency;
  item.members  = newMembers;
  saveState(); closeModal('modalEditSheet'); toast('表單已更新', 'success'); render();
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
  ctxTarget = { scope: 'item', itemId };
  document.getElementById('ctxEdit').style.display    = 'none';
  document.getElementById('ctxInvite').style.display  = 'none';
  document.getElementById('ctxRename').style.display  = 'flex';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxSep').style.display     = 'block';
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
  ctxTarget = { scope: 'entry', entryId };
  document.getElementById('ctxEdit').style.display    = 'flex';
  document.getElementById('ctxInvite').style.display  = 'none';
  document.getElementById('ctxRename').style.display  = 'none';
  document.getElementById('ctxClose').style.display   = 'none';
  document.getElementById('ctxSep').style.display     = 'block';
  // 查看收據：只有該帳目有收據才顯示
  const entry = findEntryAnywhere(entryId);
  const hasReceipt = entry?.receipts?.length > 0;
  document.getElementById('ctxReceipt').style.display = hasReceipt ? 'flex' : 'none';
  showCtx(ev);
}
function showCtx(ev) {
  const m  = document.getElementById('ctxMenu');
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
  m.style.left      = x + 'px';
  m.style.top       = y + 'px';
  m.style.textAlign = 'center';
  m.classList.add('open');
}
function ctxAction(action) {
  console.log('ctxAction', action, ctxTarget?.scope, ctxTarget?.bookId);
  document.getElementById('ctxMenu').classList.remove('open');
  if (!ctxTarget) { console.log('ctxTarget null'); return; }
  if (ctxTarget.scope === 'book') {
    if (action === 'edit')   openEditBook(ctxTarget.bookId);
    if (action === 'invite') openInvite(ctxTarget.bookId);
    if (action === 'delete') confirmDeleteBook(ctxTarget.bookId);
  } else if (ctxTarget.scope === 'item') {
    if (action === 'edit')   openRenameNode(ctxTarget.itemId);
    if (action === 'rename') openRenameNode(ctxTarget.itemId);
    if (action === 'delete') confirmDeleteItem(ctxTarget.itemId);
    if (action === 'close') toggleCloseItem(ctxTarget.itemId);
  } else if (ctxTarget.scope === 'entry') {
    if (action === 'edit')    editEntry(ctxTarget.entryId);
    if (action === 'receipt') viewReceipt(ctxTarget.entryId);
    if (action === 'delete')  confirmDeleteEntry(ctxTarget.entryId);
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
  // touch swipe state
  let touchStartX = 0, touchStartY = 0, touchStartDist = 0, touchStartScale = 1;
  let isSwiping = false, isPinching = false;

  const existing = document.getElementById('receiptViewer');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'receiptViewer';
  el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;user-select:none;';
  el.innerHTML = `
    <div style="position:relative;flex:1;overflow:hidden" id="rvImgWrap">
      <img id="rvImg" src="${receipts[0]}" style="max-width:100%;max-height:100%;object-fit:contain;transform-origin:center;transition:none;display:block;position:absolute;inset:0;margin:auto">
      <button id="rvPrev" onclick="rvGo(-1)"
        style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);border:none;color:#fff;width:52px;height:52px;border-radius:50%;font-size:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5">&lt;</button>
      <button id="rvNext" onclick="rvGo(1)"
        style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);border:none;color:#fff;width:52px;height:52px;border-radius:50%;font-size:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5">&gt;</button>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 20px 12px;background:rgba(0,0,0,.6);flex-shrink:0">
      <span id="rvCounter" style="color:#fff;font-size:14px;font-weight:600">1 / ${total}</span>
      <div style="display:flex;gap:4px;margin-top:6px" id="rvDots"></div>
    </div>
    <button onclick="document.getElementById('receiptViewer').remove()"
      style="position:absolute;top:16px;right:16px;background:none;border:none;
             color:#fff;font-size:24px;cursor:pointer;z-index:10;line-height:1">✕</button>`;
  document.body.appendChild(el);

  const img = document.getElementById('rvImg');
  const dots = document.getElementById('rvDots');

  function renderDots() {
    dots.innerHTML = receipts.map((_, i) =>
      `<div style="width:6px;height:6px;border-radius:50%;background:${i === current ? '#fff' : 'rgba(255,255,255,.3)'}"></div>`
    ).join('');
  }
  renderDots();

  function applyTransform(transition = false) {
    img.style.transition = transition ? 'transform .15s ease' : 'none';
    img.style.transform = `scale(${scale}) translate(${translateX/scale}px, ${translateY/scale}px)`;
    wrap.style.cursor = scale > 1 ? 'grab' : 'default';
  }
  function resetTransform() { scale = 1; translateX = 0; translateY = 0; applyTransform(true); }

  window.rvGo = function(dir) {
    current = (current + dir + total) % total;
    img.src = receipts[current];
    document.getElementById('rvCounter').textContent = `${current + 1} / ${total}`;
    renderDots();
    resetTransform();
  };

  // 滑鼠滾輪縮放（照片中心放大）
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.min(5, Math.max(0.5, scale * factor));
    applyTransform();
  }, { passive: false });

  // 滑鼠拖曳平移（按住拖曳，放開停止）
  const wrap = document.getElementById('rvImgWrap');
  function rvMouseDown(e) {
    if (e.target.closest('button') || scale <= 1) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function rvMouseMove(e) {
    if (!isDragging) return;
    translateX += e.clientX - lastX; translateY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  }
  function rvMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    wrap.style.cursor = scale > 1 ? 'grab' : 'default';
  }
  wrap.addEventListener('mousedown', rvMouseDown);
  document.addEventListener('mousemove', rvMouseMove);
  document.addEventListener('mouseup', rvMouseUp);
  // 雙擊還原
  wrap.addEventListener('dblclick', resetTransform);
  el.addEventListener('remove', () => {
    wrap.removeEventListener('mousedown', rvMouseDown);
    document.removeEventListener('mousemove', rvMouseMove);
    document.removeEventListener('mouseup', rvMouseUp);
    wrap.removeEventListener('dblclick', resetTransform);
  });

  // 觸控：雙指縮放 + 單指滑動切換
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
      isPinching = false;
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      scale = Math.min(5, Math.max(0.5, touchStartScale * (dist / touchStartDist)));
      applyTransform();
    } else if (e.touches.length === 1 && !isPinching && scale <= 1) {
      const dx = e.touches[0].clientX - touchStartX;
      if (Math.abs(dx) > 10) isSwiping = true;
    }
  }, { passive: false });

  el.addEventListener('touchend', e => {
    if (isSwiping && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) rvGo(dx < 0 ? 1 : -1);
    }
    isSwiping = false; isPinching = false;
  }, { passive: true });

  // 鍵盤左右切換
  function rvKeyHandler(e) {
    if (e.key === 'ArrowLeft') rvGo(-1);
    if (e.key === 'ArrowRight') rvGo(1);
    if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', rvKeyHandler); }
  }
  document.addEventListener('keydown', rvKeyHandler);
  el.addEventListener('remove', () => document.removeEventListener('keydown', rvKeyHandler));
}
document.addEventListener('click', () => document.getElementById('ctxMenu').classList.remove('open'));

function confirmDeleteItem(itemId) {
  const item  = findItemAnywhere(itemId); if (!item) return;
  const label = item.type === 'folder' ? `資料夾「${item.name}」及其所有子項目` : `記帳表單「${item.name}」及其所有帳目`;
  document.getElementById('confirmTitle').textContent = '確認刪除';
  document.getElementById('confirmMsg').textContent   = `確定要刪除${label}？此操作無法復原。`;
  confirmCb = () => {
    const arr = findParentArray(itemId);
    if (arr) { const idx = arr.findIndex(x => x.id === itemId); if (idx >= 0) arr.splice(idx, 1); }
    // 若目前正在被刪除的節點內，退回上一層
    if (nav.path.includes(itemId)) {
      nav.path = nav.path.slice(0, nav.path.indexOf(itemId));
    }
    saveState(); toast('已刪除', 'success'); render();
  };
  openModal('modalConfirm');
}

// ════════════════════════════════
// ENTRY CRUD
// ════════════════════════════════
let _entryPayer = '';
let _entryDebtor = '';
let _entryType = 'shared';

function openAddEntry() {
  const book = currentBook();
  document.getElementById('entryItem').value   = '';
  document.getElementById('entryDate').value   = today();
  document.getElementById('entryAmount').value = '';
  document.getElementById('entryNote').value   = '';
  document.getElementById('modalEntryTitle').textContent = '新增帳目';
  document.getElementById('modalEntry').dataset.editId   = '';
  document.getElementById('receiptThumbs').innerHTML = '';
  window._entryReceipts = [];
  _entryType = 'shared';
  _entryDebtor = '';
  document.getElementById('entryTypeText').textContent = '共用';
  document.getElementById('entryDebtorText').textContent = '請選擇欠款人';
  const sheet = currentNode();
  const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
    : book?.members?.length ? book.members
    : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
  _entryPayer = members[0] || '';
  document.getElementById('entryPayerText').textContent = _entryPayer || '選擇成員';
  onEntryTypeChange();
  _selectedPayMethod = (currentBook()?.payMethods?.[0]) || '現金';
  renderPayMethodTags();
  openModal('modalEntry');
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
function toggleEntryType() {
  const d = document.getElementById('entryTypeDropdown');
  d.style.display = d.style.display === 'block' ? 'none' : 'block';
}
function setEntryType(val) {
  _entryType = val;
  document.getElementById('entryTypeText').textContent = val === 'shared' ? '共用' : val === 'advance' ? '代墊' : '自用';
  document.getElementById('entryTypeDropdown').style.display = 'none';
  document.querySelectorAll('#entryTypeDropdown .select-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === val);
  });
  onEntryTypeChange();
}
function toggleEntryPayer() {
  const d = document.getElementById('entryPayerDropdown');
  if (d.style.display === 'block') { d.style.display = 'none'; return; }
  const book = currentBook(); if (!book) return;
  const sheet = currentNode();
  const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
    : book?.members?.length ? book.members
    : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
  d.innerHTML = members.map(m => {
    const sel = m === _entryPayer;
    return `<div class="select-option${sel ? ' selected' : ''}" onclick="setEntryPayer('${m}')">${m}</div>`;
  }).join('');
  d.style.display = 'block';
}
function setEntryPayer(name) {
  _entryPayer = name;
  document.getElementById('entryPayerText').textContent = name;
  document.getElementById('entryPayerDropdown').style.display = 'none';
}
function toggleEntryDebtor() {
  const d = document.getElementById('entryDebtorDropdown');
  if (d.style.display === 'block') { d.style.display = 'none'; return; }
  const book = currentBook(); if (!book) return;
  const sheet = currentNode();
  const members = (sheet?.type === 'sheet' && sheet.members?.length ? sheet.members
    : book?.members?.length ? book.members
    : currentUser ? [currentUser.nickname || currentUser.name] : ['我']);
  d.innerHTML = `<div class="select-option${!_entryDebtor ? ' selected' : ''}" onclick="setEntryDebtor('')">請選擇欠款人</div>`
    + members.map(m => {
      const sel = m === _entryDebtor;
      return `<div class="select-option${sel ? ' selected' : ''}" onclick="setEntryDebtor('${m}')">${m}</div>`;
    }).join('');
  d.style.display = 'block';
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
}
function toggleEntryPayMethod() {
  const p = document.getElementById('entryPayMethodPanel');
  const opening = p.style.display !== 'block';
  p.style.display = opening ? 'block' : 'none';
  if (opening) setTimeout(() => document.getElementById('payMethodInput')?.focus(), 100);
}
// 目前選中的付款方式
let _selectedPayMethod = '現金';

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
  if (!book.payMethods || book.payMethods[i] === '現金') return;
  const removed = book.payMethods[i];
  book.payMethods.splice(i, 1);
  if (_selectedPayMethod === removed) _selectedPayMethod = book.payMethods[0];
  saveState();
  renderPayMethodTags();
  toast(`已移除「${removed}」`, 'success');
}
function addPayMethod() {
  const input = document.getElementById('payMethodInput');
  const name = input ? input.value.trim() : '';
  if (!name) { toast('請輸入付款方式名稱', 'error', 'payMethodInput', 'above'); return; }
  const book = currentBook(); if (!book) return;
  if (!book.payMethods) book.payMethods = ['現金'];
  if (book.payMethods.includes(name)) { toast('已有此付款方式', 'info'); return; }
  book.payMethods.push(name);
  _selectedPayMethod = name;
  saveState();
  renderPayMethodTags();
  if (input) input.value = '';
  input.focus();
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
  ctxTarget = { scope: 'item', itemId: sheetId };
  document.getElementById('ctxEdit').style.display    = 'flex';
  document.getElementById('ctxEdit').textContent      = '編輯';
  document.getElementById('ctxRename').style.display  = 'none';
  document.getElementById('ctxReceipt').style.display = 'none';
  document.getElementById('ctxSep').style.display     = 'block';
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
async function addBookMember() {
  const email = document.getElementById('memberInviteEmail').value.trim();
  if (!email) { toast('請輸入電子郵件', 'error'); return; }
  const book = currentBook(); if (!book) return;
  if (book.members.some(m => m.toLowerCase() === email.toLowerCase())) {
    toast('此成員已在帳本中', 'info'); return;
  }
  book.members.push(email);
  syncToManagedMembers(email);
  saveState();
  document.getElementById('memberInviteEmail').value = '';
  renderBookMemberList();
  const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${book.id}`;
  const inviter = currentUser?.nickname || currentUser?.name || '朋友';
  const ok = await sendBookInvite(email, book.name, inviter, link);
  toast(ok ? `邀請已寄送至 ${email}` : `已新增 ${email}（邀請信寄送失敗）`, ok ? 'success' : 'info');
}
function removeBookMember(i) {
  const book = currentBook(); if (!book) return;
  const me = currentUser?.nickname || currentUser?.name;
  if (book.members[i] === me) { toast('無法移除自己', 'error'); return; }
  const name = book.members[i];
  book.members.splice(i, 1);
  saveState();
  renderBookMemberList();
  toast(`已移除 ${name}`, 'success');
}
function saveEntry() {
  const item   = document.getElementById('entryItem').value.trim();
  if (!item)   { toast('請輸入支出項目', 'error', 'entryItem', 'above'); return; }
  const amount = parseFloat(document.getElementById('entryAmount').value);
  if (!amount || amount <= 0) { toast('請輸入有效金額', 'error', 'entryAmount', 'above'); return; }
  const date   = document.getElementById('entryDate').value;
  if (!date)   { toast('請選擇日期', 'error', 'entryDate', 'above'); return; }
  if (_entryType === 'advance' && !_entryDebtor) { toast('請選擇欠款人', 'error', 'entryDebtorLabel', 'above'); return; }
  const sheet  = getSheet(); if (!sheet) return;
  const book   = currentBook(); if (!book) return;
  const editId = document.getElementById('modalEntry').dataset.editId;
  const entry  = {
    id: editId || uid(), item, date, amount,
    currency:  book.currency || 'TWD',
    type:      _entryType,
    payMethod: _selectedPayMethod || '現金',
    payer:     _entryPayer || '',
    debtor:    _entryDebtor || '',
    note:      document.getElementById('entryNote').value.trim(),
    receipts:  window._entryReceipts || [],
    createdBy: currentUser?.nickname || '—',
    createdAt: new Date().toISOString()
  };
  if (editId) {
    const idx = sheet.entries.findIndex(e => e.id === editId);
    if (idx >= 0) sheet.entries[idx] = entry;
    toast('帳目已更新', 'success');
  } else {
    sheet.entries.push(entry);
    toast('帳目已新增', 'success');
  }
  closeAllEntryDropdowns();
  saveState(); closeModal('modalEntry'); render();
}
function editEntry(entryId) {
  const sheet = getSheet(); if (!sheet) return;
  const e = sheet.entries.find(x => x.id === entryId); if (!e) return;
  openAddEntry();
  document.getElementById('entryItem').value      = e.item;
  document.getElementById('entryDate').value      = e.date;
  document.getElementById('entryAmount').value    = e.amount;
  _entryType = e.type || 'shared';
  document.getElementById('entryTypeText').textContent = _entryType === 'shared' ? '共用' : _entryType === 'advance' ? '代墊' : '自用';
  _selectedPayMethod = e.payMethod || '現金';
  _entryPayer = e.payer || '';
  document.getElementById('entryPayerText').textContent = _entryPayer || '選擇成員';
  _entryDebtor = e.debtor || '';
  document.getElementById('entryDebtorText').textContent = _entryDebtor || '請選擇欠款人';
  document.getElementById('entryNote').value      = e.note  || '';
  window._entryReceipts = e.receipts ? [...e.receipts] : [];
  renderReceiptThumbs();
  onEntryTypeChange();
  document.getElementById('modalEntryTitle').textContent = '編輯帳目';
  document.getElementById('modalEntry').dataset.editId   = entryId;
}
function confirmDeleteEntry(entryId) {
  const sheet = getSheet(); if (!sheet) return;
  const e = sheet.entries.find(x => x.id === entryId); if (!e) return;
  document.getElementById('confirmTitle').textContent = '確認刪除帳目';
  document.getElementById('confirmMsg').textContent   = `確定要刪除「${e.item}」（${fmt(e.amount, e.currency)}）？此操作無法復原。`;
  confirmCb = () => {
    sheet.entries = sheet.entries.filter(x => x.id !== entryId);
    saveState(); toast('帳目已刪除', 'success'); render();
  };
  openModal('modalConfirm');
}
// ════════════════════════════════
// INVITE
// ════════════════════════════════
function openInvite(bookId) {
  console.log('openInvite called', bookId);
  const book = state.books.find(b => b.id === bookId); if (!book) { console.log('openInvite: book not found', bookId); return; }
  const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${bookId}`;
  document.getElementById('inviteLink').textContent = link;
  document.getElementById('inviteMembers').innerHTML = book.members.map(m => {
    const photo = getMemberPhoto(book, m);
    return photo
      ? `<div class="member-avatar"><img class="member-avatar-img" src="${photo}">${m}</div>`
      : `<div class="member-avatar"><div class="member-avatar-dot">${m.charAt(0).toUpperCase()}</div>${m}</div>`;
  }).join('') || '<span style="font-size:13px;color:var(--text3)">尚無其他成員</span>';
  openModal('modalInvite');
  const btn = document.querySelector('#modalInvite .invite-add-btn');
  if (btn && !btn._inviteBound) { btn._inviteBound = true; btn.onclick = sendInviteFromModal; }
}
function copyInviteLink() {
  navigator.clipboard.writeText(document.getElementById('inviteLink').textContent)
    .then(() => toast('連結已複製', 'success')).catch(() => toast('請手動複製連結', 'error'));
}
async function sendInviteFromModal() {
  console.log('[Invite] sendInviteFromModal called');
  const input = document.getElementById('inviteEmailInput'); if (!input) { console.log('[Invite] input not found'); return; }
  const email = input.value.trim();
  console.log('[Invite] email:', email);
  if (!email) { toast('請輸入電子郵件', 'error', 'inviteEmailInput'); return; }
  const book = currentBook(); if (!book) { console.log('[Invite] no current book'); return; }
  console.log('[Invite] book:', book.name);
  const link = `${location.origin}${location.pathname}?invite=${book.inviteCode}&book=${book.id}`;
  const inviter = currentUser?.nickname || currentUser?.name || '朋友';
  console.log('[Invite] sending to:', email, 'book:', book.name, 'inviter:', inviter);
  const ok = await sendBookInvite(email, book.name, inviter, link);
  console.log('[Invite] send result:', ok);
  if (!ok) { toast('邀請信寄送失敗', 'error'); return; }
  input.value = '';
  toast(`邀請已寄送至 ${email}`, 'success');
}

document.addEventListener('click', function(e) {
  console.log('CLICK', e.target.tagName, (typeof e.target.className === 'string' ? e.target.className : '').slice(0,40), 'in:', (e.target.closest('[onclick]')?.tagName||''));
  const btn = e.target.closest('[data-invite-btn]');
  if (btn) { e.stopPropagation(); openInvite(btn.dataset.inviteBtn); }
  const sendBtn = e.target.closest('[data-invite-send]');
  if (sendBtn) sendInviteFromModal();
}, true);
// ════════════════════════════════
// INIT
// ════════════════════════════════
async function init() {
  auth.onAuthStateChanged(async user => {
    try {
      if (user) {
        if (currentUser?.uid === user.uid && state.books.length > 0) return;
        setCurrentUserFromFirebase(user);
        console.log('[Init] auth state changed, uid:', user.uid);
        await loadState();
        console.log('[Init] books after load:', state.books.length);
        const params = new URLSearchParams(location.search);
        const inviteCode = params.get('invite');
        const bookId = params.get('book');
        if (inviteCode && bookId) {
          history.replaceState({}, '', location.pathname);
          await acceptInvite(bookId, inviteCode);
        }
        enterApp();
      } else {
        if (!currentUser) {
          document.getElementById('authScreen').style.display = 'flex';
          document.getElementById('app').style.display        = 'none';
          showPage('login');
        }
      }
    } catch(e) {
      console.error('[Init] auth callback error:', e);
      enterApp();
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

// ════════════════════════════════════════
// PC 版覆寫區
// ════════════════════════════════════════

function enterApp() {
  try {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    applySettings();
    render();
  } catch(e) {
    console.error('[enterApp] error:', e);
    document.getElementById('main').innerHTML = '<div style="color:red;padding:30px;font-size:16px">Error: '
      + e.message + '<br><br>Check console for details.</div>';
  }
}

function render() {
  try {
  renderTopbar();
  updateBreadcrumb();
  updateBottomNav();
  renderFab();
  const homeBtn = document.getElementById('snav-home');
  if (homeBtn) homeBtn.classList.toggle('active', !nav.path.length && nav.tab === 'home');
  if (nav.tab === 'calc') nav.tab = 'home';
  nav.path.forEach(id => { _stOpen[id] = true; });
  renderSidebarTree();
  const main = document.getElementById('main');
  main.style.overflow = '';
  if (nav.tab === 'settings') { renderSettings(main); return; }
  if (nav.tab === 'account')  { renderAccount(main);  return; }
  if (!nav.path.length) { renderHome(main); return; }
  const node = currentNode();
  if (!node || node.type === 'folder') { renderFolderView(main); }
  else if (node.type === 'sheet') { renderSheetView(main); }
  } catch(e) { console.error('RENDER ERROR', e); document.getElementById('main').innerHTML = '<div style="color:red;padding:20px">Render error: ' + e.message + '</div>'; }
}

function renderTopbar() {
  const u = currentUser; if (!u) return;
  const sImg = document.getElementById('sidebarAvatarImg');
  const sLtr = document.getElementById('sidebarAvatarLetter');
  const pImg = document.getElementById('pcTopbarAvatarImg');
  const pLtr = document.getElementById('pcTopbarAvatarLetter');
  if (u.avatarDataUrl || u.photoURL) {
    if (sImg) { sImg.src = u.avatarDataUrl || u.photoURL; sImg.style.display = 'block'; }
    if (sLtr) sLtr.style.display = 'none';
    if (pImg) { pImg.src = u.avatarDataUrl; pImg.style.display = 'block'; }
    if (pLtr) pLtr.style.display = 'none';
  } else {
    if (sImg) sImg.style.display = 'none';
    if (pImg) pImg.style.display = 'none';
    const L = (u.nickname || u.name || 'U').charAt(0).toUpperCase();
    if (sLtr) { sLtr.style.display = 'flex'; sLtr.textContent = L; }
    if (pLtr) { pLtr.style.display = 'flex'; pLtr.textContent = L; }
  }
  const nameEl  = document.getElementById('pcTopbarName');
  const greetEl = document.getElementById('pcTopbarGreeting');
  const sName   = document.getElementById('sidebarUserName');
  const sEmail  = document.getElementById('sidebarUserEmail');
  if (nameEl)  nameEl.textContent  = u.nickname || u.name;
  if (greetEl) greetEl.textContent = getGreeting(u.lang || state.settings.lang);
  if (sName)   sName.textContent   = u.nickname || u.name;
  if (sEmail)  sEmail.textContent  = u.email || '個人帳戶';
  const addBtn = document.getElementById('pcAddBtn');
  if (addBtn) {
    if (nav.tab !== 'home') { addBtn.style.display = 'none'; return; }
    addBtn.style.display = 'flex';
    const plusSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    if (!nav.path.length) {
      addBtn.innerHTML = plusSvg + ' 新增帳本';
    } else {
      const node = currentNode();
      addBtn.innerHTML = plusSvg + (node && node.type === 'sheet' ? ' 新增帳目' : ' 新增項目');
    }
  }
}

function updateBreadcrumb() {
  const bc = document.getElementById('pcBreadcrumb'); if (!bc) return;
  if (nav.tab !== 'home' || !nav.path.length) { bc.innerHTML = ''; return; }
  let html = '<span class="bc-item" onclick="goHome()">首頁</span>';
  const book = currentBook();
  if (book) html += '<span class="bc-sep">›</span><span class="bc-item' + (nav.path.length===1?' active':'') + '" onclick="goDepth(0)">' + book.name + '</span>';
  if (nav.path.length > 1) {
    let list = book.rootItems;
    for (let i = 1; i < nav.path.length; i++) {
      const n = list.find(x => x.id === nav.path[i]); if (!n) break;
      const isLast = i === nav.path.length - 1;
      html += '<span class="bc-sep">›</span><span class="bc-item' + (isLast?' active':'') + '" onclick="goDepth(' + i + ')">' + n.name + '</span>';
      if (n.type === 'folder') list = n.items;
    }
  }
  bc.innerHTML = html;
}

function updateBottomNav() {}
function renderFab() {}

// ── 側欄樹狀導覽（Windows 檔案總管風格）──
const _stOpen = {};
function renderSidebarTree() {
  const el = document.getElementById('sidebarTree'); if (!el) return;
  if (nav.tab !== 'home') { el.innerHTML = ''; return; }
  if (!state.books || !state.books.length) { el.innerHTML = ''; return; }
  let html = '';
  state.books.forEach(book => {
    const isBookOpen = !!_stOpen[book.id];
    const isBookActive = nav.path.length === 1 && nav.path[0] === book.id;
    html += '<div class="st-book">';
    html += '<div class="st-book-row' + (isBookActive ? ' active' : '') + '">';
    html += '<span class="st-arrow' + (isBookOpen ? ' open' : '') + '" onclick="event.stopPropagation();_stToggle(\'' + book.id + '\')"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 1l5 4-5 4"/></svg></span>';
    html += '<span class="st-book-name" onclick="goBook(\'' + book.id + '\')">' + _esc(book.name) + '</span>';
    html += '</div>';
    if (isBookOpen && book.rootItems && book.rootItems.length) {
      html += '<div class="st-children">';
      html += _stRenderItems(book.rootItems, book.id);
      html += '</div>';
    }
    html += '</div>';
  });
  el.innerHTML = html;
}
function _stToggle(id) {
  if (id in _stOpen) delete _stOpen[id];
  else _stOpen[id] = true;
  renderSidebarTree();
}
function _stRenderItems(items, bookId) {
  let html = '';
  items.forEach(item => {
    const isFolder = item.type === 'folder';
    const hasKids = isFolder && item.items && item.items.length > 0;
    const isActive = nav.path[nav.path.length - 1] === item.id;
    const isOpen = !!_stOpen[item.id];
    html += '<div class="st-item' + (isActive ? ' active' : '') + '">';
    html += '<div class="st-row">';
    if (hasKids) html += '<span class="st-arrow' + (isOpen ? ' open' : '') + '" onclick="event.stopPropagation();_stToggle(\'' + item.id + '\')"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 1l5 4-5 4"/></svg></span>';
    else html += '<span class="st-icon">' + (isFolder ? '&#128193;' : '&#128203;') + '</span>';
    html += '<span class="st-name" onclick="(function(){if(nav.path[0]!==\'' + bookId + '\')nav.path=[\'' + bookId + '\'];pushNav(\'' + item.id + '\');})()">' + _esc(item.name) + '</span>';
    html += '</div>';
    if (isOpen && hasKids) {
      html += '<div class="st-children">';
      html += _stRenderItems(item.items, bookId);
      html += '</div>';
    }
    html += '</div>';
  });
  return html;
}
function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function switchSidebarTab(tab) {
  ['home','settings'].forEach(t => {
    const el = document.getElementById('snav-' + t);
    if (el) el.classList.remove('active');
  });
  const sUser = document.getElementById('snav-account');
  if (sUser) sUser.classList.remove('active');
  if (tab === 'calc')     { document.getElementById('snav-calc')?.classList.add('active');     nav.tab = 'calc';     }
  else if (tab === 'settings') { document.getElementById('snav-settings')?.classList.add('active'); nav.tab = 'settings'; }
  else if (tab === 'account')  { if (sUser) sUser.classList.add('active'); nav.tab = 'account'; }
  else { document.getElementById('snav-home')?.classList.add('active'); nav.tab = 'home'; nav.path = []; }
  render();
}

// ── 帳號頁：包進 pc-center-wrap 限寬置中 ──
function renderAccount(main) {
  const u = currentUser || {};
  const avatarHtml = getAvatarHtml(u, 80, 'width:100%;height:100%');
  const genderMap = { male:'男', female:'女', other:'其他', prefer_not:'不透露', '':'—' };
  main.style.overflow = 'auto';
  main.innerHTML = `
    <div class="pc-center-wrap" style="padding:10px 0 60px">
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
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:0 18px">
        ${[['姓名',u.name||'—','name'],['暱稱',u.nickname||'—','nickname']]
          .map(([label,val,field],i,arr) => `
          <div class="profile-field" style="border-bottom:1px solid var(--border)" id="pf-${field}">
            <div style="flex:1;min-width:0">
              <div class="pf-label">${label}</div>
              <div id="pfv-${field}" class="pf-val">${val}</div>
              <input id="pfi-${field}" style="display:none;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-family:Inter,sans-serif;width:100%;margin-top:4px" onkeydown="if(event.key==='Enter')saveProfileField('${field}')" onblur="saveProfileField('${field}')">
            </div>
            <button class="pf-edit" id="pfb-${field}" onclick="editProfileField('${field}')">編輯</button>
          </div>`).join('')}
        <div class="profile-field" id="pf-email">
          <div style="flex:1;min-width:0">
            <div class="pf-label">電子郵件</div>
            <div class="pf-val">${u.email||'—'}</div>
          </div>
        </div>
      </div>
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
              <input id="acctMemberEmail" placeholder="輸入 email 或名稱" style="flex:1" onkeydown="if(event.key==='Enter')addManagedMember()">
              <button class="invite-add-btn" onclick="addManagedMember()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:28px">
        <button class="logout-btn" onclick="logout()">登出</button>
        <div style="text-align:center;color:var(--text3);font-size:11px;margin-top:16px;opacity:0.5">V2.1.41</div>
      </div>
    </div>`;
  renderManagedMemberList();
}

// ── 首頁：Netflix Poster 卡片 ──
function renderHome(main) {
  const totalAll = state.books.reduce((a,b)=>{const s=countBookStats(b);return{entries:a.entries+s.entries,total:a.total+s.total};},{entries:0,total:0});
  const bookCount = state.books.length;
  const hero = `
    <div class="home-hero">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div class="hero-label">所有帳本總支出</div>
        <div class="hero-currency-badge" onclick="cycleHeroCurrency()">${heroDisplayCurrency}</div>
      </div>
      <div class="hero-amount">
        <span class="currency">${CURRENCY_SYMBOLS[heroDisplayCurrency]||'$'}</span><span id="heroAmt">0</span>
      </div>
      <div style="display:flex;align-items:center;gap:32px;margin-top:14px;flex-wrap:wrap">
        <div class="hero-growth">▲ ${bookCount} 個帳本</div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hero-stat-label">帳目筆數</div><div class="hero-stat-val">${totalAll.entries}</div></div>
          <div class="hero-stat"><div class="hero-stat-label">帳本數量</div><div class="hero-stat-val">${bookCount}</div></div>
        </div>
      </div>
    </div>`;

  const bookCards = state.books.map(b => {
    const s = countBookStats(b);
    const members = (b.members||[]).map(m=>{
      const info = b?.memberInfo ? Object.values(b.memberInfo).find(x=>x.name===m||x.nickname===m||x.email===m) : null;
      const photo = info?.avatarDataUrl || info?.photoURL || '';
      const label = m.charAt(0).toUpperCase();
      return photo
        ? `<div class="bcp-avatar" style="overflow:hidden;border-radius:50%"><img src="${photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover"></div>`
        : `<div class="bcp-avatar">${label}</div>`;
    }).join('');
    return `
      <div class="book-card-poster" onclick="goBook('${b.id}')">
        <div class="bcp-accent" style="background:linear-gradient(90deg,#FFD040,transparent)"></div>
        <div class="bcp-inner">
          <div class="bcp-row-top">
            <div class="bcp-name">${b.name}</div>
            <!-- 邀請按鈕已停用 -->
            <button class="book-card-menu-btn" onclick="event.stopPropagation();openBookMenu(event,'${b.id}')">⋮</button>
          </div>
          ${b.desc?`<div class="bcp-desc">${b.desc}</div>`:''}
          <div class="bcp-amount">${fmt(s.total,b.currency)}</div>
          <div class="bcp-row-meta">
            <div class="bcp-currency">${b.currency||'TWD'}</div>
            <div class="bcp-entries">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ${s.entries} 筆
            </div>
          </div>
          ${members?`<div class="bcp-members">${members}</div>`:''}
        </div>
      </div>`;
  }).join('');

  const addCard = `
    <div class="book-card-add-poster" onclick="openCreateBook()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      新增帳本
    </div>`;

  const emptyHint = !bookCount ? `
    <div class="pc-empty-hint">
      <div class="pc-empty-hint-title">尚無帳本</div>
      <div class="pc-empty-hint-sub">點擊上方卡片或右上角「新增帳本」建立第一個帳本</div>
    </div>` : '';

  main.innerHTML = hero
    + '<div class="section-label">我的帳本</div>'
    + '<div class="pc-book-grid">' + bookCards + addCard + '</div>'
    + emptyHint;

  // bind invite buttons
  main.querySelectorAll('[data-invite-btn]').forEach(el => {
    el.onclick = function(e) { e.stopPropagation(); openInvite(this.dataset.inviteBtn); };
  });

  animateNumber('heroAmt', totalAll.total, 800, heroDisplayCurrency);
}

// ── 資料夾/帳本視圖：poster 風格，無 emoji ──
function renderFolderView(main) {
  const book = currentBook(); if (!book) return goHome();
  const items = currentItemsList() || [];
  const node  = currentNode();
  const name  = node ? node.name : book.name;
  const s     = node ? countFolderStats(node) : countBookStats(book);

  const cards = items.map(it => {
    if (it.type === 'folder') {
      const fs = countFolderStats(it);
      return `
        <div class="book-card-poster" onclick="pushNav('${it.id}')" style="${it.closed?'opacity:.55':''}">
          <div class="bcp-accent" style="background:linear-gradient(90deg,#FFD040,transparent)"></div>
          <div class="bcp-inner">
            <div class="bcp-row-top">
              <div class="bcp-name">${it.name}${it.closed?'<span class="bcp-tag-closed">已關閉</span>':''}</div>
              <button class="book-card-menu-btn" onclick="event.stopPropagation();openCtxItem(event,'${it.id}')">⋮</button>
            </div>
            ${it.desc?`<div class="bcp-desc">${it.desc}</div>`:''}
            <div class="bcp-row-meta">
              <div class="bcp-entries">${it.items.length} 個項目 · ${fs.entries} 筆帳目</div>
            </div>
          </div>
        </div>`;
    } else {
      const total = it.entries.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
      const members = (it.members||book.members||[]).map(m=>{
        const info = book?.memberInfo ? Object.values(book.memberInfo).find(x=>x.name===m||x.nickname===m||x.email===m) : null;
        const photo = info?.avatarDataUrl || info?.photoURL || '';
        const label = m.charAt(0).toUpperCase();
        return photo
          ? `<div class="bcp-avatar" style="overflow:hidden;border-radius:50%"><img src="${photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover"></div>`
          : `<div class="bcp-avatar">${label}</div>`;
      }).join('');
      return `
        <div class="book-card-poster" onclick="pushNav('${it.id}')" style="${it.closed?'opacity:.55':''}">
          <div class="bcp-accent" style="background:linear-gradient(90deg,var(--primary),transparent)"></div>
          <div class="bcp-inner">
            <div class="bcp-row-top">
              <div class="bcp-name">${it.name}${it.closed?'<span class="bcp-tag-closed">已結清</span>':''}</div>
              <button class="book-card-menu-btn" onclick="event.stopPropagation();openCtxItem(event,'${it.id}')">⋮</button>
            </div>
            ${it.desc?`<div class="bcp-desc">${it.desc}</div>`:''}
            <div class="bcp-amount" style="${it.closed?'color:#777;text-decoration:line-through':''}">${it.entries.length?fmt(total,book.currency):'—'}</div>
            <div class="bcp-row-meta">
              <div class="bcp-currency">${book.currency||'TWD'}</div>
              <div class="bcp-entries">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${it.entries.length} 筆
              </div>
            </div>
            ${members?`<div class="bcp-members">${members}</div>`:''}
          </div>
        </div>`;
    }
  }).join('');

  const node2 = currentNode();
  const addCard = node2 && node2.type === 'folder'
    ? `<div class="book-card-add-poster" onclick="openNewItem()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      新增項目
    </div>`
    : `<div class="book-card-add-poster" onclick="openNewItem()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      新增項目
    </div>`;

  main.innerHTML = `
    <div class="home-hero">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div class="hero-label">${name}</div>
        <div class="hero-currency-badge">${book.currency||'TWD'}</div>
      </div>
      <div class="hero-amount">
        <span class="currency">${CURRENCY_SYMBOLS[book.currency||'TWD']||'$'}</span><span>${
          NO_DECIMAL_CURRENCIES.has(book.currency||'TWD')
            ? Math.ceil(s.total||0).toLocaleString('zh-TW',{maximumFractionDigits:0})
            : (s.total||0).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2})
        }</span>
      </div>
      <div style="display:flex;align-items:center;gap:32px;margin-top:14px;flex-wrap:wrap">
        <div class="hero-growth">▲ ${book.name}</div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hero-stat-label">總支出</div><div class="hero-stat-val">${fmt(s.total||0,book.currency)}</div></div>
          <div class="hero-stat"><div class="hero-stat-label">項目數</div><div class="hero-stat-val">${items.length}</div></div>
          <div class="hero-stat"><div class="hero-stat-label">帳目筆數</div><div class="hero-stat-val">${s.entries||0}</div></div>
        </div>
      </div>
    </div>
    <div class="section-label">項目列表</div>
    <div class="pc-book-grid">${cards}${addCard}</div>
    ${!items.length?'<div class="pc-empty-hint"><div class="pc-empty-hint-title">尚無項目</div><div class="pc-empty-hint-sub">點擊上方「新增項目」建立子資料夾或記帳表單</div></div>':''}`;
}

// ── PC 版搜尋 ──
function onPcSearch(query) {
  document.getElementById('pcSearchResults')?.remove();
  if (!query.trim()) return;
  const q = query.trim().toLowerCase();
  const results = [];
  state.books.forEach(b => {
    if (b.name.toLowerCase().includes(q)) results.push({icon:'📒',label:b.name,sub:'帳本·'+b.currency,action:()=>goBook(b.id)});
    b.members?.forEach(m => { if (m.toLowerCase().includes(q)&&!results.find(r=>r.label===m)) results.push({icon:'👤',label:m,sub:'成員·'+b.name,action:()=>goBook(b.id)}); });
    function walk(list){list.forEach(it=>{
      if(it.name.toLowerCase().includes(q)) results.push({icon:it.type==='folder'?'📁':'📄',label:it.name,sub:b.name,action:()=>{goBook(b.id);pushNav(it.id);}});
      if(it.type==='sheet') it.entries?.forEach(e=>{if(e.item.toLowerCase().includes(q)) results.push({icon:'💳',label:e.item,sub:fmt(e.amount,e.currency)+'·'+it.name,action:()=>{goBook(b.id);pushNav(it.id);}});});
      if(it.type==='folder') walk(it.items);
    });}
    walk(b.rootItems);
  });
  if (!results.length) return;
  const div = document.createElement('div');
  div.id = 'pcSearchResults'; div.className = 'pc-search-results';
  div.innerHTML = results.slice(0,8).map((r,i)=>`
    <div class="search-result-item" onclick="window._sa[${i}]();document.getElementById('pcSearchInput').value='';document.getElementById('pcSearchResults')?.remove()">
      <span style="font-size:18px">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
        <div style="font-size:11px;color:var(--text3)">${r.sub}</div>
      </div>
    </div>`).join('');
  window._sa = results.slice(0,8).map(r=>r.action);
  document.querySelector('.main-area').appendChild(div);
  setTimeout(()=>{ document.addEventListener('click',function h(e){ if(!div.contains(e.target)){div.remove();document.removeEventListener('click',h);}}); },10);
}

function openCalcFloat() {
  const el = document.getElementById('calcFloat');
  if (el.style.display !== 'none') { closeCalcFloat(); return; }
  el.style.display = 'block';
  el.style.right = 'auto';
  el.style.left = Math.max(20, window.innerWidth - 360) + 'px';
  el.style.top = '80px';
  renderCalc(document.getElementById('calcFloatBody'));
}
function closeCalcFloat() {
  document.getElementById('calcFloat').style.display = 'none';
}
// 浮動計算機拖曳
(function() {
  let dragging = false, offX = 0, offY = 0;
  document.addEventListener('mousedown', e => {
    const hdr = e.target.closest('#calcFloatHeader');
    if (!hdr) return;
    const el = document.getElementById('calcFloat');
    if (el.style.display === 'none') return;
    dragging = true;
    const r = el.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const el = document.getElementById('calcFloat');
    el.style.left = (e.clientX - offX) + 'px';
    el.style.top = (e.clientY - offY) + 'px';
    el.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
})();

// ── renderCalc：按鍵完全對照 APP 版 ──
function renderCalc(container) {
  container.innerHTML = `
    <div style="width:100%">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;
                    padding:12px 14px;margin-bottom:10px;min-height:64px;display:flex;flex-direction:column;justify-content:flex-end">
          <div id="calcExpr" style="font-size:12px;color:var(--text3);min-height:17px;
               font-family:'JetBrains Mono',monospace;margin-bottom:3px;text-align:right"></div>
          <div id="calcDisp" style="font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;
               color:var(--primary);text-align:right;line-height:1.1">0</div>
        </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;min-height:220px">
        <button onclick="calcPress('⌫')" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;cursor:pointer;transition:transform .1s;user-select:none;grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:center;padding:12px 0"
          onmousedown="this.style.transform='scale(.93)'" onmouseup="this.style.transform=''">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    style="background:${bg};border:1px solid var(--border);border-radius:6px;
           padding:12px 0;font-size:21px;font-weight:700;color:${col};
           font-family:'Inter',sans-serif;cursor:pointer;transition:transform .1s;user-select:none;${extra}"
    onmousedown="this.style.transform='scale(.93)'" onmouseup="this.style.transform=''"
  >${k}</button>`;
}

// ── renderSettings：置中包裝，完全對照 APP 版結構 ──
function renderSettings(main) {
  const s = state.settings;
  const langs = [['zh-TW','繁體中文'],['zh-CN','简体中文'],['en','English'],['ja','日本語'],['ko','한국어']];
  const curLang = langs.find(([c]) => c === s.lang)?.[1] || '繁體中文';

  main.innerHTML = `
    <div style="display:flex;justify-content:center;padding:10px 0">
      <div style="width:400px">
        <div class="tab-title" style="font-size:18px;font-weight:800;margin-bottom:2px">設定</div>
        <div class="tab-sub" style="font-size:12px;color:var(--text3);margin-bottom:20px">個人化您的帳本體驗</div>

        <div class="section-label">語言</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px;overflow:hidden">
          <div onclick="toggleLangDropdown()"
            style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;cursor:pointer;font-size:15px;font-weight:600">
            <span id="langCurrentLabel">${curLang}</span>
            <svg id="langChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 style="transition:transform .2s;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div id="langDropdown" style="display:none;border-top:1px solid var(--border)">
            ${langs.map(([code,label]) => `
              <div onclick="setLang('${code}')"
                style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;
                       font-size:14px;font-weight:500;cursor:pointer;
                       background:${s.lang===code?'var(--primary-dim)':'transparent'};
                       color:${s.lang===code?'var(--primary)':'var(--text2)'};
                       border-bottom:1px solid var(--border)">
                ${label}
                ${s.lang===code?'<div style="width:8px;height:8px;border-radius:50%;background:var(--primary)"></div>':''}
              </div>`).join('')}
          </div>
        </div>

        <div class="section-label">字體大小</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">文字大小</div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px">目前：${s.fontSize}px</div>
            </div>
            <div class="stepper">
              <button class="stepper-btn" onclick="setFontSize(${s.fontSize-1})">−</button>
              <div class="stepper-val">${s.fontSize}</div>
              <button class="stepper-btn" onclick="setFontSize(${s.fontSize+1})">+</button>
            </div>
          </div>
        </div>

        <div class="section-label">顯示顏色</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px">
          ${[['文字顏色','textColor'],['金額顏色','amountColor'],['背景顏色','bgColor']].map(([label,key],i,arr) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;${i<arr.length-1?'border-bottom:1px solid var(--border)':''}">
              <div style="font-size:14px;font-weight:600;color:var(--text)">${label}</div>
              <div style="background:${s[key]||'#FFF'};width:32px;height:32px;
                   border-radius:8px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0"
                   onclick="openColorPicker('${key}','${label}')"></div>
            </div>`).join('')}
        </div>

        <button onclick="resetSettings()"
          style="width:100%;padding:13px;background:transparent;
                 border:1.5px solid var(--border2);border-radius:var(--radius-sm);
                 color:var(--text2);font-size:14px;font-weight:600;
                 font-family:'Inter',sans-serif;cursor:pointer;transition:all .18s"
          onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
          onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text2)'">
          恢復初始設定
        </button>
      </div>
    </div>

    <!-- 調色盤 Modal（與 APP 版完全相同）-->
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
        <div id="colorCanvas"
          style="width:100%;height:190px;border-radius:12px;margin-bottom:14px;position:relative;
                 cursor:crosshair;border:1px solid var(--border);
                 background:linear-gradient(to bottom,transparent,#000),linear-gradient(to right,#fff,hsl(120,100%,50%))"
          onmousedown="startCanvasDrag(event)" ontouchstart="startCanvasDrag(event)">
          <div id="cpDot" style="position:absolute;width:18px;height:18px;border-radius:50%;
               border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.6);
               transform:translate(-50%,-50%);pointer-events:none;top:20%;left:80%"></div>
        </div>
        <input type="range" id="hueSlider" min="0" max="360" value="120" oninput="onHueChange()"
          style="width:100%;height:18px;border-radius:9px;outline:none;cursor:pointer;
                 background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);
                 -webkit-appearance:none;margin-bottom:10px;border:none">
        <input type="range" id="alphaSlider" min="0" max="100" value="100" oninput="onAlphaChange()"
          style="width:100%;height:18px;border-radius:9px;outline:none;cursor:pointer;
                 -webkit-appearance:none;margin-bottom:18px;border:none;
                 background:linear-gradient(to right,transparent,hsl(120,100%,50%))">
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
