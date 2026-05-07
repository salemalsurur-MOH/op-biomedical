// ============================================
// لوحة الإنتاجية v2 - إدارة الصيانة الطبية
// ============================================

const STORAGE_KEY = 'med_maint_files_v2';
const PINS_KEY = 'med_maint_pins_v2';
const VIEW_KEY = 'med_maint_view_v2';
const CAT_KEY = 'med_maint_cats_v2';

// Default seed (migrated from v1 if available, else starter)
const DEFAULT_FILES = [
  { id:'f1', title:'نموذج طلب صيانة جهاز طبي', type:'form', category:'core', url:'', tags:['urgent'], desc:'استلام طلبات الصيانة من الأقسام' },
  { id:'f2', title:'متابعة تواقيع الخطابات الصادرة', type:'sheet', category:'core', url:'', tags:['daily'], desc:'سجل التواقيع اليومي' },
  { id:'f3', title:'سجل الأجهزة الطبية', type:'sheet', category:'monitoring', url:'', tags:[], desc:'الجرد الكامل' },
  { id:'f4', title:'مؤشرات الأداء الشهرية', type:'kpi', category:'monitoring', url:'', tags:['monthly','report'], desc:'KPIs' },
  { id:'f5', title:'تقرير الصيانة الوقائية', type:'sheet', category:'reports', url:'', tags:['weekly','report'], desc:'' },
  { id:'f6', title:'العقود السنوية', type:'sheet', category:'contracts', url:'', tags:[], desc:'' },
  { id:'w1', title:'بوابة موارد', type:'website', category:'websites', url:'https://hrsd.gov.sa', tags:[], desc:'الموارد البشرية' },
  { id:'w2', title:'بريد Outlook', type:'website', category:'websites', url:'https://outlook.office.com', tags:['daily'], desc:'البريد الرسمي' },
  { id:'w3', title:'بوابة وزارة الصحة', type:'website', category:'websites', url:'https://www.moh.gov.sa', tags:[], desc:'' },
  { id:'w4', title:'منصة مراسلات', type:'website', category:'websites', url:'', tags:[], desc:'' },
];

// Migrate from v1 if exists
function migrate() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  try {
    const v1 = localStorage.getItem('med_maint_files');
    if (v1) {
      const arr = JSON.parse(v1);
      // ensure tags field
      arr.forEach(f => { if (!f.tags) f.tags = []; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
  } catch(e){}
}
migrate();

let files = load(STORAGE_KEY, DEFAULT_FILES);
let pins = load(PINS_KEY, []);
let view = 'grid';
let currentFilter = 'all';
let currentSearch = '';
let editingId = null;

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch(e) { return def; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  if (window.firebaseSync && window.firebaseSync.ready) {
    window.firebaseSync.pushAll({ files, pins, categories });
  }
}

// ===== Type meta =====
const TYPE = {
  form:    { label:'نموذج',  cls:'t-form',    icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>' },
  sheet:   { label:'جدول',   cls:'t-sheet',   icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>' },
  kpi:     { label:'KPI',    cls:'t-kpi',     icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>' },
  doc:     { label:'مستند',   cls:'t-doc',     icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' },
  gdoc:    { label:'مستند',   cls:'t-gdoc',    icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' },
  pdf:     { label:'PDF',     cls:'t-pdf',     icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><text x="7.5" y="19" font-size="6.5" font-weight="700" font-family="Outfit, sans-serif" fill="currentColor" stroke="none">PDF</text></svg>' },
  website: { label:'موقع',    cls:'t-website', icon:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>' },
};

const CATEGORY_DEFAULTS = [
  { id:'core',        label:'أساسي' },
  { id:'monitoring',  label:'متابعة وتقييم' },
  { id:'reports',     label:'تقارير' },
  { id:'contracts',   label:'عقود' },
  { id:'documents',   label:'مستندات' },
  { id:'websites',    label:'مواقع' },
  { id:'other',       label:'أخرى' },
];

function loadCategories() {
  try {
    const raw = localStorage.getItem(CAT_KEY);
    if (!raw) return CATEGORY_DEFAULTS.slice();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return CATEGORY_DEFAULTS.slice();
    return arr;
  } catch { return CATEGORY_DEFAULTS.slice(); }
}
function saveCategories() {
  localStorage.setItem(CAT_KEY, JSON.stringify(categories));
  if (window.firebaseSync && window.firebaseSync.ready) {
    window.firebaseSync.pushAll({ files, pins, categories });
  }
}

let categories = loadCategories();

function CATEGORY_LABEL(id) {
  const c = categories.find(x => x.id === id);
  return c ? c.label : id;
}

const CATEGORY = {
  core:'أساسي', monitoring:'متابعة وتقييم', reports:'تقارير',
  contracts:'عقود', documents:'مستندات', websites:'مواقع', other:'أخرى'
};

// ===== Render =====
function render() {
  renderQuickAccess();
  renderTabCounts();
  renderResults();
}

function renderQuickAccess() {
  const grid = document.getElementById('qa-grid');
  const pinned = pins.map(id => files.find(f => f.id === id)).filter(Boolean);
  if (pinned.length === 0) {
    grid.innerHTML = `<div class="qa-empty" style="grid-column:1/-1;">
      <strong>لم تثبّت أي عناصر بعد</strong><br>
      اضغط على ⭐ بجانب أي ملف لتثبيته للوصول السريع
    </div>`;
    return;
  }
  grid.innerHTML = pinned.slice(0, 9).map((f, i) => {
    const t = TYPE[f.type] || TYPE.doc;
    return `<div class="qa-tile" onclick="openFile('${f.id}')" title="${esc(f.title)}">
      <span class="qa-num">${i+1}</span>
      <div class="qa-icon ${t.cls}">${t.icon}</div>
      <div class="qa-label">${esc(f.title)}</div>
    </div>`;
  }).join('');
}

function renderTabCounts() {
  const c = {
    all: files.length,
    form: files.filter(f=>f.type==='form').length,
    sheet: files.filter(f=>f.type==='sheet').length,
    kpi: files.filter(f=>f.type==='kpi').length,
    gdoc: files.filter(f=>f.type==='gdoc'||f.type==='doc').length,
    website: files.filter(f=>f.type==='website').length,
  };
  Object.entries(c).forEach(([k,v]) => {
    document.querySelectorAll(`[data-count="${k}"]`).forEach(el => el.textContent = v);
  });
}

function getFiltered() {
  let list = files;
  if (currentFilter !== 'all') {
    if (currentFilter === 'gdoc') list = list.filter(f=>f.type==='gdoc'||f.type==='doc');
    else list = list.filter(f=>f.type===currentFilter);
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(f =>
      (f.title||'').toLowerCase().includes(q) ||
      (f.desc||'').toLowerCase().includes(q) ||
      (f.tags||[]).some(t=>t.toLowerCase().includes(q))
    );
  }
  return list;
}

function renderResults() {
  const container = document.getElementById('results');
  const list = getFiltered();
  if (list.length === 0) {
    container.innerHTML = `<div class="empty">
      <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <div class="empty-title">لا توجد نتائج</div>
      <div class="empty-hint">جرّب كلمات بحث مختلفة أو غيّر الفلتر</div>
    </div>`;
    return;
  }
  // Group by category
  const groups = {};
  list.forEach(f => {
    const c = f.category || 'other';
    if (!groups[c]) groups[c] = [];
    groups[c].push(f);
  });
  const order = categories.map(c => c.id);
  // include any orphan groups (categories that no longer exist) at the end
  Object.keys(groups).forEach(k => { if (!order.includes(k)) order.push(k); });
  let html = '';
  order.forEach(cat => {
    if (!groups[cat]) return;
    html += renderGroup(CATEGORY_LABEL(cat), groups[cat]);
  });
  container.innerHTML = html;
}

function renderGroup(title, items) {
  const inner = `<div class="grid">${items.map(renderCard).join('')}</div>`;
  return `<div class="group">
    <div class="group-header">${esc(title)} <span class="count">${items.length}</span></div>
    ${inner}
  </div>`;
}

function renderRow(f) {
  const t = TYPE[f.type] || TYPE.doc;
  const has = !!(f.url && f.url.trim());
  const pinned = pins.includes(f.id);
  const tags = (f.tags||[]).map(tag => {
    const cls = ['urgent','weekly','report'].includes(tag) ? tag : '';
    return `<span class="row-tag ${cls}">${esc(tag)}</span>`;
  }).join('');
  return `<div class="row-item ${!has?'no-link':''}" onclick="openFile('${f.id}')">
    <div class="row-icon ${t.cls}">${t.icon}</div>
    <div class="row-main">
      <div class="row-title">${esc(f.title)}</div>
      <div class="row-meta">
        <span class="row-type ${t.cls}">${t.label}</span>
        ${f.desc ? `<span>· ${esc(f.desc)}</span>` : ''}
        ${tags ? `<div class="row-tags">${tags}</div>` : ''}
        ${!has ? `<span style="color:var(--warning)">⚠ بدون رابط</span>` : ''}
      </div>
    </div>
    <button class="row-pin ${pinned?'pinned':''}" onclick="event.stopPropagation();togglePin('${f.id}')" title="${pinned?'إلغاء التثبيت':'تثبيت'}">
      <svg fill="${pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    </button>
    <div class="row-actions">
      ${has ? `<button class="row-action" onclick="event.stopPropagation();copyLink('${f.id}')" title="نسخ الرابط">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>` : ''}
      <button class="row-action" onclick="event.stopPropagation();openEdit('${f.id}')" title="تعديل">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="row-action danger" onclick="event.stopPropagation();delFile('${f.id}')" title="حذف">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  </div>`;
}

function renderCard(f) {
  const t = TYPE[f.type] || TYPE.doc;
  const has = !!(f.url && f.url.trim());
  const pinned = pins.includes(f.id);
  return `<div class="card ${!has?'no-link':''}" onclick="openFile('${f.id}')">
    <div class="row-icon ${t.cls}" style="width:48px;height:48px;border-radius:11px;">${t.icon}</div>
    <div class="card-body">
      <div class="card-title">${esc(f.title)}</div>
      <div class="card-meta">
        <span class="row-type ${t.cls}">${t.label}</span>
        ${(f.tags||[]).slice(0,2).map(tag=>{
          const cls = ['urgent','weekly','report'].includes(tag) ? tag : '';
          return `<span class="row-tag ${cls}">${esc(tag)}</span>`;
        }).join('')}
      </div>
    </div>
    <button class="row-pin ${pinned?'pinned':''}" onclick="event.stopPropagation();togglePin('${f.id}')" style="position:absolute;top:6px;left:6px;">
      <svg fill="${pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    </button>
  </div>`;
}

// ===== Actions =====
function openFile(id) {
  const f = files.find(x=>x.id===id);
  if (!f) return;
  if (f.url && f.url.trim()) {
    window.open(f.url, '_blank');
  } else {
    toast('أضف الرابط أولاً', 'warn');
    openEdit(id);
  }
}

function togglePin(id) {
  const i = pins.indexOf(id);
  if (i >= 0) { pins.splice(i,1); toast('أُزيل من الوصول السريع'); }
  else {
    if (pins.length >= 9) { toast('الحد الأقصى 9 عناصر مثبتة', 'warn'); return; }
    pins.push(id); toast('أُضيف للوصول السريع', 'success');
  }
  save(); render();
}

function copyLink(id) {
  const f = files.find(x=>x.id===id);
  if (!f || !f.url) return;
  navigator.clipboard?.writeText(f.url).then(
    () => toast('نُسخ الرابط', 'success'),
    () => toast('تعذر النسخ', 'warn')
  );
}

function delFile(id) {
  if (!confirm('حذف هذا الملف؟')) return;
  files = files.filter(f=>f.id!==id);
  pins = pins.filter(p=>p!==id);
  save(); render();
  toast('حُذف', 'success');
}

function renderCategoryOptions() {
  const sel = document.getElementById('f-category');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = categories.map(c =>
    `<option value="${c.id}">${esc(c.label)}</option>`
  ).join('');
  if (current && categories.some(c => c.id === current)) sel.value = current;
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'إضافة ملف';
  document.getElementById('f-title').value = '';
  document.getElementById('f-type').value = 'form';
  renderCategoryOptions();
  document.getElementById('f-category').value = 'core';
  document.getElementById('f-url').value = '';
  document.getElementById('f-desc').value = '';
  document.querySelectorAll('.tag-pick input').forEach(c => c.checked = false);
  document.getElementById('modal').classList.add('open');
  setTimeout(()=>document.getElementById('f-title').focus(), 50);
}

function openEdit(id) {
  const f = files.find(x=>x.id===id);
  if (!f) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'تعديل';
  document.getElementById('f-title').value = f.title || '';
  document.getElementById('f-type').value = f.type || 'form';
  renderCategoryOptions();
  document.getElementById('f-category').value = f.category || 'core';
  document.getElementById('f-url').value = f.url || '';
  document.getElementById('f-desc').value = f.desc || '';
  document.querySelectorAll('.tag-pick input').forEach(c => {
    c.checked = (f.tags||[]).includes(c.value);
  });
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function saveFile() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { toast('الاسم مطلوب', 'warn'); return; }
  const data = {
    title,
    type: document.getElementById('f-type').value,
    category: document.getElementById('f-category').value,
    url: document.getElementById('f-url').value.trim(),
    desc: document.getElementById('f-desc').value.trim(),
    tags: Array.from(document.querySelectorAll('.tag-pick input:checked')).map(c=>c.value),
  };
  if (editingId) {
    const f = files.find(x=>x.id===editingId);
    Object.assign(f, data);
    toast('حُفظت التعديلات', 'success');
  } else {
    data.id = 'u' + Date.now().toString(36);
    files.push(data);
    toast('أُضيف الملف', 'success');
  }
  save(); render(); closeModal();
}

// ===== Help =====
function openHelp() { document.getElementById('help').classList.add('open'); }
function closeHelp() { document.getElementById('help').classList.remove('open'); }

// ===== Import / Export =====
function exportData() {
  const data = { files, pins, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `لوحة-الصيانة-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('تم التصدير', 'success');
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (Array.isArray(d)) { files = d; }
      else if (d.files) { files = d.files; if (d.pins) pins = d.pins; }
      save(); render(); toast('تم الاستيراد', 'success');
    } catch { toast('ملف غير صالح', 'warn'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ===== View =====
function setView(v) {
  // view toggle removed — grid only
}

// ===== Toast =====
let toastTimer;
function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2000);
}

// ===== Esc / utils =====
function esc(s) {
  return String(s||'').replace(/[&<>"']/g, ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

// ===== Wiring =====
document.getElementById('search').addEventListener('input', e => {
  currentSearch = e.target.value.trim();
  renderResults();
});
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderResults();
  });
});

// ===== Keyboard =====
document.addEventListener('keydown', e => {
  const isTyping = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
  // Esc always works
  if (e.key === 'Escape') {
    closeModal(); closeHelp();
    if (document.activeElement === document.getElementById('search')) {
      document.getElementById('search').blur();
    }
    return;
  }
  if (isTyping) return;

  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search').focus();
    document.getElementById('search').select();
  } else if (e.key === '?') {
    openHelp();
  } else if (e.key.toLowerCase() === 'n') {
    openAddModal();
  } else if (e.key.toLowerCase() === 'g') {
    // view toggle removed
  } else if (/^[1-9]$/.test(e.key)) {
    const idx = parseInt(e.key, 10) - 1;
    const id = pins[idx];
    if (id) openFile(id);
  }
});

// ===== Category management =====
function openCategoryManager() {
  const modal = document.getElementById('cat-modal');
  if (!modal) return;
  renderCategoryList();
  modal.classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('new-cat-input');
    if (inp) inp.focus();
  }, 50);
}
function closeCategoryManager() {
  const modal = document.getElementById('cat-modal');
  if (modal) modal.classList.remove('open');
}
function renderCategoryList() {
  const list = document.getElementById('cat-list');
  if (!list) return;
  list.innerHTML = categories.map(c => {
    const used = files.filter(f => f.category === c.id).length;
    return `<div class="cat-row" data-id="${c.id}">
      <button class="cat-handle" title="سحب لإعادة الترتيب">⋮⋮</button>
      <input class="cat-name" value="${esc(c.label)}" oninput="renameCategory('${c.id}', this.value)">
      <span class="cat-count">${used}</span>
      <button class="cat-del" onclick="removeCategory('${c.id}')" title="حذف" ${used > 0 ? 'data-used="1"' : ''}>
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`;
  }).join('');
}
function addCategory() {
  const inp = document.getElementById('new-cat-input');
  if (!inp) return;
  const label = inp.value.trim();
  if (!label) { toast('اكتب اسم المجموعة', 'warn'); return; }
  // Generate a unique id
  let baseId = 'cat_' + Date.now().toString(36);
  while (categories.some(c => c.id === baseId)) baseId += '_x';
  categories.push({ id: baseId, label });
  saveCategories();
  inp.value = '';
  renderCategoryList();
  renderCategoryOptions();
  render();
  toast('أُضيفت المجموعة', 'success');
}
function renameCategory(id, label) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  c.label = label.trim() || c.label;
  saveCategories();
  // live update group headers
  render();
  renderCategoryOptions();
}
function removeCategory(id) {
  const used = files.filter(f => f.category === id).length;
  if (used > 0) {
    if (!confirm(`هذه المجموعة مرتبطة بـ ${used} ملف. سيتم نقلهم إلى "أخرى". هل تريد المتابعة؟`)) return;
    files.forEach(f => { if (f.category === id) f.category = 'other'; });
    save();
  }
  // ensure 'other' fallback exists
  if (!categories.some(c => c.id === 'other')) {
    categories.push({ id:'other', label:'أخرى' });
  }
  categories = categories.filter(c => c.id !== id);
  saveCategories();
  renderCategoryList();
  renderCategoryOptions();
  render();
  toast('حُذفت المجموعة', 'success');
}

// ===== Firebase sync hooks =====
// firebase-sync.js calls these to push our local state up and to apply
// remote changes coming in from other devices.
window.appHooks = {
  getState: () => ({ files, pins, categories }),
  getFiles: () => files,
  getPins: () => pins,
  getCategories: () => categories,
  setFiles: (arr) => {
    if (!Array.isArray(arr)) return;
    files = arr;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    render();
  },
  setPins: (arr) => {
    if (!Array.isArray(arr)) return;
    pins = arr;
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
    render();
  },
  setCategories: (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    categories = arr;
    localStorage.setItem(CAT_KEY, JSON.stringify(categories));
    renderCategoryOptions();
    render();
  },
};

// Boot
render();
