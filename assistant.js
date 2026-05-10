// ============================================
// AI Task Assistant
// مساعد المهام الذكي — يفهم العربية الطبيعية
// ============================================

const TASKS_KEY = 'med_maint_tasks_v1';
let tasks = loadTasks();
let selectedTaskId = null;
let expandedTasks = new Set();
let archivedView = false;
let assistantBusy = false;

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
}
function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  if (window.firebaseSync && window.firebaseSync.pushTasks) {
    window.firebaseSync.pushTasks(tasks);
  }
}

function tuid() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function nowISO() { return new Date().toISOString(); }
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + parseInt(days, 10));
  return d.toISOString().slice(0,10);
}

// ===== Manual task creation =====
function addTaskManual() {
  const titleEl = document.getElementById('m-title');
  const prEl = document.getElementById('m-priority');
  const dlEl = document.getElementById('m-deadline');
  const title = (titleEl.value || '').trim();
  if (!title) { asstToast('اكتب عنوان المهمة', 'warn'); titleEl.focus(); return; }
  const now = nowISO();
  const t = {
    id: tuid(),
    title,
    priority: ['high','medium','low'].includes(prEl.value) ? prEl.value : 'medium',
    deadline: dlEl.value || null,
    status: 'open',
    archived: false,
    createdAt: now,
    updatedAt: now,
    actions: []
  };
  tasks.unshift(t);
  selectedTaskId = t.id;
  saveTasks();
  renderTasks();
  asstToast('أُنشئت المهمة', 'success');
  titleEl.value = '';
  dlEl.value = '';
  prEl.value = 'medium';
  titleEl.focus();
}

// ===== Manual action input =====
let actionTargetId = null;
function openActionInput(targetId) {
  const t = tasks.find(x => x.id === targetId && !x.archived);
  if (!t) return;
  actionTargetId = targetId;
  document.getElementById('ai-target-label').textContent = t.title;
  document.getElementById('ai-input').value = '';
  document.getElementById('action-input-wrap').classList.add('open');
  setTimeout(() => document.getElementById('ai-input').focus(), 50);
}
function closeActionInput() {
  actionTargetId = null;
  document.getElementById('action-input-wrap').classList.remove('open');
}
function submitActionInput() {
  if (!actionTargetId) return closeActionInput();
  const text = (document.getElementById('ai-input').value || '').trim();
  if (!text) { asstToast('اكتب نص الإجراء', 'warn'); return; }
  const t = tasks.find(x => x.id === actionTargetId);
  if (!t) return closeActionInput();
  const now = nowISO();
  t.actions = t.actions || [];
  t.actions.push({ id: tuid(), text, ts: now });
  t.updatedAt = now;
  expandedTasks.add(t.id);
  selectedTaskId = t.id;
  saveTasks();
  renderTasks();
  closeActionInput();
  asstToast('أُضيف الإجراء', 'success');
}

// Stub kept so old chip-bound onclick keeps working
async function handleAssistantSubmit() {}

async function parseCommand(text) {
  const taskList = tasks
    .filter(t => !t.archived)
    .map(t => `- ${t.id}: ${t.title}`)
    .join('\n') || '(لا توجد مهام)';
  const today = new Date().toISOString().slice(0,10);
  const sel = selectedTaskId || 'لا يوجد';

  const prompt = `أنت مساعد إداري عربي ذكي. حلّل أمر المستخدم وأرجع JSON فقط بدون أي شرح أو نص خارجي.

التاريخ اليوم: ${today}
المهام النشطة:
${taskList}
المهمة المحددة حالياً: ${sel}

أمر المستخدم: "${text}"

أرجع JSON بهذه البنية فقط:
{
  "intent": "create" أو "update" أو "complete" أو "unclear",
  "title": "عنوان قصير وواضح للمهمة الجديدة",
  "priority": "high" أو "medium" أو "low",
  "deadline_days": عدد الأيام من اليوم أو null,
  "target_id": "id المهمة عند التحديث/الإنهاء",
  "action_text": "نص الإجراء المختصر"
}

قواعد:
- إذا الأمر يصف مهمة جديدة (عندي/احتاج/يجب/أريد/مطلوب) → intent=create.
- إذا يصف متابعة على مهمة موجودة (تم/رددت/تواصلت/أرسلت/كلمت/اتصلت) → intent=update.
- إذا يصف إنهاء (انتهت/خلصت/اكتملت/أقفلت) → intent=complete.
- لإيجاد target_id طابق الكلمات في الأمر مع عناوين المهام؛ إذا لم تجد استخدم المهمة المحددة.
- استخرج deadline_days من عبارات مثل "خلال ٣ أيام"=3، "بكرة"=1، "أسبوع"=7، "شهر"=30. إذا لم تذكر، null.
- priority: "عاجل/ضروري/فوراً" → high، "مهم/قريباً" → medium، الباقي → low.
- اجعل title و action_text قصيرين ومركّزين (أقل من 80 حرف).`;

  const raw = await window.claude.complete(prompt);
  return extractJSON(raw);
}

function extractJSON(s) {
  if (!s) throw new Error('empty');
  const m = String(s).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]);
}

function applyResult(r, originalText) {
  if (!r || !r.intent || r.intent === 'unclear') {
    asstToast('ما استطعت فهم الأمر بدقة — جرّب وصفاً أوضح', 'warn');
    return;
  }
  const now = nowISO();

  if (r.intent === 'create') {
    const title = (r.title || '').trim() || originalText.slice(0, 80);
    const t = {
      id: tuid(),
      title,
      priority: ['high','medium','low'].includes(r.priority) ? r.priority : 'medium',
      deadline: (r.deadline_days != null && !isNaN(r.deadline_days)) ? addDays(r.deadline_days) : null,
      status: 'open',
      archived: false,
      createdAt: now,
      updatedAt: now,
      actions: []
    };
    tasks.unshift(t);
    selectedTaskId = t.id;
    expandedTasks.add(t.id);
    asstToast('أُنشئت المهمة', 'success');
    saveTasks();
    return;
  }

  let target = tasks.find(t => t.id === r.target_id && !t.archived);
  if (!target && selectedTaskId) target = tasks.find(t => t.id === selectedTaskId && !t.archived);
  if (!target) target = tasks.find(t => !t.archived);
  if (!target) { asstToast('لا توجد مهمة للتحديث', 'warn'); return; }

  if (r.intent === 'complete') {
    target.status = 'done';
    target.archived = true;
    target.updatedAt = now;
    target.actions = target.actions || [];
    target.actions.push({ id: tuid(), text: r.action_text || 'تم إنهاء المهمة', ts: now });
    asstToast('انتقلت المهمة للأرشيف', 'success');
  } else {
    target.actions = target.actions || [];
    target.actions.push({
      id: tuid(),
      text: (r.action_text || originalText).trim(),
      ts: now
    });
    target.updatedAt = now;
    expandedTasks.add(target.id);
    selectedTaskId = target.id;
    asstToast('أُضيف الإجراء', 'success');
  }
  saveTasks();
}

// ===== Render =====
function renderTasks() {
  const list = document.getElementById('asst-list');
  const empty = document.getElementById('asst-empty');
  if (!list || !empty) return;
  const search = (document.getElementById('asst-search')?.value || '').trim().toLowerCase();
  const sortBy = document.getElementById('asst-sort')?.value || 'date';

  let visible = tasks.filter(t => archivedView ? t.archived : !t.archived);
  if (search) {
    visible = visible.filter(t =>
      (t.title || '').toLowerCase().includes(search) ||
      (t.actions || []).some(a => (a.text || '').toLowerCase().includes(search))
    );
  }
  visible.sort((a, b) => {
    if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
    }
    if (sortBy === 'deadline') {
      const ad = a.deadline || '9999-12-31';
      const bd = b.deadline || '9999-12-31';
      return ad.localeCompare(bd);
    }
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  document.getElementById('asst-count-open').textContent = tasks.filter(t => !t.archived).length;
  document.getElementById('asst-count-arch').textContent = tasks.filter(t => t.archived).length;

  if (visible.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    empty.innerHTML = archivedView
      ? '<div style="font-size:30px;opacity:.4;margin-bottom:6px;">📦</div>الأرشيف فارغ'
      : '<div style="font-size:30px;opacity:.4;margin-bottom:6px;">✨</div>لا توجد مهام بعد — اكتب أمراً أعلاه لإنشاء أول مهمة';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = visible.map(renderTaskCard).join('');
}

// Extract a deadline date from action text (e.g., "يجب أن تنتهي بتاريخ ٢٠٢٦/٠٥/١٥",
// "تنتهي في 15-5-2026", "موعد الانتهاء 2026-05-15", "خلال X أيام/يوم")
function extractActionDeadline(actions) {
  if (!actions || !actions.length) return null;
  let found = null;
  const triggers = /(يجب\s+أن\s+تنتهي|ينتهي|تنتهي|الانتهاء|موعد\s+الانتهاء|الموعد\s+النهائي|قبل\s+تاريخ|بحلول|خلال)/;
  // Convert Arabic-Indic digits to ASCII
  const normalize = s => String(s||'').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  for (const a of actions) {
    const raw = normalize(a.text || '');
    if (!triggers.test(raw)) continue;
    // YYYY-MM-DD or YYYY/MM/DD
    let m = raw.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) {
      const iso = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
      found = { iso, ts: a.ts };
      continue;
    }
    // DD-MM-YYYY or DD/MM/YYYY
    m = raw.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) {
      const iso = `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      found = { iso, ts: a.ts };
      continue;
    }
    // "خلال N أيام/يوم"
    m = raw.match(/خلال\s+(\d+)\s*(يوم|يومين|أيام|ايام)/);
    if (m) {
      const days = parseInt(m[1], 10);
      const base = a.ts ? new Date(a.ts) : new Date();
      base.setDate(base.getDate() + days);
      found = { iso: base.toISOString().slice(0,10), ts: a.ts };
      continue;
    }
    if (/خلال\s+يومين/.test(raw)) {
      const base = a.ts ? new Date(a.ts) : new Date();
      base.setDate(base.getDate() + 2);
      found = { iso: base.toISOString().slice(0,10), ts: a.ts };
    }
  }
  return found;
}

function renderTaskCard(t) {
  const isExp = expandedTasks.has(t.id);
  const isSel = selectedTaskId === t.id;
  const today = new Date().toISOString().slice(0,10);
  const overdue = !t.archived && t.deadline && t.deadline < today;
  const dueSoon = !t.archived && t.deadline && t.deadline >= today &&
    (new Date(t.deadline) - new Date(today)) / 86400000 <= 2;
  const actionsCount = (t.actions || []).length;
  const prClass = ['high','medium','low'].includes(t.priority) ? t.priority : 'medium';
  const prLabel = { high: '🔥 عاجل', medium: '● متوسط', low: '○ منخفض' }[prClass];
  const isUrgent = prClass === 'high' && !t.archived;

  // Extract deadline mentioned in actions
  const actionDl = extractActionDeadline(t.actions);
  const actionOverdue = !t.archived && actionDl && actionDl.iso < today;
  const actionDueSoon = !t.archived && actionDl && actionDl.iso >= today &&
    (new Date(actionDl.iso) - new Date(today)) / 86400000 <= 2;

  const deadlineHtml = t.deadline
    ? `<span class="t-meta-item ${overdue?'overdue':dueSoon?'duesoon':''}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
         ${formatDate(t.deadline)}${overdue?' • متأخر':dueSoon?' • قريب':''}
       </span>`
    : '';
  const actionDlHtml = actionDl
    ? `<span class="t-action-dl ${actionOverdue?'overdue':actionDueSoon?'duesoon':''}" title="موعد الانتهاء المذكور في الإجراءات">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:12px;height:12px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
         موعد الانتهاء: ${formatDate(actionDl.iso)}${actionOverdue?' • متأخر':actionDueSoon?' • قريب':''}
       </span>`
    : '';
  const lastAction = (t.actions || []).slice(-1)[0];

  const actionsHtml = (t.actions || []).map(a => `
    <div class="t-action">
      <div class="t-action-dot"></div>
      <div class="t-action-body">
        <div class="t-action-text">${escAsst(a.text)}</div>
        <div class="t-action-time">${formatDateTime(a.ts)}</div>
      </div>
    </div>`).join('');

  const cardClasses = [
    isSel ? 'selected' : '',
    t.archived ? 'archived' : '',
    isUrgent ? 'urgent' : '',
    actionOverdue ? 'action-overdue' : ''
  ].filter(Boolean).join(' ');

  return `<div class="t-card ${cardClasses}" data-id="${t.id}" onclick="selectTask('${t.id}')">
    <div class="t-row">
      <button class="t-check ${t.status==='done'?'checked':''}" onclick="event.stopPropagation();toggleTaskDone('${t.id}')" title="${t.archived?'استرجاع':'إنهاء المهمة'}">
        ${t.status==='done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </button>
      <div class="t-main">
        <div class="t-title">${escAsst(t.title)}</div>
        <div class="t-meta">
          <span class="t-pr t-pr-${prClass}">${prLabel}</span>
          ${deadlineHtml}
          <span class="t-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formatDate(t.createdAt)}
          </span>
          ${actionsCount ? `<span class="t-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${actionsCount} إجراء
          </span>` : ''}
          ${actionDlHtml}
        </div>
        ${lastAction && !isExp ? `<div class="t-last-action">${escAsst(lastAction.text)}</div>` : ''}
      </div>
      <div class="t-tools">
        ${actionsCount ? `<button class="t-expand ${isExp?'open':''}" onclick="event.stopPropagation();toggleExpand('${t.id}')" title="${isExp?'إخفاء':'الإجراءات'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>` : ''}
        <button class="t-del" onclick="event.stopPropagation();deleteTask('${t.id}')" title="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
    ${isExp && actionsCount ? `<div class="t-actions">${actionsHtml}</div>` : ''}
  </div>`;
}

function selectTask(id) { selectedTaskId = id; renderTasks(); }

function toggleExpand(id) {
  if (expandedTasks.has(id)) expandedTasks.delete(id);
  else expandedTasks.add(id);
  renderTasks();
}

function toggleTaskDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  if (t.archived) {
    t.archived = false; t.status = 'open'; t.updatedAt = nowISO();
    asstToast('استُرجعت المهمة', 'success');
  } else {
    t.status = 'done'; t.archived = true; t.updatedAt = nowISO();
    asstToast('انتقلت للأرشيف', 'success');
  }
  saveTasks(); renderTasks();
}

function deleteTask(id) {
  if (!confirm('حذف المهمة نهائياً؟')) return;
  tasks = tasks.filter(t => t.id !== id);
  if (selectedTaskId === id) selectedTaskId = null;
  saveTasks(); renderTasks();
}

function toggleArchiveView() {
  archivedView = !archivedView;
  document.getElementById('asst-arch-btn').classList.toggle('active', archivedView);
  document.getElementById('asst-arch-label').textContent = archivedView ? 'العودة للنشطة' : 'الأرشيف';
  renderTasks();
}

function fillSuggestion(text) {
  const el = document.getElementById('asst-input');
  if (!el) return;
  el.value = text; el.focus(); autoSizeInput();
  // place cursor at the end
  const len = el.value.length;
  el.setSelectionRange(len, len);
}

// ===== Task picker (for "add action" chip) =====
function openTaskPicker() {
  const open = tasks.filter(t => !t.archived);
  const list = document.getElementById('picker-list');
  if (open.length === 0) {
    list.innerHTML = '<div class="picker-empty">لا توجد مهام نشطة. أنشئ مهمة أولاً.</div>';
  } else {
    const sorted = open.slice().sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
    list.innerHTML = sorted.map(t => {
      const pr = ['high','medium','low'].includes(t.priority) ? t.priority : 'medium';
      const dl = t.deadline ? `<span class="picker-item-meta">⏱ ${formatDate(t.deadline)}</span>` : '';
      return `<button class="picker-item" onclick="pickTaskForAction('${t.id}')">
        <span class="picker-item-pr ${pr}"></span>
        <span class="picker-item-title">${escAsst(t.title)}</span>
        ${dl}
      </button>`;
    }).join('');
  }
  document.getElementById('task-picker').classList.add('open');
}
function closeTaskPicker() {
  document.getElementById('task-picker').classList.remove('open');
}
// ===== Print =====
function printTasks() {
  const visibleTasks = tasks
    .filter(t => archivedView ? t.archived : !t.archived)
    .slice()
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      const oa = order[a.priority] ?? 1, ob = order[b.priority] ?? 1;
      if (oa !== ob) return oa - ob;
      return (a.deadline || '9999').localeCompare(b.deadline || '9999');
    });
  if (visibleTasks.length === 0) { asstToast('لا توجد مهام للطباعة', 'warn'); return; }

  const today = new Date().toLocaleDateString('ar-EG-u-ca-gregory', { year:'numeric', month:'long', day:'numeric' });
  const prLabel = { high:'عاجل', medium:'متوسط', low:'منخفض' };
  const title = archivedView ? 'تقرير المهام المؤرشفة' : 'تقرير المهام النشطة';

  const rowsHtml = visibleTasks.map((t, i) => {
    const actions = (t.actions || []).map(a =>
      `<li><span class="t-act-time">${formatDateTime(a.ts)}</span> — ${escAsst(a.text)}</li>`
    ).join('') || '<li class="t-no-act">لا توجد إجراءات مسجّلة</li>';
    return `
      <tr class="task-block">
        <td class="num">${i + 1}</td>
        <td class="task">
          <div class="task-title">${escAsst(t.title)}</div>
          <div class="task-meta">
            <span class="pr pr-${t.priority||'medium'}">الأولوية: ${prLabel[t.priority||'medium']}</span>
            <span>تاريخ الإنشاء: ${formatDate(t.createdAt)}</span>
            ${t.deadline ? `<span>الموعد النهائي: ${formatDate(t.deadline)}</span>` : ''}
            <span>الإجراءات: ${(t.actions||[]).length}</span>
            <span>الحالة: ${t.archived ? 'مؤرشفة' : (t.status==='done'?'منجزة':'نشطة')}</span>
          </div>
          <div class="actions-label">سجل الإجراءات:</div>
          <ol class="actions">${actions}</ol>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Cairo', Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.55; font-size: 12px; }
      .doc-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 2px solid #0E5A8A; margin-bottom: 14px; }
      .doc-head h1 { font-size: 18px; color: #0E5A8A; margin: 0 0 4px; }
      .doc-head .sub { font-size: 11px; color: #64748b; }
      .doc-head .meta { font-size: 11px; color: #64748b; text-align: left; }
      .doc-head .meta strong { color: #0f172a; display: block; font-size: 13px; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; }
      tr.task-block { page-break-inside: avoid; }
      td { padding: 10px 8px; border-bottom: 1px solid #e5e9ef; vertical-align: top; }
      td.num { width: 28px; font-weight: 700; color: #0E5A8A; font-size: 14px; text-align: center; padding-top: 12px; }
      .task-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
      .task-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: #475569; margin-bottom: 8px; }
      .pr { padding: 1px 8px; border-radius: 4px; font-weight: 700; font-size: 10.5px; }
      .pr-high   { background: #fee2e2; color: #991b1b; }
      .pr-medium { background: #dbeafe; color: #1e40af; }
      .pr-low    { background: #f1f5f9; color: #475569; }
      .actions-label { font-size: 11px; font-weight: 700; color: #334155; margin-top: 4px; }
      ol.actions { margin: 4px 16px 0; padding: 0; font-size: 11.5px; color: #334155; }
      ol.actions li { margin-bottom: 3px; }
      .t-act-time { color: #64748b; font-size: 10.5px; }
      .t-no-act { list-style: none; color: #94a3b8; font-style: italic; margin-right: -16px; }
      .doc-foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e9ef; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
      @media print { .no-print { display: none; } }
      .toolbar { position: fixed; top: 12px; left: 12px; background: #0E5A8A; color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; border: 0; font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
    </style></head><body>
    <button class="toolbar no-print" onclick="window.print()">🖨 طباعة الآن</button>
    <div class="doc-head">
      <div>
        <h1>${title}</h1>
        <div class="sub">إدارة الصيانة الطبية — تجمع حفر الباطن الصحي</div>
      </div>
      <div class="meta">
        <strong>${today}</strong>
        إجمالي المهام: ${visibleTasks.length}
      </div>
    </div>
    <table><tbody>${rowsHtml}</tbody></table>
    <div class="doc-foot">
      <div>تصميم: م. سالم بن عوض السرور</div>
      <div>تجمع حفر الباطن الصحي © 2026</div>
    </div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { asstToast('فعّل النوافذ المنبثقة للطباعة', 'warn'); return; }
  w.document.write(html);
  w.document.close();
}

function pickTaskForAction(id) {
  closeTaskPicker();
  openActionInput(id);
}

// ===== utils =====
function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('ar-EG-u-ca-gregory', { day: 'numeric', month: 'short' });
  } catch { return s; }
}
function formatDateTime(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleString('ar-EG-u-ca-gregory', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}
function escAsst(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function asstToast(msg, type) {
  if (typeof window.toast === 'function') window.toast(msg, type);
}
function setAssistantStatus(state) {
  const btn = document.getElementById('asst-send');
  if (!btn) return;
  btn.disabled = state === 'thinking';
  btn.classList.toggle('thinking', state === 'thinking');
  const lbl = btn.querySelector('.asst-send-label');
  if (lbl) lbl.textContent = state === 'thinking' ? 'يفكّر…' : 'إرسال';
}
function autoSizeInput() {
  const el = document.getElementById('asst-input');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// ===== Firebase hook =====
window.assistantHooks = {
  getTasks: () => tasks,
  setTasks: (arr) => {
    if (!Array.isArray(arr)) return;
    tasks = arr;
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    renderTasks();
  }
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('m-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTaskManual(); }
  });
  document.getElementById('ai-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitActionInput(); }
    if (e.key === 'Escape') closeActionInput();
  });
  document.getElementById('asst-search')?.addEventListener('input', renderTasks);
  document.getElementById('asst-sort')?.addEventListener('change', renderTasks);
  renderTasks();
});
