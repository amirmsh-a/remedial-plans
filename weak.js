/* الطلاب الضعاف: قوائم الطلاب لكل مادة وفصل ومعلم، ويكمل المعلم المهارات والشواهد ودرجة الاختبار البعدي */
(() => {
'use strict';
const RP = window.RP; if (!RP) return;
const { esc, fmt, GRADE_LONG, GRADE_SHORT, SUBJECTS } = RP;
const CFG = window.APP_CONFIG || {};
const el = id => document.getElementById(id);
const COPY = '© جميع الحقوق محفوظة - الوكيل التعليمي / أمير المشد';
let rows = null, rowsFor = null, bound = false;

const n = v => v === '' || v === null || v === undefined || isNaN(+v) ? null : +v;
const prePct = w => n(w.pre_pct) ?? (n(w.pre_score) !== null ? n(w.pre_score) / (n(w.max_score) || 20) * 100 : null);
const postPct = w => n(w.post_score) === null ? null : n(w.post_score) / (n(w.max_score) || 20) * 100;
const gain = w => { const a = prePct(w), b = postPct(w); return a === null || b === null ? null : b - a; };
const pctTxt = v => v === null ? '—' : fmt(v, 1) + '%';
const gainTxt = v => v === null ? '—' : (v > 0 ? '+' : '') + fmt(v, 1) + '%';
const gainCls = v => v === null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
const cls = w => `فصل ${GRADE_SHORT[w.grade] || w.grade} ${w.section}`;
const key = w => w.subject + '|' + w.grade + '|' + w.section;
const order = (a, b) => SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject) || a.grade - b.grade || a.section - b.section || (n(a.pre_score) ?? 99) - (n(b.pre_score) ?? 99) || a.full_name.localeCompare(b.full_name, 'ar');
const isUrl = s => /^https:\/\/\S+$/i.test((s || '').trim());

async function load(force) {
  if (!force && rows && rowsFor === RP.state.emp) return;
  el('wBody').innerHTML = '<p class="muted" style="text-align:center;padding:1rem">جارٍ تحميل القوائم…</p>';
  try { rows = ((await RP.api.listWeak(RP.state.emp)) || []).map(w => ({ ...w, grade: +w.grade, section: +w.section })).sort(order); rowsFor = RP.state.emp; }
  catch (e) { rows = []; RP.toast(RP.errMsg(e), true); }
}

/* ---------- الفلاتر ---------- */
function opts(sel, items, first) { const v = sel.value; sel.innerHTML = `<option value="">${first}</option>` + items.map(([a, b]) => `<option value="${esc(a)}">${esc(b)}</option>`).join(''); if ([...sel.options].some(o => o.value === v)) sel.value = v; }
function syncFilters() {
  const s = el('wSubject').value, g = el('wGrade').value;
  opts(el('wSubject'), SUBJECTS.filter(x => rows.some(w => w.subject === x)).map(x => [x, x]), 'كل المواد');
  const pool = rows.filter(w => !s || w.subject === s);
  opts(el('wGrade'), [...new Set(pool.map(w => w.grade))].sort((a, b) => a - b).map(x => [x, 'الصف ' + GRADE_LONG[x]]), 'كل الصفوف');
  opts(el('wSection'), [...new Set(pool.filter(w => !g || w.grade === +g).map(w => w.section))].sort((a, b) => a - b).map(x => [x, g ? `فصل ${GRADE_SHORT[g]} ${x}` : 'فصل ' + x]), 'كل الفصول');
  opts(el('wTeacher'), [...new Set(rows.map(w => w.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')).map(x => [x, x]), 'كل المعلمين');
}
function filtered() {
  const s = el('wSubject').value, g = el('wGrade').value, sec = el('wSection').value, t = el('wTeacher').value, st = el('wState').value;
  const q = el('wSearch').value.trim();
  return rows.filter(w => (!s || w.subject === s) && (!g || w.grade === +g) && (!sec || w.section === +sec) && (!t || w.teacher === t) &&
    (!q || w.full_name.includes(q) || String(w.student_no).includes(q)) &&
    (!st || (st === 'todo' ? n(w.post_score) === null : st === 'up' ? (gain(w) ?? -1) > 0 : n(w.post_score) !== null && gain(w) <= 0)));
}
function stats(list) {
  const m = list.filter(w => n(w.post_score) !== null), avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return { n: list.length, measured: m.length, pre: avg(list.map(prePct).filter(v => v !== null)), post: avg(m.map(postPct)), gain: avg(m.map(gain)),
    up: m.filter(w => gain(w) > 0).length, done: list.filter(w => (w.skills || '').trim() && (w.evidence || '').trim() && n(w.post_score) !== null).length };
}

/* ---------- العرض ---------- */
function groups(list) { const g = new Map(); list.forEach(w => { const k = key(w); if (!g.has(k)) g.set(k, []); g.get(k).push(w); }); return [...g.values()]; }
function render() {
  if (!rows) return;
  syncFilters();
  const list = filtered(), st = stats(list), edit = RP.can('edit_plans');
  el('wKpis').innerHTML = [
    ['عدد الطلاب', fmt(st.n), `${fmt(groups(list).length)} قائمة (مادة/فصل)`, ''],
    ['تم قياسهم بعدياً', fmt(st.measured), st.n ? fmt(st.measured / st.n * 100) + '% من الطلاب' : '—', ''],
    ['متوسط النسبة قبل / بعد', `${pctTxt(st.pre)} / ${pctTxt(st.post)}`, 'قبلي لكل الطلاب · بعدي للمقيسين', 'gold'],
    ['متوسط التحسن', gainTxt(st.gain), `${fmt(st.up)} طالب تحسّن`, ''],
    ['اكتمال بيانات المعلم', fmt(st.done), 'مهارات + شواهد + درجة بعدية', 'red']
  ].map(([l, v, s, c]) => `<div class="kpi ${c}"><div class="lbl">${l}</div><div class="val num">${v}</div><div class="sub">${s}</div></div>`).join('');
  el('wPdf').hidden = !RP.isAdmin();
  el('wPdf').disabled = !list.length;
  if (!list.length) { el('wBody').innerHTML = `<p class="empty card">${rows.length ? 'لا توجد نتائج مطابقة للتصفية.' : 'لا توجد قوائم طلاب ضمن صلاحياتك.'}</p>`; return; }
  el('wBody').innerHTML = groups(list).map(g => {
    const w0 = g[0], s = stats(g);
    return `<section class="card wgroup">
      <div class="wg-head"><div><h3>${esc(w0.subject)} – ${esc(cls(w0))}</h3><p class="muted sm">المعلم: <b>${esc(w0.teacher || '—')}</b> · ${fmt(g.length)} طالب · الدرجة من ${fmt(w0.max_score)}</p></div>
        <div class="wg-stats"><span>قيس <b>${fmt(s.measured)}/${fmt(s.n)}</b></span><span>التحسن <b class="${gainCls(s.gain)}">${gainTxt(s.gain)}</b></span></div></div>
      <div class="table-wrap"><table class="tbl wtbl"><thead><tr><th>م</th><th>رقم الهوية</th><th>اسم الطالب</th><th>الدرجة</th><th>النسبة</th><th>المهارات المستهدفة</th><th>الشواهد</th><th>الاختبار البعدي</th><th>النسبة البعدية</th><th>التحسن</th></tr></thead><tbody>` +
      g.map((w, i) => `<tr data-id="${esc(w.id)}">
        <td class="num">${fmt(i + 1)}</td><td class="num ltr">${esc(w.student_no)}</td><td class="nm">${esc(w.full_name)}</td>
        <td class="num">${fmt(w.pre_score, 1)}</td><td class="num">${pctTxt(prePct(w))}</td>
        <td class="ed">${edit ? `<textarea data-f="skills" rows="1" maxlength="2000" placeholder="المهارات…">${esc(w.skills)}</textarea>` : esc(w.skills) || '—'}</td>
        <td class="ed">${edit ? `<textarea data-f="evidence" rows="1" maxlength="2000" placeholder="وصف الشاهد أو رابطه">${esc(w.evidence)}</textarea>` : ''}${isUrl(w.evidence) ? `<a class="ev" href="${esc(w.evidence.trim())}" target="_blank" rel="noopener">فتح الشاهد</a>` : edit ? '' : esc(w.evidence) || '—'}</td>
        <td>${edit ? `<input data-f="post_score" type="number" min="0" max="${esc(w.max_score)}" step="0.5" inputmode="decimal" value="${n(w.post_score) ?? ''}">` : fmt(w.post_score, 1)}</td>
        <td class="num" data-c="post">${pctTxt(postPct(w))}</td><td class="num gain ${gainCls(gain(w))}" data-c="gain">${gainTxt(gain(w))}</td></tr>`).join('') +
      '</tbody></table></div></section>';
  }).join('');
}

/* ---------- الحفظ التلقائي ---------- */
const timers = new Map();
function rowChanged(tr) {
  const w = rows.find(x => x.id === tr.dataset.id); if (!w) return;
  const v = f => tr.querySelector(`[data-f="${f}"]`).value;
  const post = v('post_score').trim();
  const draft = { ...w, skills: v('skills').trim(), evidence: v('evidence').trim(), post_score: post === '' ? null : +post };
  tr.querySelector('[data-c=post]').textContent = pctTxt(postPct(draft));
  const g = gain(draft), gc = tr.querySelector('[data-c=gain]'); gc.textContent = gainTxt(g); gc.className = 'num gain ' + gainCls(g);
  clearTimeout(timers.get(w.id));
  timers.set(w.id, setTimeout(() => saveRow(tr, w, draft), 700));
}
async function saveRow(tr, w, draft) {
  if (draft.post_score !== null && (isNaN(draft.post_score) || draft.post_score < 0 || draft.post_score > (n(w.max_score) || 20))) {
    tr.classList.add('bad'); return RP.toast(`درجة الاختبار البعدي يجب أن تكون بين 0 و ${fmt(w.max_score)}`, true);
  }
  tr.classList.remove('bad'); tr.classList.add('saving');
  try {
    const r = await RP.api.saveWeak(RP.state.emp, { id: w.id, skills: draft.skills, evidence: draft.evidence, post_score: draft.post_score, notes: w.notes || '' });
    Object.assign(w, r && r.id ? { ...r, grade: +r.grade, section: +r.section } : draft);
    tr.classList.remove('saving'); tr.classList.add('saved'); setTimeout(() => tr.classList.remove('saved'), 1200);
    const ev = tr.querySelector('.ev'); const cell = tr.querySelector('[data-f=evidence]').parentElement;
    if (ev) ev.remove(); if (isUrl(w.evidence)) cell.insertAdjacentHTML('beforeend', `<a class="ev" href="${esc(w.evidence)}" target="_blank" rel="noopener">فتح الشاهد</a>`);
    refreshKpis();
  } catch (e) { tr.classList.remove('saving'); tr.classList.add('bad'); RP.toast(RP.errMsg(e), true); }
}
let kT; function refreshKpis() { clearTimeout(kT); kT = setTimeout(() => { const y = scrollY; const a = document.activeElement; if (a && a.closest && a.closest('.wtbl')) return; render(); scrollTo(0, y); }, 1500); }

/* ---------- تقرير PDF (للمدير) ---------- */
function today() { const d = new Date(); let h = ''; try { h = d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch {} return h + ' — ' + d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }); }
function reportHtml(list) {
  const gs = groups(list), st = stats(list), u = RP.state.user || {};
  const s = el('wSubject').value, g = el('wGrade').value, sec = el('wSection').value, t = el('wTeacher').value;
  const scope = [s, g && 'الصف ' + GRADE_LONG[g], sec && g && `فصل ${GRADE_SHORT[g]} ${sec}`, t && 'المعلم: ' + t].filter(Boolean).join(' · ') || 'جميع القوائم';
  const block = (g, i) => { const w0 = g[0], s = stats(g);
    return `<section class="r-sec w-blk${i ? ' w-pb' : ''}"><h3>${esc(w0.subject)} – ${esc(cls(w0))} – الصف ${GRADE_LONG[w0.grade]}</h3>
      <p class="w-sub">المعلم: <b>${esc(w0.teacher || '—')}</b> · عدد الطلاب ${fmt(s.n)} · قيس بعدياً ${fmt(s.measured)} · متوسط قبل ${pctTxt(s.pre)} · بعد ${pctTxt(s.post)} · التحسن ${gainTxt(s.gain)}</p>
      <table class="r-tbl w-tbl"><thead><tr><th>م</th><th>رقم الهوية</th><th>اسم الطالب</th><th>الدرجة (من ${fmt(w0.max_score)})</th><th>النسبة</th><th>المهارات المستهدفة</th><th>الشواهد</th><th>البعدي</th><th>النسبة البعدية</th><th>التحسن</th></tr></thead><tbody>` +
      g.map((w, k) => `<tr><td class="n">${fmt(k + 1)}</td><td class="n ltr">${esc(w.student_no)}</td><td><b>${esc(w.full_name)}</b></td><td class="n">${fmt(w.pre_score, 1)}</td><td class="n">${pctTxt(prePct(w))}</td>
        <td>${esc(w.skills) || '<span class="r-mute">—</span>'}</td><td>${isUrl(w.evidence) ? `<a href="${esc(w.evidence.trim())}">رابط الشاهد</a>` : esc(w.evidence) || '<span class="r-mute">—</span>'}</td>
        <td class="n">${n(w.post_score) === null ? '—' : fmt(w.post_score, 1)}</td><td class="n">${pctTxt(postPct(w))}</td><td class="n w-g ${gainCls(gain(w))}">${gainTxt(gain(w))}</td></tr>`).join('') +
      `</tbody></table><div class="w-sign"><span>توقيع المعلم: ....................................</span><span>الوكيل التعليمي: أمير المشد ....................</span></div></section>`; };
  return `<article class="r-sheet w-sheet">
    <header class="r-head"><img src="logo.webp?v=1" alt="" class="r-logo"><div class="r-ttl"><small>${esc(CFG.SCHOOL_NAME || '')} · الخطط العلاجية للاختبار التكويني ${esc(CFG.YEAR || '')}هـ</small><h2>تقرير الطلاب الضعاف ومتابعة التحسن</h2><p>${esc(scope)}</p></div></header>
    <div class="r-meta"><span>تاريخ الإصدار: ${today()}</span><span>أصدره: ${esc(u.full_name || '')}</span></div>
    <div class="r-kpis"><div><span>عدد الطلاب</span><b>${fmt(st.n)}</b><small>${fmt(gs.length)} قائمة</small></div><div><span>تم قياسهم بعدياً</span><b>${fmt(st.measured)}</b><small>${st.n ? fmt(st.measured / st.n * 100) + '%' : '—'}</small></div>
      <div><span>متوسط قبل / بعد</span><b>${pctTxt(st.pre)} / ${pctTxt(st.post)}</b></div><div><span>متوسط التحسن</span><b>${gainTxt(st.gain)}</b><small>${fmt(st.up)} طالب تحسّن</small></div></div>
    ${gs.length > 1 ? `<section class="r-sec"><h3>ملخص القوائم</h3><table class="r-tbl"><thead><tr><th>المادة / الفصل</th><th>المعلم</th><th>الطلاب</th><th>قيس بعدياً</th><th>متوسط قبل</th><th>متوسط بعد</th><th>متوسط التحسن</th><th>المتحسنون</th></tr></thead><tbody>${gs.map(g => { const s = stats(g);
      return `<tr><td><b>${esc(g[0].subject)} – ${esc(cls(g[0]))}</b></td><td>${esc(g[0].teacher || '—')}</td><td class="n">${fmt(s.n)}</td><td class="n">${fmt(s.measured)}</td><td class="n">${pctTxt(s.pre)}</td><td class="n">${pctTxt(s.post)}</td><td class="n">${gainTxt(s.gain)}</td><td class="n">${fmt(s.up)}</td></tr>`; }).join('')}</tbody></table></section>` : ''}
    ${gs.map(block).join('')}
    <footer class="r-foot">${COPY}</footer></article>`;
}
function printPdf() {
  if (!RP.isAdmin()) return;
  const list = filtered(); if (!list.length) return;
  const host = el('printHost'); host.innerHTML = reportHtml(list);
  const t = document.title; document.title = 'تقرير الطلاب الضعاف' + (el('wSubject').value ? ' - ' + el('wSubject').value : '');
  document.body.classList.add('rprint', 'rland');
  const done = () => { document.body.classList.remove('rprint', 'rland'); host.innerHTML = ''; document.title = t; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const imgs = [...host.querySelectorAll('img')].filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
}

function bind() {
  if (bound) return; bound = true;
  ['wSubject', 'wGrade', 'wSection', 'wTeacher', 'wState'].forEach(id => el(id).addEventListener('input', render));
  let sT; el('wSearch').addEventListener('input', () => { clearTimeout(sT); sT = setTimeout(render, 250); });
  el('wReset').onclick = () => { ['wSubject', 'wGrade', 'wSection', 'wTeacher', 'wState', 'wSearch'].forEach(id => el(id).value = ''); render(); };
  el('wPdf').onclick = printPdf;
  el('wBody').addEventListener('input', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.dataset.f) rowChanged(tr); });
  el('wBody').addEventListener('focusin', e => { if (e.target.tagName === 'TEXTAREA') e.target.rows = 3; });
  el('wBody').addEventListener('focusout', e => { if (e.target.tagName === 'TEXTAREA') e.target.rows = 1; });
}
window.renderWeak = async () => { bind(); await load(); render(); };
})();
