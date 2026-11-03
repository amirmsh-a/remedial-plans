/* التقارير — تقارير PDF على مستوى المادة، الفصل، المعلم، وتقرير الخطة العلاجية التفصيلي لفصل */
(() => {
'use strict';
const RP = window.RP; if (!RP) return;
const $ = s => document.querySelector(s);
const { esc, fmt, num, completion, classLabel, COMPONENTS, GRADE_LONG, GRADE_SHORT, SUBJECTS } = RP;
const CFG = window.APP_CONFIG || {};
const COPY = '© جميع الحقوق محفوظة - الوكيل التعليمي / أمير المشد';
const TYPES = [['subject', 'تقرير مادة'], ['class', 'تقرير فصل (كل المواد)'], ['teacher', 'تقرير معلم'], ['plan', 'تقرير الخطة العلاجية لفصل (تفصيلي)']];

let links = null, linksFor = null, bound = false;
async function ensureLinks() {
  if (links && linksFor === RP.state.emp) return links;
  try { links = ((await RP.api.listLinks(RP.state.emp)) || []).map(l => ({ ...l, grade: l.grade == null ? null : +l.grade, section: l.section == null ? null : +l.section })); linksFor = RP.state.emp; }
  catch { links = []; }
  return links;
}

/* ---------- أدوات ---------- */
const plans = () => RP.state.plans;
const uniq = a => [...new Set(a)];
const byOrder = RP.defaultOrder;
const pct = (a, b) => b ? a / b * 100 : null;
const today = () => {
  const d = new Date();
  let h = ''; try { h = d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch {}
  return h + ' — ' + d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
};
const dateTxt = v => v ? new Date(v + (String(v).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const splitList = t => String(t || '').split(/[\n،,؛;]+/).map(x => x.trim()).filter(Boolean);
function stats(list) {
  const tot = list.reduce((s, p) => s + (num(p.students_total) || 0), 0), weak = list.reduce((s, p) => s + (num(p.students_weak) || 0), 0);
  const imp = list.filter(p => num(p.pre_score) !== null && num(p.post_score) !== null).map(p => p.post_score - p.pre_score);
  return { n: list.length, done: list.filter(p => completion(p) === 100).length, none: list.filter(p => completion(p) === 0).length,
    comp: list.length ? list.reduce((s, p) => s + completion(p), 0) / list.length : null, tot, weak, weakPct: pct(weak, tot),
    imp: imp.length ? imp.reduce((a, b) => a + b, 0) / imp.length : null, impN: imp.length };
}
const signed = v => v === null || v === undefined ? '—' : (v >= 0 ? '+' : '') + fmt(v, 1) + '%';
const bar = (v, cls = '') => `<div class="r-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v || 0))}%"></i></div>`;
const compCell = p => { const c = completion(p); return `<div class="r-prog">${bar(c, c === 100 ? 'full' : c < 50 ? 'low' : '')}<b>${fmt(c)}%</b></div>`; };
const status = s => `<span class="r-st ${s === 'مكتملة' ? 'ok' : s === 'قيد التنفيذ' ? 'mid' : 'no'}">${esc(s || 'لم تبدأ')}</span>`;

function kpis(s) {
  return `<div class="r-kpis">
    <div><span>عدد الخطط</span><b>${fmt(s.n)}</b><small>${fmt(s.done)} مكتملة · ${fmt(s.none)} لم تبدأ</small></div>
    <div><span>متوسط الإنجاز</span><b>${s.comp === null ? '—' : fmt(s.comp) + '%'}</b>${bar(s.comp)}</div>
    <div><span>الطلاب / المتعثرون</span><b>${fmt(s.tot)} / ${fmt(s.weak)}</b><small>نسبة التعثر ${s.weakPct === null ? '—' : fmt(s.weakPct, 1) + '%'}</small></div>
    <div><span>متوسط التحسن</span><b>${signed(s.imp)}</b><small>من ${fmt(s.impN)} خطة مقاسة</small></div>
  </div>`;
}
function plansTable(list, firstCol) {
  const head = { subject: 'المادة', class: 'الفصل', both: 'المادة / الفصل' }[firstCol];
  const first = p => firstCol === 'subject' ? esc(p.subject) : firstCol === 'class' ? esc(classLabel(p)) : `${esc(p.subject)}<br><small>${esc(classLabel(p))}</small>`;
  return `<table class="r-tbl"><thead><tr><th>${head}</th>${firstCol === 'both' ? '' : '<th>المعلم</th>'}<th>الطلاب</th><th>المتعثرون</th><th>نسبة التعثر</th><th>قبل</th><th>بعد</th><th>التحسن</th><th>الإنجاز</th><th>الحالة</th></tr></thead><tbody>` +
    (list.length ? list.map(p => {
      const t = num(p.students_total), w = num(p.students_weak), pre = num(p.pre_score), post = num(p.post_score);
      return `<tr><td><b>${first(p)}</b></td>${firstCol === 'both' ? '' : `<td>${esc(p.teacher) || '<span class="r-mute">—</span>'}</td>`}
        <td class="n">${fmt(t)}</td><td class="n">${fmt(w)}</td><td class="n">${t ? fmt(pct(w || 0, t), 1) + '%' : '—'}</td>
        <td class="n">${pre === null ? '—' : fmt(pre, 1) + '%'}</td><td class="n">${post === null ? '—' : fmt(post, 1) + '%'}</td>
        <td class="n">${pre !== null && post !== null ? signed(post - pre) : '—'}</td><td>${compCell(p)}</td><td>${status(p.status)}</td></tr>`;
    }).join('') : '<tr><td colspan="10" class="r-empty">لا توجد خطط</td></tr>') + '</tbody></table>';
}
function matrix(list, label) {
  return `<table class="r-tbl r-mx"><thead><tr><th>${label === 'class' ? 'الفصل' : label === 'subject' ? 'المادة' : 'المادة / الفصل'}</th>${COMPONENTS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>` +
    list.map(p => `<tr><td><b>${label === 'class' ? esc(classLabel(p)) : label === 'subject' ? esc(p.subject) : esc(p.subject) + ' – ' + esc(classLabel(p))}</b></td>${COMPONENTS.map(([k]) => p.components[k] ? '<td class="y">✔</td>' : '<td class="x">✗</td>').join('')}</tr>`).join('') +
    `<tr class="tot"><td>نسبة الإنجاز</td>${COMPONENTS.map(([k]) => `<td>${list.length ? fmt(list.filter(p => p.components[k]).length / list.length * 100) + '%' : '—'}</td>`).join('')}</tr></tbody></table>`;
}
function compBars(list) {
  return `<div class="r-cbars">${COMPONENTS.map(([k, t]) => { const v = list.length ? list.filter(p => p.components[k]).length / list.length * 100 : 0;
    return `<div><span>${t}</span>${bar(v, v === 100 ? 'full' : v < 50 ? 'low' : '')}<b>${fmt(v)}%</b></div>`; }).join('')}</div>`;
}
function skillsList(list, label) {
  const rows = list.filter(p => (p.weak_skills || '').trim() || (p.strategies || '').trim());
  if (!rows.length) return '<p class="r-mute">لم تُسجَّل مهارات متعثرة أو استراتيجيات بعد.</p>';
  return `<table class="r-tbl r-txt"><thead><tr><th>${label}</th><th>المهارات / النواتج المتعثرة</th><th>الاستراتيجيات والإجراءات العلاجية</th></tr></thead><tbody>` +
    rows.map(p => `<tr><td><b>${label === 'الفصل' ? esc(classLabel(p)) : label === 'المادة' ? esc(p.subject) : esc(p.subject) + '<br><small>' + esc(classLabel(p)) + '</small>'}</b></td><td>${esc(p.weak_skills) || '—'}</td><td>${esc(p.strategies) || '—'}</td></tr>`).join('') + '</tbody></table>';
}
const sec = (title, body, cls = '') => `<section class="r-sec ${cls}"><h3>${title}</h3>${body}</section>`;

function sheet(title, sub, body, meta) {
  const u = RP.state.user || {};
  return `<article class="r-sheet">
    <header class="r-head">
      <img src="logo.webp?v=1" alt="" class="r-logo">
      <div class="r-ttl"><small>${esc(CFG.SCHOOL_NAME || '')} · الخطط العلاجية للاختبار التكويني ${esc(CFG.YEAR || '')}هـ</small><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    </header>
    <div class="r-meta"><span>تاريخ الإصدار: ${today()}</span><span>أصدره: ${esc(u.full_name || '')}</span>${meta ? `<span>${meta}</span>` : ''}</div>
    ${body}
    <footer class="r-foot">${COPY}</footer>
  </article>`;
}

/* ---------- أنواع التقارير ---------- */
function subjectReport(subject, grade) {
  const list = plans().filter(p => p.subject === subject && (!grade || p.grade === +grade)).sort(byOrder);
  const grades = uniq(list.map(p => p.grade)).sort((a, b) => a - b);
  const byGrade = grades.length > 1 ? sec('ملخص حسب الصف', `<table class="r-tbl"><thead><tr><th>الصف</th><th>الفصول</th><th>مكتملة</th><th>متوسط الإنجاز</th><th>الطلاب</th><th>المتعثرون</th><th>نسبة التعثر</th><th>متوسط التحسن</th></tr></thead><tbody>` +
    grades.map(g => { const s = stats(list.filter(p => p.grade === g));
      return `<tr><td><b>الصف ${GRADE_LONG[g]}</b></td><td class="n">${fmt(s.n)}</td><td class="n">${fmt(s.done)}</td><td><div class="r-prog">${bar(s.comp)}<b>${fmt(s.comp)}%</b></div></td><td class="n">${fmt(s.tot)}</td><td class="n">${fmt(s.weak)}</td><td class="n">${s.weakPct === null ? '—' : fmt(s.weakPct, 1) + '%'}</td><td class="n">${signed(s.imp)}</td></tr>`; }).join('') + '</tbody></table>') : '';
  const title = 'تقرير مادة ' + subject + (grade ? ' – الصف ' + GRADE_LONG[grade] : '');
  return { title, file: title, html: sheet(title, grade ? '' : 'جميع الصفوف', kpis(stats(list)) + byGrade +
    sec('تفاصيل الفصول', plansTable(list, 'class')) + sec('إنجاز مكونات ملف الخطة', compBars(list)) +
    sec('مصفوفة مكونات الفصول', matrix(list, 'class'), 'r-break') + sec('المهارات المتعثرة والإجراءات العلاجية', skillsList(list, 'الفصل'))) };
}
function classReport(grade, section) {
  const list = plans().filter(p => p.grade === +grade && p.section === +section).sort(byOrder);
  const title = 'تقرير ' + classLabel({ grade: +grade, section: +section }) + ' – الصف ' + GRADE_LONG[grade];
  return { title, file: title, html: sheet(title, 'جميع المواد', kpis(stats(list)) + sec('الخطط حسب المادة', plansTable(list, 'subject')) +
    sec('مصفوفة مكونات الخطط', matrix(list, 'subject')) + sec('المهارات المتعثرة والإجراءات العلاجية', skillsList(list, 'المادة'))) };
}
function teacherReport(name) {
  const list = plans().filter(p => (p.teacher || '').trim() === name).sort(byOrder);
  const subs = uniq(list.map(p => p.subject));
  const title = 'تقرير المعلم: ' + name;
  return { title, file: 'تقرير المعلم ' + name, html: sheet(title, subs.join('، ') + ` · ${fmt(list.length)} فصل`, kpis(stats(list)) +
    sec('الفصول المسندة', plansTable(list, 'both')) + sec('إنجاز مكونات ملف الخطة', compBars(list)) +
    sec('مصفوفة مكونات الفصول', matrix(list, 'both')) + sec('المهارات المتعثرة والإجراءات العلاجية', skillsList(list, 'المادة / الفصل'))) };
}
async function planReport(subject, grade, section) {
  const p = plans().find(x => x.subject === subject && x.grade === +grade && x.section === +section);
  const cl = classLabel({ grade: +grade, section: +section });
  const title = 'تقرير الخطة العلاجية – ' + subject + ' – ' + cl;
  if (!p) return { title, file: title, html: sheet(title, '', '<p class="r-empty">لا توجد خطة مسجلة لهذا الفصل.</p>') };
  const all = await ensureLinks();
  const here = all.filter(l => l.subject === p.subject && l.grade === p.grade && l.section === p.section);
  const lk = comp => here.filter(l => (l.component || null) === comp).sort((a, b) => (a.kind === 'folder' ? -1 : 0) - (b.kind === 'folder' ? -1 : 0));
  const linkHtml = arr => arr.length ? arr.map(l => `<a href="${esc(/^https:\/\//i.test(l.url) ? l.url : '#')}">${l.kind === 'folder' ? 'مجلد OneDrive' : esc(l.title)}</a>`).join('<br>') : '<span class="r-mute">—</span>';
  const t = num(p.students_total), w = num(p.students_weak), pre = num(p.pre_score), post = num(p.post_score), c = completion(p);
  const info = [['المادة', esc(p.subject)], ['الصف', 'الصف ' + GRADE_LONG[p.grade]], ['الفصل', esc(cl)], ['معلم المادة', esc(p.teacher) || '—'],
    ['تاريخ الاختبار التكويني', dateTxt(p.test_date)], ['فترة تنفيذ الخطة', `من ${dateTxt(p.start_date)} إلى ${dateTxt(p.end_date)}`],
    ['حالة الخطة', status(p.status)], ['آخر تحديث', `${esc(p.updated_by || '—')} · ${dateTxt(p.updated_at && String(p.updated_at).slice(0, 10))}`]];
  const nums = `<div class="r-kpis">
    <div><span>عدد الطلاب</span><b>${fmt(t)}</b></div>
    <div><span>الطلاب المتعثرون</span><b>${fmt(w)}</b><small>نسبة التعثر ${t ? fmt(pct(w || 0, t), 1) + '%' : '—'}</small></div>
    <div><span>الأداء قبل الخطة / بعدها</span><b>${pre === null ? '—' : fmt(pre, 1) + '%'} / ${post === null ? '—' : fmt(post, 1) + '%'}</b><small>التحسن ${pre !== null && post !== null ? signed(post - pre) : '—'}</small></div>
    <div><span>إنجاز مكونات الملف</span><b>${fmt(c)}%</b>${bar(c, c === 100 ? 'full' : c < 50 ? 'low' : '')}</div></div>`;
  const prepost = pre !== null || post !== null ? `<div class="r-pp"><div><span>قبل الخطة</span>${bar(pre, 'grey')}<b>${pre === null ? '—' : fmt(pre, 1) + '%'}</b></div><div><span>بعد الخطة</span>${bar(post, 'gold')}<b>${post === null ? '—' : fmt(post, 1) + '%'}</b></div></div>` : '';
  const listOr = (txt, empty) => { const a = splitList(txt); return a.length ? `<ol class="r-ol">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : `<p class="r-mute">${empty}</p>`; };
  const comps = `<table class="r-tbl"><thead><tr><th>#</th><th>المكوّن</th><th>الحالة</th><th>الروابط والشواهد</th></tr></thead><tbody>` +
    COMPONENTS.map(([k, label], i) => `<tr><td class="n">${fmt(i + 1)}</td><td><b>${label}</b></td><td>${p.components[k] ? '<span class="r-st ok">منجز ✔</span>' : '<span class="r-st no">غير منجز</span>'}</td><td class="r-links">${linkHtml(lk(k))}</td></tr>`).join('') + '</tbody></table>';
  const classLinks = lk(null);
  const sign = `<div class="r-sign"><div><span>معلم المادة</span><b>${esc(p.teacher) || ''}</b><i></i></div><div><span>الوكيل التعليمي</span><b>أمير المشد</b><i></i></div><div><span>مدير المدرسة</span><b></b><i></i></div></div>`;
  return { title, file: title, html: sheet('تقرير الخطة العلاجية', `${esc(p.subject)} · ${esc(cl)} · الصف ${GRADE_LONG[p.grade]}`,
    `<table class="r-info"><tbody>${info.reduce((a, x, i) => a + (i % 2 ? '' : '<tr>') + `<th>${x[0]}</th><td>${x[1]}</td>` + (i % 2 ? '</tr>' : ''), '')}</tbody></table>` +
    nums + (prepost ? `<div class="r-sec">${prepost}</div>` : '') +
    `<div class="r-two">${sec('المهارات / النواتج المتعثرة', listOr(p.weak_skills, 'لم تُسجَّل.'))}${sec('الاستراتيجيات والإجراءات العلاجية', listOr(p.strategies, 'لم تُسجَّل.'))}</div>` +
    sec('مكونات ملف الخطة العلاجية', comps + (classLinks.length ? `<p class="r-cl"><b>روابط الفصل:</b> ${linkHtml(classLinks).replace(/<br>/g, ' · ')}</p>` : '')) +
    (p.notes ? sec('ملاحظات', `<p class="r-notes">${esc(p.notes)}</p>`) : '') + sign) };
}

/* ---------- الواجهة ---------- */
const el = id => document.getElementById(id);
function opts(sel, items, keep) { const v = keep ?? sel.value; sel.innerHTML = items.map(([a, b]) => `<option value="${esc(a)}">${esc(b)}</option>`).join(''); if ([...sel.options].some(o => o.value === String(v))) sel.value = v; }
function syncControls() {
  const type = el('rType').value, P = plans();
  const show = { rSubjectW: ['subject', 'plan'], rGradeW: ['subject', 'class', 'plan'], rSectionW: ['class', 'plan'], rTeacherW: ['teacher'] };
  Object.entries(show).forEach(([id, t]) => { el(id).hidden = !t.includes(type); });
  const subs = RP.subjectsOf(P);
  opts(el('rSubject'), subs.map(s => [s, s]));
  const s = el('rSubject').value;
  const gPool = type === 'class' ? P : P.filter(p => p.subject === s);
  const grades = uniq(gPool.map(p => p.grade)).sort((a, b) => a - b).map(g => [g, 'الصف ' + GRADE_LONG[g]]);
  opts(el('rGrade'), type === 'subject' ? [['', 'كل الصفوف'], ...grades] : grades);
  const g = +el('rGrade').value;
  opts(el('rSection'), uniq(gPool.filter(p => p.grade === g).map(p => p.section)).sort((a, b) => a - b).map(n => [n, 'فصل ' + GRADE_SHORT[g] + ' ' + n]));
  const teachers = uniq(P.map(p => (p.teacher || '').trim()).filter(Boolean)).sort((a, b) => a.localeCompare(b, 'ar'));
  opts(el('rTeacher'), teachers.map(t => [t, `${t} (${fmt(P.filter(p => (p.teacher || '').trim() === t).length)})`]));
  el('rTeacherNone').hidden = !(type === 'teacher' && !teachers.length);
}
let current = null, seq = 0;
async function build() {
  const type = el('rType').value, my = ++seq;
  const v = id => el(id).value;
  let r = null;
  if (type === 'subject' && v('rSubject')) r = subjectReport(v('rSubject'), v('rGrade'));
  if (type === 'class' && v('rGrade') && v('rSection')) r = classReport(v('rGrade'), v('rSection'));
  if (type === 'teacher' && v('rTeacher')) r = teacherReport(v('rTeacher'));
  if (type === 'plan' && v('rSubject') && v('rGrade') && v('rSection')) { el('reportOut').innerHTML = '<p class="r-wait">جارٍ تجهيز التقرير…</p>'; r = await planReport(v('rSubject'), v('rGrade'), v('rSection')); }
  if (my !== seq) return;
  current = r;
  el('reportOut').innerHTML = r ? r.html : '<p class="r-empty card">اختر عناصر التقرير.</p>';
  el('rPdf').disabled = !r;
}
function printPdf() {
  if (!current) return;
  const host = el('printHost'); host.innerHTML = current.html;
  const t = document.title; document.title = current.file.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.classList.add('rprint');
  const done = () => { document.body.classList.remove('rprint'); host.innerHTML = ''; document.title = t; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const imgs = [...host.querySelectorAll('img')].filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
}
function bind() {
  if (bound) return; bound = true;
  el('rType').innerHTML = TYPES.map(([a, b]) => `<option value="${a}">${b}</option>`).join('');
  el('rType').addEventListener('input', () => { syncControls(); build(); });
  ['rSubject', 'rGrade'].forEach(id => el(id).addEventListener('input', () => { syncControls(); build(); }));
  ['rSection', 'rTeacher'].forEach(id => el(id).addEventListener('input', build));
  el('rPdf').onclick = printPdf;
}
window.renderReports = () => {
  if (!RP.state.user || RP.state.user.role !== 'admin') { el('reportOut').innerHTML = ''; return; }
  bind();
  const t = el('rType');
  if (!t.dataset.init && RP.state.user && RP.state.user.role === 'teacher') { t.value = 'plan'; }
  t.dataset.init = '1';
  syncControls(); build();
};
window.RPReports = { subjectReport, classReport, teacherReport, planReport };
})();
