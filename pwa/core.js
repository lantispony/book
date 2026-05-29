/* ═══════════════════════════════════════════════
   共用帳本 — core.js  v2.0  (共用邏輯)
   資料模型：
   user:  { id, name, nickname, email, gender, phone,
            birthday, avatarDataUrl, lang, createdAt }
   book:  { id, name, desc, currency, members[],
            payMethods[], rootItems[], inviteCode, createdAt }
   folder:{ id, type:'folder', name, desc, items[] }
   sheet: { id, type:'sheet',  name, desc, entries[] }
   entry: { id, item, date, amount, currency, type,
            payMethod, payer, note, createdBy, createdAt }
═══════════════════════════════════════════════ */

// ── 幣別常數（全域）──
const NO_DECIMAL_CURRENCIES = new Set(['JPY','KRW','TWD','CNY','VND','IDR','CLP','HUF']);
const CURRENCY_SYMBOLS = {
  TWD:'NT$', USD:'$', JPY:'¥', EUR:'€', GBP:'£',
  CNY:'¥', KRW:'₩', HKD:'HK$', AUD:'A$', SGD:'S$',
  CAD:'C$', CHF:'Fr', MXN:'MX$', INR:'₹', BRL:'R$',
};

// ── STATE ──
let currentUser = null;
let state = { books: [], managedMembers: [], settings: { lang:'zh-TW', fontSize:16, textColor:'#FFFFFF', amountColor:'#A8FF00', bgColor:'#121212' }, ownedBooks: [], joinedBooks: [] };
let nav   = { path: [], tab: 'home' };
let heroDisplayCurrency = 'TWD';

let ctxTarget        = null;
let confirmCb        = null;
let renameCb         = null;
let newItemType      = 'sheet';

const DEFAULT_SETTINGS = { lang:'zh-TW', fontSize:16, textColor:'#FFFFFF', amountColor:'#A8FF00', bgColor:'#121212' };

// ════════════════════════════════
// STORAGE — Firebase Firestore
// ════════════════════════════════
async function saveState() {
  if (!currentUser?.uid) return;
  // localStorage 雙重備份（不覆蓋既有資料）
  try {
    if (state.books.length === 0) {
      const existing = localStorage.getItem('monest-backup-' + currentUser.uid);
      if (existing) { console.log('[State] skip localStorage save - books empty, backup exists'); }
    }
    if (state.books.length > 0 || !localStorage.getItem('monest-backup-' + currentUser.uid)) {
      const backup = {
        ownedBooks: state.ownedBooks || [],
        joinedBooks: state.joinedBooks || [],
        managedMembers: state.managedMembers || [],
        settings: state.settings,
        books: state.books,
        user: {
          nickname: currentUser.nickname || '',
          lang: currentUser.lang || 'zh-TW',
          avatarDataUrl: currentUser.avatarDataUrl || ''
        }
      };
      localStorage.setItem('monest-backup-' + currentUser.uid, JSON.stringify(backup));
      console.log('[State] localStorage saved, books:', state.books.length);
    }
  } catch(e) { console.error('[State] localStorage save error:', e); }
  try {
    const batch = db.batch();
    batch.set(db.collection('users').doc(currentUser.uid), {
      email: currentUser.email || '',
      nickname: currentUser.nickname || '',
      photoURL: currentUser.photoURL || '',
      avatarDataUrl: currentUser.avatarDataUrl || '',
      lang: currentUser.lang || 'zh-TW',
      ownedBooks: state.ownedBooks || [],
      joinedBooks: state.joinedBooks || [],
      managedMembers: state.managedMembers || [],
      settings: state.settings
    }, { merge: true });
    state.books.forEach(book => {
      if (!book.owner) book.owner = currentUser.uid;
      if (!book.memberUids) book.memberUids = [currentUser.uid];
      if (!book.memberInfo) book.memberInfo = { [currentUser.uid]: { name: currentUser.name || '', nickname: currentUser.nickname || '', photoURL: currentUser.photoURL || '' } };
      batch.set(db.collection('books').doc(book.id), book, { merge: true });
    });
    await batch.commit();
  } catch(e) {
    console.error('Firestore save error:', e);
  }
}

async function loadState() {
  if (!currentUser?.uid) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.avatarDataUrl) currentUser.avatarDataUrl = data.avatarDataUrl;
      if (data.lang) currentUser.lang = data.lang;
      state.ownedBooks = data.ownedBooks || [];
      state.joinedBooks = data.joinedBooks || [];
      state.managedMembers = data.managedMembers || [];
      if (data.settings) state.settings = { ...state.settings, ...data.settings };

      // Load books from individual docs
      const allIds = [...state.ownedBooks, ...state.joinedBooks];
      if (allIds.length) {
        const snap = await db.collection('books').where('__name__', 'in', allIds).get();
        state.books = [];
        snap.forEach(d => state.books.push(d.data()));
      } else if (data.data?.books) {
        // Legacy migration: books embedded in user doc
        state.books = data.data.books;
        state.ownedBooks = state.books.map(b => b.id);
        state.settings = { ...state.settings, ...(data.data.settings || {}) };
        state.managedMembers = data.data.managedMembers || [];
        await migrateLegacyBooks();
        await saveState();
      }
    }
    // 只有確實讀到帳簿才視為成功，否則往下走 localStorage 備援
    if (state.books.length > 0) return;
  } catch(e) {
    console.error('Firestore load error:', e);
  }
  // Firestore 沒讀到資料時從 localStorage 備援
  try {
    const raw = localStorage.getItem('monest-backup-' + currentUser.uid);
    if (raw) {
      const backup = JSON.parse(raw);
      state.ownedBooks = backup.ownedBooks || [];
      state.joinedBooks = backup.joinedBooks || [];
      state.managedMembers = backup.managedMembers || [];
      state.books = backup.books || [];
      if (backup.settings) state.settings = { ...state.settings, ...backup.settings };
      if (backup.user) {
        if (backup.user.nickname) currentUser.nickname = backup.user.nickname;
        if (backup.user.lang) currentUser.lang = backup.user.lang;
        if (backup.user.avatarDataUrl) currentUser.avatarDataUrl = backup.user.avatarDataUrl;
      }
      console.log('[State] Loaded from localStorage backup');
    }
  } catch(e) {
    console.error('localStorage load error:', e);
  }
}

async function saveUser() {
  if (!currentUser) return;
  try {
    localStorage.setItem('monest-user-' + (currentUser.uid || currentUser.id), JSON.stringify(currentUser));
  } catch(e) {}
}
async function loadUser() {
  try {
    const raw = localStorage.getItem('monest-user-' + (currentUser?.uid || currentUser?.id || ''));
    if (raw) { currentUser = JSON.parse(raw); return true; }
  } catch(e) {}
  return false;
}

async function migrateLegacyBooks() {
  for (const book of state.books) {
    book.owner = currentUser.uid;
    book.memberUids = [currentUser.uid];
    book.memberInfo = { [currentUser.uid]: { name: currentUser.name || '', nickname: currentUser.nickname || '' } };
    await db.collection('books').doc(book.id).set(book);
  }
}

function migrateLocalStorage() {
  try {
    const raw = localStorage.getItem('xpense-state-v3');
    if (raw) {
      const d = JSON.parse(raw);
      if (d.books) state.books = d.books;
      if (d.settings) state.settings = { ...state.settings, ...d.settings };
      localStorage.removeItem('xpense-state-v3');
      localStorage.removeItem('xpense-user');
      return true;
    }
  } catch(e) {}
  return false;
}

// ════════════════════════════════
// EMAILJS — 寄送邀請信
// ════════════════════════════════
const EMAILJS_CONFIG = {
  publicKey: '_h7dnulx2CNyRR4sM',
  serviceId: 'service_taj0oiq',
  templateId: 'template_xkios88'
};

async function sendBookInvite(email, bookName, inviterName, inviteLink) {
  try {
    const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_CONFIG.serviceId,
        template_id: EMAILJS_CONFIG.templateId,
        user_id: EMAILJS_CONFIG.publicKey,
        template_params: {
          to_email: email,
          to_name: email.split('@')[0],
          from_name: inviterName,
          book_name: bookName,
          invite_link: inviteLink
        }
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('EmailJS API error:', resp.status, text);
      return false;
    }
    return true;
  } catch(e) {
    console.error('EmailJS fetch error:', e);
    return false;
  }
}

// ════════════════════════════════
// FIREBASE AUTH
// ════════════════════════════════
function setCurrentUserFromFirebase(user) {
  if (!user) { currentUser = null; return; }
  currentUser = {
    uid: user.uid,
    name: user.displayName || '',
    nickname: user.displayName || user.email?.split('@')[0] || '使用者',
    email: user.email || '',
    photoURL: user.photoURL || '',
    createdAt: user.metadata?.creationTime || new Date().toISOString()
  };
}

// ════════════════════════════════
// GREETING
// ════════════════════════════════
function getGreeting(lang) {
  const h = new Date().getHours();
  const greetings = {
    'zh-TW': h < 12 ? '早安 👋' : h < 18 ? '午安 👋' : '晚安 👋',
    'zh-CN': h < 12 ? '早安 👋' : h < 18 ? '午安 👋' : '晚安 👋',
    'en':    h < 12 ? 'Good morning 👋' : h < 18 ? 'Good afternoon 👋' : 'Good evening 👋',
    'ja':    h < 12 ? 'おはようございます 👋' : h < 18 ? 'こんにちは 👋' : 'こんばんは 👋',
    'ko':    h < 12 ? '좋은 아침이에요 👋' : h < 18 ? '안녕하세요 👋' : '좋은 저녁이에요 👋',
  };
  return greetings[lang] || greetings['zh-TW'];
}

// ════════════════════════════════
// SETTINGS APPLY
// ════════════════════════════════
function applySettings() {
  const s = state.settings;
  document.documentElement.style.setProperty('--text',    s.textColor   || '#FFFFFF');
  document.documentElement.style.setProperty('--primary', s.amountColor || '#A8FF00');
  document.documentElement.style.setProperty('--bg',      s.bgColor     || '#121212');
  document.body.style.fontSize = (s.fontSize || 16) + 'px';
}

// ════════════════════════════════
// NAV HELPERS
// ════════════════════════════════
function currentBook()  { return state.books.find(b => b.id === nav.path[0]); }
function currentNode() {
  const book = currentBook(); if (!book) return null;
  let list = book.rootItems, node = null;
  for (let i = 1; i < nav.path.length; i++) {
    node = list.find(x => x.id === nav.path[i]);
    if (!node) return null;
    if (node.type === 'folder') list = node.items;
  }
  return node;
}
function currentItemsList() {
  if (!nav.path.length) return null;
  const book = currentBook(); if (!book) return null;
  if (nav.path.length === 1) return book.rootItems;
  const node = currentNode();
  return node?.type === 'folder' ? node.items : null;
}
function findParentArray(id) {
  const book = currentBook(); if (!book) return null;
  function s(list) {
    for (const it of list) {
      if (it.id === id) return list;
      if (it.type === 'folder') { const r = s(it.items); if (r) return r; }
    }
    return null;
  }
  return s(book.rootItems);
}
function findItemAnywhere(id) {
  const book = currentBook(); if (!book) return null;
  function s(list) {
    for (const it of list) {
      if (it.id === id) return it;
      if (it.type === 'folder') { const r = s(it.items); if (r) return r; }
    }
    return null;
  }
  return s(book.rootItems);
}
function findEntryAnywhere(entryId) {
  const book = currentBook(); if (!book) return null;
  function s(list) {
    for (const it of list) {
      if (it.type === 'sheet') {
        const e = it.entries.find(e => e.id === entryId);
        if (e) return e;
      }
      if (it.type === 'folder') { const r = s(it.items); if (r) return r; }
    }
    return null;
  }
  return s(book.rootItems);
}

function goHome()    { nav.path = [];                     nav.tab = 'home'; render(); }
function goBook(id)  { nav.path = [id];                   nav.tab = 'home'; render(); }
function goDepth(d)  { nav.path = nav.path.slice(0, d+1); render(); }
function pushNav(id) { nav.path.push(id); render(); }

function getSheet() {
  const node = currentNode();
  return node?.type === 'sheet' ? node : null;
}
function getMemberPhoto(book, memberName) {
  if (!book?.memberInfo) return '';
  const lc = memberName.toLowerCase();
  for (const uid of Object.keys(book.memberInfo)) {
    const info = book.memberInfo[uid];
    if ((info.name && info.name.toLowerCase() === lc) || (info.nickname && info.nickname.toLowerCase() === lc)) {
      if (info.photoURL) return info.photoURL;
    }
  }
  if (currentUser && (memberName === currentUser.nickname || memberName === currentUser.name)) {
    return currentUser.photoURL || '';
  }
  return '';
}

// 幣別切換
function cycleHeroCurrency() {
  const currencies = ['TWD','USD','JPY','EUR','CNY','KRW','HKD','GBP'];
  const idx = currencies.indexOf(heroDisplayCurrency);
  heroDisplayCurrency = currencies[(idx + 1) % currencies.length];
  render();
}

function toggleCloseItem(itemId) {
  const item = findItemAnywhere(itemId); if (!item) return;
  if (item.closed) {
    item.closed = false; item.closedAt = null;
    toast((item.type === 'folder' ? '資料夾' : '帳本') + '已重新開啟', 'success');
  } else {
    const now = new Date();
    item.closedAt = now.getFullYear() + '/' +
      String(now.getMonth()+1).padStart(2,'0') + '/' +
      String(now.getDate()).padStart(2,'0') + ' ' +
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0');
    item.closed = true;
    toast((item.type === 'folder' ? '資料夾' : '帳本') + '已關閉', 'success');
  }
  saveState(); render();
}

function syncToManagedMembers(name) {
  if (!state.managedMembers) state.managedMembers = [];
  const me = currentUser?.nickname || currentUser?.name;
  if (name === me) return;
  if (state.managedMembers.some(m => m.toLowerCase() === name.toLowerCase())) return;
  state.managedMembers.push(name);
  saveState();
}

function getGlobalMemberHistory() {
  const all = new Set();
  const me = currentUser?.nickname || currentUser?.name;
  state.books.forEach(b => {
    b.members?.forEach(m => { if (m !== me) all.add(m); });
    function walkItems(list) {
      list?.forEach(it => {
        it.members?.forEach(m => { if (m !== me) all.add(m); });
        if (it.type === 'folder') walkItems(it.items);
      });
    }
    walkItems(b.rootItems);
  });
  const managed = state.managedMembers || [];
  managed.forEach(m => { if (m !== me) all.add(m); });
  return [...all].sort();
}

// ════════════════════════════════
// SETTLEMENT — 結算核心
// ════════════════════════════════

// 判斷某成員是否應該分攤某筆帳目
function shouldShare(member, entry, joinTimes, sheetCreatedDate, rawJoinISO) {
  const jDate = joinTimes[member];
  const eDate = entry.date;
  if (!rawJoinISO[member] && jDate === sheetCreatedDate) return true;
  if (jDate < eDate) return true;
  if (jDate > eDate) return false;
  const rawJ = rawJoinISO[member];
  if (!rawJ || rawJ.length <= 10) return true;
  const joinTs  = new Date(rawJ).getTime();
  const entryTs = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
  return entryTs >= joinTs;
}

// 取得 A↔B 的 key
function getPair(creditor, debtor, pairBalances) {
  const k1 = `${creditor}→${debtor}`;
  const k2 = `${debtor}→${creditor}`;
  if (!(k1 in pairBalances) && !(k2 in pairBalances)) pairBalances[k1] = 0;
  return k1 in pairBalances ? k1 : k2;
}

// ════════════════════════════════
// STAT HELPERS
// ════════════════════════════════
function animateNumber(id, target, duration, currency) {
  const el = document.getElementById(id); if (!el) return;
  const c   = currency || heroDisplayCurrency || 'TWD';
  const noDecimal = NO_DECIMAL_CURRENCIES.has(c);
  const start = performance.now();
  const fmtN  = n => {
    const val = noDecimal ? Math.ceil(n) : Math.ceil(n * 100) / 100;
    return noDecimal
      ? val.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
      : val.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  function step(now) {
    const pct = Math.min((now - start) / duration, 1), ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = fmtN(target * ease);
    if (pct < 1) requestAnimationFrame(step); else el.textContent = fmtN(target);
  }
  requestAnimationFrame(step);
}
function countBookStats(book) {
  let entries = 0, total = 0;
  function w(list) { list.forEach(i => { if (i.type === 'sheet') { entries += i.entries.length; i.entries.forEach(e => total += (parseFloat(e.amount) || 0)); } else w(i.items); }); }
  w(book.rootItems); return { entries, total };
}
function countFolderStats(folder) {
  let entries = 0, total = 0;
  function w(list) { list.forEach(i => { if (i.type === 'sheet') { entries += i.entries.length; i.entries.forEach(e => total += (parseFloat(e.amount) || 0)); } else w(i.items); }); }
  w(folder.items); return { entries, total };
}

// ════════════════════════════════
// UTILITIES
// ════════════════════════════════
function uid()    { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
function today()  { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmt(amount, currency) {
  const c = currency || 'TWD';
  const n = parseFloat(amount) || 0;
  const noDecimal = NO_DECIMAL_CURRENCIES.has(c);
  const sym = CURRENCY_SYMBOLS[c] || c + ' ';
  const val = noDecimal
    ? Math.ceil(n)
    : Math.ceil(n * 100) / 100;
  const str = noDecimal
    ? val.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
    : val.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sym + str;
}
function toast(msg, type = 'info', focusId, position) {
  if (type !== 'error' && type !== 'success' && type !== 'info') return;
  if (document.querySelectorAll('.toast').length) return;
  const t = document.createElement('div'); t.className = `toast ${type}`;
  t.innerHTML = `<span>${msg}</span>`;
  if (position === 'above' && focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      el.style.borderColor = 'var(--red)';
      el.style.boxShadow = 'none';
      const clear = () => { el.style.borderColor = ''; el.style.boxShadow = ''; el.removeEventListener('input', clear); el.removeEventListener('blur', clear); };
      el.addEventListener('input', clear); el.addEventListener('blur', clear);
      document.body.appendChild(t);
      t.style.position = 'fixed';
      t.style.left = '0';
      t.style.top = '0';
      t.style.zIndex = '801';
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const tw = t.offsetWidth;
        const th = t.offsetHeight;
        const l = Math.max(8, Math.min(window.innerWidth - tw - 8, rect.left + rect.width / 2 - tw / 2));
        t.style.left = l + 'px';
        t.style.top = Math.max(8, rect.top - th - 12) + 'px';
      });
      setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
      return;
    }
  }
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      el.style.borderColor = 'var(--red)';
      el.style.boxShadow = 'none';
      const clear = () => { el.style.borderColor = ''; el.style.boxShadow = ''; el.removeEventListener('input', clear); el.removeEventListener('blur', clear); };
      el.addEventListener('input', clear); el.addEventListener('blur', clear);
    }
  }
}

// ════════════════════════════════
// CRUD — 純資料操作（不碰 DOM／UI／render）
// ════════════════════════════════
// ════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════
// ════════════════════════════════
let _modalLockScrollY = 0;
function _modalPreventTouch(e) {
  const m = e.target.closest('.modal');
  if (!m || m.scrollHeight === m.clientHeight) e.preventDefault();
}
function openModal(id, noFocus) {
  if (typeof closeAllEntryDropdowns === 'function') closeAllEntryDropdowns();
  _modalLockScrollY = window.scrollY;
  document.getElementById(id).classList.add('open');
  document.body.classList.add('modal-lock');
  document.body.style.top = -_modalLockScrollY + 'px';
  document.addEventListener('touchmove', _modalPreventTouch, { passive: false });
  if (!noFocus) {
    const firstInput = document.querySelector('#' + id + ' .modal-body input:not([type="hidden"]), #' + id + ' .modal-body textarea, #' + id + ' .modal-body select');
    if (firstInput) firstInput.focus();
  }
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.classList.remove('modal-lock');
  document.body.style.top = '';
  window.scrollTo(0, _modalLockScrollY);
  document.removeEventListener('touchmove', _modalPreventTouch, { passive: false });
}

function runConfirm() { if (confirmCb) { confirmCb(); confirmCb = null; } closeModal('modalConfirm'); }

// ════════════════════════════════
// SWIPE GESTURE
// ════════════════════════════════
function initSwipeBack() {
  const app = document.getElementById('app');
  let startX = 0, startY = 0, swiping = false;

  app.addEventListener('touchstart', e => {
    startX  = e.touches[0].clientX;
    startY  = e.touches[0].clientY;
    swiping = startX < 40;
  }, { passive: true });

  app.addEventListener('touchend', e => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dx > 80 && dy < 60) {
      if (nav.tab !== 'home') return;
      if (nav.path.length > 1) { goDepth(nav.path.length - 2); }
      else if (nav.path.length === 1) { goHome(); }
    }
    swiping = false;
  }, { passive: true });
}

// ════════════════════════════════
// RESET SETTINGS
// ════════════════════════════════
function resetSettings() {
  state.settings = { ...DEFAULT_SETTINGS };
  applySettings();
  saveState();
  render();
  toast('已恢復初始設定', 'success');
}

// ── CRUD 純資料操作 ──

function bookCreate(name, desc) {
  const me = currentUser?.nickname || currentUser?.name || '';
  const book = {
    id: uid(), name, desc: desc || '',
    currency: 'TWD',
    owner: currentUser?.uid,
    memberUids: [currentUser?.uid],
    memberInfo: currentUser ? { [currentUser.uid]: { name: currentUser.name || '', nickname: currentUser.nickname || '' } } : {},
    members: me ? [me] : [],
    payMethods: ['現金'],
    rootItems: [],
    inviteCode: uid(),
    createdAt: new Date().toISOString()
  };
  state.books.push(book);
  state.ownedBooks.push(book.id);
  saveState();
  return book;
}

function bookUpdate(bookId, name, desc) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return false;
  book.name = name;
  book.desc = desc || '';
  saveState();
  return true;
}

function bookDelete(bookId) {
  state.books = state.books.filter(b => b.id !== bookId);
  state.ownedBooks = state.ownedBooks.filter(id => id !== bookId);
  state.joinedBooks = state.joinedBooks.filter(id => id !== bookId);
  if (nav.path[0] === bookId) nav.path = [];
  saveState();
}

function itemCreate(name, desc, currency, members, type) {
  const now = new Date();
  const localDate = localDateString(now);
  const memberJoinTimes = {};
  members.forEach(m => { memberJoinTimes[m] = localDate; });
  const item = type === 'folder'
    ? { id: uid(), type: 'folder', name, desc: desc || '', items: [], createdAt: localDateTimeString(now), closed: false }
    : { id: uid(), type: 'sheet', name, desc: desc || '', currency, members, memberJoinTimes, entries: [], createdAt: localDateTimeString(now), closed: false };
  const list = currentItemsList();
  if (!list) return null;
  list.push(item);
  saveState();
  return item;
}

function itemUpdate(item, name, desc, currency, members, joinTimes) {
  item.name = name;
  item.desc = desc || '';
  if (item.type === 'sheet') {
    if (currency) item.currency = currency;
    if (members) {
      item.members = members;
      if (joinTimes) {
        if (!item.memberJoinTimes) item.memberJoinTimes = {};
        Object.assign(item.memberJoinTimes, joinTimes);
      }
    }
  }
  saveState();
}

function itemDelete(itemId) {
  const arr = findParentArray(itemId);
  if (arr) { const idx = arr.findIndex(x => x.id === itemId); if (idx >= 0) arr.splice(idx, 1); }
  if (nav.path.includes(itemId)) {
    nav.path = nav.path.slice(0, nav.path.indexOf(itemId));
  }
  saveState();
}

function entrySave(sheet, data, editId) {
  if (editId) {
    const idx = sheet.entries.findIndex(e => e.id === editId);
    if (idx >= 0) {
      data.id = editId;
      sheet.entries[idx] = data;
    }
  } else {
    data.id = uid();
    sheet.entries.push(data);
  }
  saveState();
}

function entryDelete(sheet, entryId) {
  sheet.entries = sheet.entries.filter(x => x.id !== entryId);
  saveState();
}

function bookMemberAdd(book, member, memberUid, photoURL) {
  if (!book.members) { book.members = []; book.memberUids = []; book.memberInfo = {}; }
  if (book.members.some(m => m.toLowerCase() === member.toLowerCase())) return false;
  book.members.push(member);
  if (memberUid && !book.memberUids.includes(memberUid)) {
    book.memberUids.push(memberUid);
    book.memberInfo[memberUid] = { name: member, nickname: member, photoURL: photoURL || '' };
  }
  saveState();
  return true;
}
function syncMemberName(book, uid, name) {
  if (!book.memberInfo) book.memberInfo = {};
  if (!book.memberInfo[uid]) book.memberInfo[uid] = {};
  book.memberInfo[uid].name = name;
  book.memberInfo[uid].nickname = name;
  // 取代 email 條目
  const oldIdx = book.members.findIndex(m => m.includes('@') && book.memberUids?.some((u,i) => u === uid && book.members[i] === m));
  if (oldIdx >= 0) book.members[oldIdx] = name;
}

function bookMemberRemove(book, index, me) {
  if (book.members[index] === me) return false;
  const removed = book.members[index];
  // Find and remove by uid if possible
  for (const uid of Object.keys(book.memberInfo || {})) {
    if (book.memberInfo[uid].name === removed || book.memberInfo[uid].nickname === removed) {
      book.memberUids = (book.memberUids || []).filter(u => u !== uid);
      delete book.memberInfo[uid];
      break;
    }
  }
  book.members.splice(index, 1);
  saveState();
  return true;
}

function payMethodAdd(book, name) {
  if (!book.payMethods) book.payMethods = ['現金'];
  if (book.payMethods.some(m => m.toLowerCase() === name.toLowerCase())) return false;
  book.payMethods.push(name);
  saveState();
  return true;
}

function payMethodRemove(book, index) {
  if (!book.payMethods || book.payMethods[index] === '現金') return false;
  book.payMethods.splice(index, 1);
  saveState();
  return true;
}

function managedMemberAdd(email) {
  if (!state.managedMembers) state.managedMembers = [];
  if (state.managedMembers.some(m => m.toLowerCase() === email.toLowerCase())) return false;
  state.managedMembers.push(email);
  saveState();
  return true;
}

function managedMemberRemove(email) {
  if (!state.managedMembers) return;
  const idx = state.managedMembers.indexOf(email);
  if (idx < 0) return;
  state.managedMembers.splice(idx, 1);
  saveState();
  return email;
}

// ════════════════════════════════
// INVITE — 接受邀請加入共用帳本
// ════════════════════════════════
async function acceptInvite(bookId, inviteCode) {
  try {
    const doc = await db.collection('books').doc(bookId).get();
    if (!doc.exists) { toast('邀請無效：帳本不存在', 'error'); return false; }
    const book = doc.data();
    if (book.inviteCode !== inviteCode) { toast('邀請碼不正確', 'error'); return false; }
    if (book.memberUids?.includes(currentUser.uid)) {
      if (!state.books.find(b => b.id === bookId)) state.books.push(book);
      if (!state.joinedBooks.includes(bookId)) state.joinedBooks.push(bookId);
      await saveState();
      toast('已加入帳本', 'success');
      return true;
    }
    // Add user to book
    if (!book.memberUids) book.memberUids = [];
    if (!book.memberInfo) book.memberInfo = {};
    if (!book.members) book.members = [];
    book.memberUids.push(currentUser.uid);
    book.memberInfo[currentUser.uid] = { name: currentUser.name || '', nickname: currentUser.nickname || '', photoURL: currentUser.photoURL || '' };
    syncMemberName(book, currentUser.uid, currentUser.nickname || currentUser.name || '');
    await db.collection('books').doc(bookId).set(book, { merge: true });
    state.joinedBooks.push(bookId);
    if (!state.books.find(b => b.id === bookId)) state.books.push(book);
    await saveState();
    toast('已加入帳本！', 'success');
    if (typeof startRealtimeSync === 'function') startRealtimeSync();
    if (typeof render === 'function') render();
    return true;
  } catch(e) {
    console.error('Invite error:', e);
    toast('接受邀請失敗', 'error');
    return false;
  }
}

function localDateString(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function localDateTimeString(d) {
  return d.getFullYear() + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

// ════════════════════════════════
// 即時同步 (Firestore onSnapshot)
// ════════════════════════════════
let _realtimeUnsubs = [];

function startRealtimeSync() {
  stopRealtimeSync();
  if (!currentUser?.uid) return;
  const bookIds = [...(state.ownedBooks||[]), ...(state.joinedBooks||[])];
  if (!bookIds.length) return;

  bookIds.forEach(bookId => {
    const unsub = db.collection('books').doc(bookId).onSnapshot(snap => {
      if (!snap.exists) return;
      const updated = snap.data();
      const idx = state.books.findIndex(b => b.id === bookId);
      if (idx >= 0) {
        state.books[idx] = updated;
      } else {
        state.books.push(updated);
        if (!state.joinedBooks.includes(bookId)) state.joinedBooks.push(bookId);
      }
      // 更新 localStorage 備份
      try {
        const raw = localStorage.getItem('monest-backup-' + currentUser.uid);
        if (raw) {
          const backup = JSON.parse(raw);
          backup.books = state.books;
          localStorage.setItem('monest-backup-' + currentUser.uid, JSON.stringify(backup));
        }
      } catch(e) {}
      if (typeof render === 'function') render();
    }, err => console.error('[Realtime] snapshot error:', err));
    _realtimeUnsubs.push(unsub);
  });
  console.log('[Realtime] listening to', bookIds.length, 'books');
}

function stopRealtimeSync() {
  _realtimeUnsubs.forEach(u => u());
  _realtimeUnsubs = [];
}

// 登入後更新成員自己的 Google 資料到帳本
async function updateMemberInfoInBooks() {
  if (!currentUser?.uid) return;
  const bookIds = [...(state.ownedBooks||[]), ...(state.joinedBooks||[])];
  for (const bookId of bookIds) {
    const book = state.books.find(b => b.id === bookId);
    if (!book) continue;
    if (book.memberUids?.includes(currentUser.uid)) {
      if (!book.memberInfo) book.memberInfo = {};
      book.memberInfo[currentUser.uid] = {
        name: currentUser.name || '',
        nickname: currentUser.nickname || '',
        photoURL: currentUser.photoURL || '',
        avatarDataUrl: currentUser.avatarDataUrl || ''
      };
      syncMemberName(book, currentUser.uid, currentUser.nickname || currentUser.name || '');
      try {
        await db.collection('books').doc(bookId).set({ memberInfo: book.memberInfo }, { merge: true });
      } catch(e) {}
    }
  }
}
