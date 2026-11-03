/* تصفح مجلدات المواد والخطط + روابط المستخدمين — الخطط العلاجية للاختبار التكويني 1448 */
(() => {
'use strict';
const RP = window.RP; if (!RP) return;
const CFG = window.APP_CONFIG || {};
const $ = s => document.querySelector(s);
const nav = { subject: null, grade: null, section: null };
let links = null, linksFor = null, linksLoading = null;
const ICON = '<svg class="ficon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="currentColor"/></svg>';
const EXT = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LNK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const gradeFolder = g => 'الصف ' + RP.GRADE_LONG[g];
const classFolder = (g, s) => 'فصل ' + RP.GRADE_SHORT[g] + ' ' + s;
const compName = k => { const c = RP.COMPONENTS.find(x => x[0] === k); return c ? (c[2] || c[1]) : k; };
const odUrl = parts => CFG.ONEDRIVE_BASE ? encodeURI([CFG.ONEDRIVE_BASE.replace(/\/$/, ''), ...parts].join('/')) : '';
const avg = list => list.length ? Math.round(list.reduce((s, p) => s + RP.completion(p), 0) / list.length) : 0;
const bar = c => `<div class="progress"><div class="bar ${c === 100 ? 'full' : c < 50 ? 'low' : ''}"><i style="width:${c}%"></i></div><span class="num">${RP.fmt(c)}%</span></div>`;
const plansWhere = f => RP.state.plans.filter(f);
const safeUrl = u => /^https:\/\/\S+$/i.test(u || '') ? u : '';

/* ---------- الروابط ---------- */
// الهدف: { subject, grade, section, component } — القيم الفارغة تعني مستوى أعلى
const T = (subject, grade = null, section = null, component = null) => ({ subject, grade, section, component });
const same = (l, t) => l.subject === t.subject && (l.grade ?? null) === (t.grade ?? null) && (l.section ?? null) === (t.section ?? null) && (l.component ?? null) === (t.component ?? null);
const linksAt = t => (links || []).filter(l => same(l, t));
const shareLink = t => linksAt(t).find(l => l.kind === 'folder');
const fileLinks = t => linksAt(t).filter(l => l.kind !== 'folder');
const countUnder = t => (links || []).filter(l => l.kind !== 'folder' && l.subject === t.subject && (t.grade == null || l.grade === t.grade) && (t.section == null || l.section === t.section)).length;
const canDel = l => l.added_by_emp === RP.state.emp || RP.can('delete_plans');
const tAttr = t => RP.esc(JSON.stringify(t));
async function ensureLinks(force) {
  if (!force && links && linksFor === RP.state.emp) return;
  if (linksLoading && !force) return linksLoading;
  linksLoading = (async () => {
    try { links = ((await RP.api.listLinks(RP.state.emp)) || []).map(l => ({ ...l, grade: l.grade == null ? null : +l.grade, section: l.section == null ? null : +l.section })); linksFor = RP.state.emp; }
    catch (e) { links = links || []; RP.toast(RP.errMsg(e), true); }
    finally { linksLoading = null; }
  })();
  return linksLoading;
}

// روابط الدرايف لمستوى المادة والصف تظهر للمدير والمشرف فقط، وللبقية على مستوى الفصل ومجلداته
const fullDrive = () => !!RP.state.user && ['admin', 'supervisor'].includes(RP.state.user.role);
const driveVisible = t => fullDrive() || t.section != null;
// رابط فتح المجلد: رابط المشاركة الذي أضافه المستخدمون إن وُجد، وإلا مسار OneDrive
function openLink(t, parts, label = 'فتح المجلد') {
  if (!driveVisible(t)) return '';
  const sh = shareLink(t), u = sh ? safeUrl(sh.url) : odUrl(parts);
  if (!u) return '';
  const up = !!sh && /تعديل/.test(sh.title || '');
  if (up && label === 'فتح المجلد') label = 'فتح ورفع الملفات';
  return `<a class="od" href="${RP.esc(u)}" target="_blank" rel="noopener" title="${sh ? (up ? 'رابط مشاركة OneDrive يتيح الاطلاع ورفع الملفات لمنسوبي الجهة' : 'رابط مشاركة أضافه ' + RP.esc(sh.added_by || '')) : 'مسار المجلد في OneDrive'}">${label} ${EXT}</a>${sh ? `<span class="tag">${up ? 'يتيح الرفع' : 'رابط مشاركة'}</span>` : ''}`;
}
function linkList(t, empty = '') {
  const l = fileLinks(t);
  if (!l.length) return empty;
  return `<ul class="links">${l.map(x => `<li>${LNK}<a href="${RP.esc(safeUrl(x.url))}" target="_blank" rel="noopener" title="${RP.esc(x.title)}">${RP.esc(x.title)}</a>
    <span class="by">${RP.esc(x.added_by || '')}</span>${canDel(x) ? `<button type="button" class="x-sm" title="حذف الرابط" data-dellink="${RP.esc(x.id)}">×</button>` : ''}</li>`).join('')}</ul>`;
}
function canAddAt(t) {
  if (!RP.can('add_links')) return false;
  const u = RP.state.user, sc = (u && u.role !== 'admin' && u.scope) || {}, cls = sc.classes || [];
  if (t.grade == null) return !(sc.grades || []).length && !cls.length;
  if (t.section == null) return !cls.some(c => c.split('-')[0] === String(t.grade));
  return true;
}
function linkTools(t) {
  if (!canAddAt(t)) return '';
  return `<span class="ltools"><button type="button" class="btn ghost sm" data-addlink='${tAttr(t)}'>+ رابط</button>${driveVisible(t) ? `<button type="button" class="btn ghost sm" data-sharelink='${tAttr(t)}'>${shareLink(t) ? 'تغيير رابط المشاركة' : 'رابط المشاركة'}</button>` : ''}</span>`;
}
// لوحة روابط المستوى الحالي (المادة / الصف / الفصل)
function levelPanel(t, title) {
  const sh = driveVisible(t) ? shareLink(t) : null, files = fileLinks(t);
  if (!files.length && !sh && !canAddAt(t)) return '';
  return `<div class="card lpanel"><div class="frow"><h3 style="margin:0">${LNK} ${RP.esc(title)}</h3>${linkTools(t)}</div>
    ${sh ? `<p class="sm" style="margin:.5rem 0 0">رابط مشاركة المجلد: <a class="od" href="${RP.esc(safeUrl(sh.url))}" target="_blank" rel="noopener">${RP.esc(sh.title)} ${EXT}</a> <span class="by">${RP.esc(sh.added_by || '')}</span>${canDel(sh) ? `<button type="button" class="x-sm" data-dellink="${RP.esc(sh.id)}">×</button>` : ''}</p>` : ''}
    ${linkList(t, sh ? '' : '<p class="muted sm" style="margin:.5rem 0 0">لا توجد روابط بعد.</p>')}</div>`;
}

/* ---------- التنقل ---------- */
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
function card({ title, sub, c, go: target, parts, t }) {
  const n = countUnder(t);
  return `<div class="fcard" role="button" tabindex="0" data-go='${RP.esc(JSON.stringify(target))}'>
    <div class="frow">${ICON}<div class="fmeta"><div class="ft">${RP.esc(title)}</div><div class="fs">${sub}${n ? ` · ${LNK} ${RP.fmt(n)} رابط` : ''}</div></div></div>
    ${c === undefined ? '' : bar(c)}
    <div class="frow end">${openLink(t, parts)}</div></div>`;
}

/* ---------- العرض ---------- */
function render() {
  const root = $('#foldersBody'); if (!root) return;
  $('#crumbs').innerHTML = crumbs();
  const { subject, grade, section } = nav;
  let html = '';
  if (!subject) {
    const subs = RP.subjectsOf(RP.state.plans);
    html = `<div class="fgrid">${subs.map(s => { const l = plansWhere(p => p.subject === s);
      return card({ title: s, sub: `${RP.fmt(l.length)} فصل · ${RP.fmt(l.filter(p => RP.completion(p) === 100).length)} مكتملة`, c: avg(l), go: [s, null, null], parts: [s], t: T(s) }); }).join('')}</div>`;
    if (CFG.ONEDRIVE_SHARE && fullDrive()) html += `<p class="muted sm">المجلد الرئيسي: <a class="od" href="${RP.esc(CFG.ONEDRIVE_SHARE)}" target="_blank" rel="noopener">الخطط العلاجية للاختبار التكويني 1448 ${EXT}</a></p>`;
  } else if (!grade) {
    const grades = [...new Set(plansWhere(p => p.subject === subject).map(p => p.grade))].sort((a, b) => a - b);
    html = levelPanel(T(subject), 'روابط ' + subject) + `<div class="fgrid">${grades.map(g => { const l = plansWhere(p => p.subject === subject && p.grade === g);
      return card({ title: gradeFolder(g), sub: `${RP.fmt(l.length)} فصول · ${RP.fmt(l.reduce((s, p) => s + (RP.num(p.students_weak) || 0), 0))} متعثر`, c: avg(l), go: [subject, g, null], parts: [subject, gradeFolder(g)], t: T(subject, g) }); }).join('')}</div>`;
  } else if (!section) {
    const l = plansWhere(p => p.subject === subject && p.grade === grade).sort(RP.defaultOrder);
    html = levelPanel(T(subject, grade), `روابط ${subject} – ${gradeFolder(grade)}`) + (l.length ? `<div class="fgrid">${l.map(p => card({ title: RP.classLabel(p), sub: (RP.esc(p.teacher) || 'لم يُحدَّد المعلم') + ' · ' + RP.esc(p.status),
      c: RP.completion(p), go: [subject, grade, p.section], parts: [subject, gradeFolder(grade), RP.classLabel(p)], t: T(subject, grade, p.section) })).join('')}</div>`
      : '<div class="empty card">لا توجد فصول في هذا الصف</div>');
  } else {
    html = renderClass(subject, grade, section);
  }
  root.innerHTML = html;
}

function renderClass(subject, grade, section) {
  const p = RP.state.plans.find(x => x.subject === subject && x.grade === grade && x.section === section);
  const base = [subject, gradeFolder(grade), classFolder(grade, section)];
  const ct = T(subject, grade, section);
  if (!p) return `<div class="card empty">لا توجد خطة لهذا الفصل بعد.<br><br>${RP.can('add_plans') ? '<button class="btn primary" data-new="1">إنشاء خطة</button> ' : ''}${openLink(ct, base, 'فتح مجلد الفصل')}</div>`;
  const pre = RP.num(p.pre_score), post = RP.num(p.post_score), w = RP.num(p.students_weak), tt = RP.num(p.students_total);
  const info = [
    ['المعلم', RP.esc(p.teacher) || '—'], ['الطلاب / المتعثرون', (tt === null ? '—' : RP.fmt(tt)) + ' / ' + (w === null ? '—' : RP.fmt(w))],
    ['الحالة', `<span class="pill s${Math.max(0, RP.STATUSES.indexOf(p.status))}">${RP.esc(p.status)}</span>`],
    ['قبل / بعد الخطة', (pre === null ? '—' : RP.fmt(pre, 1) + '%') + ' ← ' + (post === null ? '—' : RP.fmt(post, 1) + '%')],
    ['تاريخ الاختبار', p.test_date || '—']
  ];
  const panel = `<div class="card"><div class="frow"><h3 style="margin:0">خطة ${RP.esc(subject)} – ${RP.esc(RP.classLabel(p))}</h3>
      <div class="actions"><button class="btn primary sm" data-edit-plan="1">${RP.can('edit_plans') ? 'فتح الخطة وتعديلها' : 'عرض الخطة'}</button>${openLink(ct, base, 'مجلد الفصل')}</div></div>
    <div class="plan-panel">${info.map(([l, v]) => `<div><div class="lbl">${l}</div><div class="v">${v}</div></div>`).join('')}
      <div><div class="lbl">إنجاز المكونات</div>${bar(RP.completion(p))}</div></div>
    ${p.weak_skills ? `<p class="sm"><b>المهارات المتعثرة:</b> ${RP.esc(p.weak_skills)}</p>` : ''}
    ${p.strategies ? `<p class="sm"><b>الإجراءات العلاجية:</b> ${RP.esc(p.strategies)}</p>` : ''}</div>`;
  const comps = RP.COMPONENTS.map(([k, label, folder]) => {
    const done = !!(p.components && p.components[k]), t = T(subject, grade, section, k);
    return `<div class="fcard comp ${done ? 'done' : ''}">
      <div class="frow">${ICON}<div class="fmeta"><div class="ft">${RP.esc(folder || label)}</div>
        <div class="fs">${done ? '✔ مكتمل' : 'لم يكتمل بعد'}</div></div></div>
      ${linkList(t)}
      <div class="frow end">${RP.can('edit_plans') ? `<button type="button" class="btn ${done ? 'ghost' : 'primary'} sm" data-toggle-comp="${k}">${done ? 'إلغاء الاكتمال' : 'تحديد كمكتمل'}</button>` : ''}<span>${openLink(t, [...base, folder || label])}</span></div>
      ${linkTools(t)}</div>`;
  }).join('');
  return panel + levelPanel(ct, 'روابط الفصل العامة') + `<h3 class="sub-h">مجلدات الفصل (${RP.COMPONENTS.length})</h3><div class="fgrid">${comps}</div>`;
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

/* ---------- نافذة إضافة رابط ---------- */
function targetLabel(t) {
  return [t.subject, t.grade ? gradeFolder(t.grade) : '', t.section ? classFolder(t.grade, t.section) : '', t.component ? compName(t.component) : ''].filter(Boolean).join(' ‹ ');
}
function openLinkDialog(t, kind) {
  const f = $('#linkForm'); f.reset(); f.dataset.target = JSON.stringify(t);
  f.kind.value = kind; syncKind();
  $('#linkTarget').textContent = targetLabel(t);
  $('#linkErr').textContent = '';
  $('#linkDialog').showModal(); setTimeout(() => f.url.focus(), 50);
}
function syncKind() {
  const f = $('#linkForm'), folder = f.kind.value === 'folder';
  $('#linkTitleRow').hidden = folder;
  $('#linkHelp').textContent = folder
    ? 'الصق رابط المشاركة للمجلد من OneDrive أو Google Drive (مشاركة ← نسخ الرابط). سيُستخدم بدل مسار المجلد ليفتحه الجميع، ويستبدل أي رابط مشاركة سابق لهذا المجلد.'
    : 'أضف رابط ملف أو مستند أو صورة (OneDrive، Google Drive، Forms…). يظهر الرابط داخل المجلد لكل من يصل إليه.';
}
async function submitLink(e) {
  e.preventDefault();
  const f = $('#linkForm'), t = JSON.parse(f.dataset.target || '{}');
  const url = f.url.value.trim(), title = f.title.value.trim(), kind = f.kind.value;
  if (!/^https:\/\/\S+$/i.test(url)) return $('#linkErr').textContent = 'الرابط يجب أن يبدأ بـ https:// ولا يحتوي مسافات';
  if (kind === 'file' && !title) return $('#linkErr').textContent = 'اكتب عنواناً للرابط';
  const b = $('#linkSave'); b.disabled = true;
  try { await RP.api.addLink(RP.state.emp, { ...t, kind, url, title }); $('#linkDialog').close(); await ensureLinks(true); render(); RP.toast('تمت إضافة الرابط'); }
  catch (err) { $('#linkErr').textContent = RP.errMsg(err); }
  finally { b.disabled = false; }
}
async function deleteLink(id) {
  const l = (links || []).find(x => x.id === id); if (!l) return;
  if (!confirm(`حذف الرابط «${l.title}»؟`)) return;
  try { await RP.api.deleteLink(RP.state.emp, id); await ensureLinks(true); render(); RP.toast('تم حذف الرابط'); }
  catch (e) { RP.toast(RP.errMsg(e), true); }
}

/* ---------- الأحداث ---------- */
document.addEventListener('click', e => {
  if (!e.target.closest('#view-folders')) return;
  if (e.target.closest('a')) return;
  const dl = e.target.closest('[data-dellink]'); if (dl) return deleteLink(dl.dataset.dellink);
  const al = e.target.closest('[data-addlink]'); if (al) return openLinkDialog(JSON.parse(al.dataset.addlink), 'file');
  const sl = e.target.closest('[data-sharelink]'); if (sl) return openLinkDialog(JSON.parse(sl.dataset.sharelink), 'folder');
  const tg = e.target.closest('[data-toggle-comp]'); if (tg) return toggleComp(tg.dataset.toggleComp, tg);
  if (e.target.closest('[data-edit-plan]')) return RP.openPlan(RP.state.plans.find(x => x.subject === nav.subject && x.grade === nav.grade && x.section === nav.section));
  if (e.target.closest('[data-new]')) return RP.openPlan(null, { subject: nav.subject, grade: nav.grade, section: nav.section });
  const g = e.target.closest('[data-go]'); if (g) { const [s, gr, se] = JSON.parse(g.dataset.go); go(s, gr, se); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('#view-folders .fcard[data-go]')) e.target.click(); });
window.addEventListener('hashchange', () => { if (readHash() && RP.state.user) RP.showView('folders'); });
$('#linkForm').addEventListener('submit', submitLink);
$('#linkForm').addEventListener('change', e => { if (e.target.name === 'kind') syncKind(); });
document.querySelectorAll('[data-close-link]').forEach(b => b.onclick = () => $('#linkDialog').close());

window.renderFolders = () => { if (!readHash()) Object.assign(nav, { subject: null, grade: null, section: null }); setHash(); render(); ensureLinks().then(render); };
if (readHash() && RP.state.user) RP.showView('folders');
})();
