/* تصفح مجلدات المواد والخطط — الخطط العلاجية للاختبار التكويني 1448 */
(() => {
'use strict';
const RP = window.RP; if (!RP) return;
const CFG = window.APP_CONFIG || {};
const $ = s => document.querySelector(s);
const nav = { subject: null, grade: null, section: null };
const ICON = '<svg class="ficon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="currentColor"/></svg>';
const EXT = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const gradeFolder = g => 'الصف ' + RP.GRADE_LONG[g];
const classFolder = (g, s) => 'فصل ' + RP.GRADE_SHORT[g] + ' ' + s;
const odUrl = parts => CFG.ONEDRIVE_BASE ? encodeURI([CFG.ONEDRIVE_BASE.replace(/\/$/, ''), ...parts].join('/')) : '';
const odLink = (parts, label = 'فتح في OneDrive') => { const u = odUrl(parts); return u ? `<a class="od" href="${u}" target="_blank" rel="noopener">${label} ${EXT}</a>` : ''; };
const avg = list => list.length ? Math.round(list.reduce((s, p) => s + RP.completion(p), 0) / list.length) : 0;
const bar = c => `<div class="progress"><div class="bar ${c === 100 ? 'full' : c < 50 ? 'low' : ''}"><i style="width:${c}%"></i></div><span class="num">${RP.fmt(c)}%</span></div>`;
const plansWhere = f => RP.state.plans.filter(f);

function setHash() {
  const parts = ['folders', nav.subject, nav.grade, nav.section].filter(v => v !== null && v !== undefined);
  const h = '#' + parts.map(encodeURIComponent).join('/');
  if (location.hash !== h) history.replaceState(null, '', h);
}
function readHash() {
  const p = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (p[0] !== 'folders') return false;
  nav.subject = p[1] || null; nav.grade = p[2] ? +p[2] : null; nav.section = p[3] ? +p[3] : null;
  return true;
}
function go(subject = null, grade = null, section = null) {
  Object.assign(nav, { subject, grade, section }); setHash(); render();
  const v = $('#view-folders'); if (v) v.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function crumbs() {
  const items = [['المواد', [null, null, null]]];
  if (nav.subject) items.push([nav.subject, [nav.subject, null, null]]);
  if (nav.grade) items.push([gradeFolder(nav.grade), [nav.subject, nav.grade, null]]);
  if (nav.section) items.push([classFolder(nav.grade, nav.section), [nav.subject, nav.grade, nav.section]]);
  return items.map(([t, a], i) => i === items.length - 1
    ? `<span class="cur">${RP.esc(t)}</span>`
    : `<button type="button" data-go='${RP.esc(JSON.stringify(a))}'>${RP.esc(t)}</button><span class="sep">‹</span>`).join('');
}
function card({ title, sub, c, go: target, parts, extra = '' }) {
  return `<div class="fcard" role="button" tabindex="0" data-go='${RP.esc(JSON.stringify(target))}'>
    <div class="frow">${ICON}<div class="fmeta"><div class="ft">${RP.esc(title)}</div><div class="fs">${sub}</div></div></div>
    ${c === undefined ? '' : bar(c)}${extra}
    <div class="frow end">${odLink(parts)}</div></div>`;
}

function render() {
  const root = $('#foldersBody'); if (!root) return;
  $('#crumbs').innerHTML = crumbs();
  const { subject, grade, section } = nav;
  let html = '';
  if (!subject) {
    const subs = RP.subjectsOf(RP.state.plans);
    html = `<div class="fgrid">${subs.map(s => { const l = plansWhere(p => p.subject === s);
      return card({ title: s, sub: `${RP.fmt(l.length)} فصل · ${RP.fmt(l.filter(p => RP.completion(p) === 100).length)} مكتملة`, c: avg(l), go: [s, null, null], parts: [s] }); }).join('')}</div>`;
    if (CFG.ONEDRIVE_SHARE) html += `<p class="muted sm">المجلد الرئيسي: <a class="od" href="${RP.esc(CFG.ONEDRIVE_SHARE)}" target="_blank" rel="noopener">الخطط العلاجية للاختبار التكويني 1448 ${EXT}</a></p>`;
  } else if (!grade) {
    const grades = [...new Set(plansWhere(p => p.subject === subject).map(p => p.grade))].sort((a, b) => a - b);
    html = `<div class="fgrid">${grades.map(g => { const l = plansWhere(p => p.subject === subject && p.grade === g);
      return card({ title: gradeFolder(g), sub: `${RP.fmt(l.length)} فصول · ${RP.fmt(l.reduce((s, p) => s + (RP.num(p.students_weak) || 0), 0))} متعثر`, c: avg(l), go: [subject, g, null], parts: [subject, gradeFolder(g)] }); }).join('')}</div>`;
  } else if (!section) {
    const l = plansWhere(p => p.subject === subject && p.grade === grade).sort(RP.defaultOrder);
    html = l.length ? `<div class="fgrid">${l.map(p => card({ title: RP.classLabel(p), sub: (RP.esc(p.teacher) || 'لم يُحدَّد المعلم') + ' · ' + RP.esc(p.status),
      c: RP.completion(p), go: [subject, grade, p.section], parts: [subject, gradeFolder(grade), RP.classLabel(p)] })).join('')}</div>`
      : '<div class="empty card">لا توجد فصول في هذا الصف</div>';
  } else {
    html = renderClass(subject, grade, section);
  }
  root.innerHTML = html;
}

function renderClass(subject, grade, section) {
  const p = RP.state.plans.find(x => x.subject === subject && x.grade === grade && x.section === section);
  const base = [subject, gradeFolder(grade), classFolder(grade, section)];
  if (!p) return `<div class="card empty">لا توجد خطة لهذا الفصل بعد.<br><br>${RP.can('add_plans') ? '<button class="btn primary" data-new="1">إنشاء خطة</button> ' : ''}${odLink(base, 'فتح مجلد الفصل')}</div>`;
  const pre = RP.num(p.pre_score), post = RP.num(p.post_score), w = RP.num(p.students_weak), t = RP.num(p.students_total);
  const info = [
    ['المعلم', RP.esc(p.teacher) || '—'], ['الطلاب / المتعثرون', (t === null ? '—' : RP.fmt(t)) + ' / ' + (w === null ? '—' : RP.fmt(w))],
    ['الحالة', `<span class="pill s${Math.max(0, RP.STATUSES.indexOf(p.status))}">${RP.esc(p.status)}</span>`],
    ['قبل / بعد الخطة', (pre === null ? '—' : RP.fmt(pre, 1) + '%') + ' ← ' + (post === null ? '—' : RP.fmt(post, 1) + '%')],
    ['تاريخ الاختبار', p.test_date || '—']
  ];
  const panel = `<div class="card"><div class="frow"><h3 style="margin:0">خطة ${RP.esc(subject)} – ${RP.esc(RP.classLabel(p))}</h3>
      <div class="actions"><button class="btn primary sm" data-edit-plan="1">${RP.can('edit_plans') ? 'فتح الخطة وتعديلها' : 'عرض الخطة'}</button>${odLink(base, 'مجلد الفصل')}</div></div>
    <div class="plan-panel">${info.map(([l, v]) => `<div><div class="lbl">${l}</div><div class="v">${v}</div></div>`).join('')}
      <div><div class="lbl">إنجاز المكونات</div>${bar(RP.completion(p))}</div></div>
    ${p.weak_skills ? `<p class="sm"><b>المهارات المتعثرة:</b> ${RP.esc(p.weak_skills)}</p>` : ''}
    ${p.strategies ? `<p class="sm"><b>الإجراءات العلاجية:</b> ${RP.esc(p.strategies)}</p>` : ''}</div>`;
  const comps = RP.COMPONENTS.map(([k, label, folder]) => {
    const done = !!(p.components && p.components[k]);
    return `<div class="fcard comp ${done ? 'done' : ''}">
      <div class="frow">${ICON}<div class="fmeta"><div class="ft">${RP.esc(folder || label)}</div>
        <div class="fs">${done ? '✔ مكتمل' : 'لم يكتمل بعد'}</div></div></div>
      <div class="frow end">${RP.can('edit_plans') ? `<button type="button" class="btn ${done ? 'ghost' : 'primary'} sm" data-toggle-comp="${k}">${done ? 'إلغاء الاكتمال' : 'تحديد كمكتمل'}</button>` : ''}${odLink([...base, folder || label], 'فتح المجلد')}</div></div>`;
  }).join('');
  return panel + `<h3 class="sub-h">مجلدات الفصل (${RP.COMPONENTS.length})</h3><div class="fgrid">${comps}</div>`;
}

async function toggleComp(k, btn) {
  const p = RP.state.plans.find(x => x.subject === nav.subject && x.grade === nav.grade && x.section === nav.section); if (!p) return;
  const comps = { ...(p.components || {}) }; if (comps[k]) delete comps[k]; else comps[k] = true;
  const n = RP.COMPONENTS.filter(([c]) => comps[c]).length;
  const status = n === RP.COMPONENTS.length ? 'مكتملة' : n > 0 ? 'قيد التنفيذ' : 'لم تبدأ';
  btn.disabled = true;
  try { await RP.api.savePlan(RP.state.emp, { ...p, components: comps, status }); await RP.loadPlans(); render(); RP.toast('تم التحديث'); }
  catch (e) { RP.toast(RP.errMsg(e), true); btn.disabled = false; }
}

document.addEventListener('click', e => {
  if (!e.target.closest('#view-folders')) return;
  if (e.target.closest('a')) return;
  const tg = e.target.closest('[data-toggle-comp]'); if (tg) return toggleComp(tg.dataset.toggleComp, tg);
  if (e.target.closest('[data-edit-plan]')) return RP.openPlan(RP.state.plans.find(x => x.subject === nav.subject && x.grade === nav.grade && x.section === nav.section));
  if (e.target.closest('[data-new]')) return RP.openPlan(null, { subject: nav.subject, grade: nav.grade, section: nav.section });
  const g = e.target.closest('[data-go]'); if (g) { const [s, gr, se] = JSON.parse(g.dataset.go); go(s, gr, se); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('#view-folders .fcard[data-go]')) e.target.click(); });
window.addEventListener('hashchange', () => { if (readHash() && RP.state.user) RP.showView('folders'); });

window.renderFolders = () => { readHash(); setHash(); render(); };
if (readHash() && RP.state.user) RP.showView('folders');
})();
