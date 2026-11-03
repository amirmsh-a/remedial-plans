/* الخطط العلاجية للاختبار التكويني 1448 */
(() => {
'use strict';
const CFG = window.APP_CONFIG || {};
const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

const SUBJECTS = ['الرياضيات', 'العلوم', 'اللغة العربية', 'اللغة الإنجليزية'];
const GRADE_LONG = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const GRADE_SHORT = ['', 'أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس'];
// بنية المجلد: المادة → الصف → عدد الفصول
const SECTIONS = { 1: 4, 2: 3, 3: 5, 4: 6, 5: 7, 6: 7 };
const STRUCTURE = Object.fromEntries(SUBJECTS.map(s => [s, SECTIONS]));
const SUBJ_ABBR = { 'الرياضيات': 'ر', 'العلوم': 'ع', 'اللغة العربية': 'عر', 'اللغة الإنجليزية': 'En' };
const SUBJ_COLOR = { 'الرياضيات': '#14806a', 'العلوم': '#3d6fb6', 'اللغة العربية': '#c8912b', 'اللغة الإنجليزية': '#8a4fb0' };
// [المفتاح، الاسم، اسم المجلد في OneDrive]
const COMPONENTS = [
  ['results', 'نتائج الطلاب', 'نتائج الطلاب'], ['classification', 'تصنيف الطلاب', 'تصنيف الطلاب'],
  ['plan', 'الخطة العلاجية', 'الخطط العلاجية'], ['evidence', 'شواهد الخطة العلاجية', 'شواهد الخطط العلاجية'],
  ['followup', 'سجل المتابعة', 'سجل المتابعة'], ['parents', 'إشعارات أولياء الأمور', 'إشعارات أولياء الأمور'],
  ['curriculum', 'توزيع المنهج', 'توزيع المنهج'], ['impact', 'قياس أثر الخطة العلاجية', 'قياس أثر الخطة العلاجية']
];
const STATUSES = ['لم تبدأ', 'قيد التنفيذ', 'مكتملة'];
const SESSION_KEY = 'rp_session_v1';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
const classLabel = p => `فصل ${GRADE_SHORT[p.grade] || p.grade} ${p.section}`;
const completion = p => Math.round(COMPONENTS.filter(([k]) => p.components && p.components[k]).length / COMPONENTS.length * 100);
const fmt = (v, d = 0) => v === null || v === undefined || isNaN(v) ? '—' : (+v).toLocaleString('ar-SA', { maximumFractionDigits: d });
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2));

/* ---------------- طبقة البيانات ---------------- */
async function rpc(fn, args) {
  const base = CFG.SUPABASE_URL.replace(/\/$/, '');
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) {
    const m = (d && (d.message || d.hint)) || t || r.statusText;
    if (/unauthorized/i.test(m)) throw new Error('unauthorized');
    if (/forbidden/i.test(m)) throw new Error('forbidden');
    throw new Error(m);
  }
  return d;
}
const remoteApi = {
  login: e => rpc('app_login', { p_emp: e }),
  listPlans: e => rpc('plans_list', { p_emp: e }),
  savePlan: (e, p) => rpc('plan_save', { p_emp: e, p }),
  deletePlan: (e, id) => rpc('plan_delete', { p_emp: e, p_id: id }),
  listUsers: e => rpc('users_list', { p_emp: e }),
  saveUser: (e, u) => rpc('user_save', { p_emp: e, p_id: u.emp_id, p_name: u.full_name, p_role: u.role, p_active: u.active, p_perms: u.perms || {}, p_scope: u.scope || {} }),
  deleteUser: (e, id) => rpc('user_delete', { p_emp: e, p_id: id }),
  listLinks: e => rpc('links_list', { p_emp: e }),
  addLink: (e, l) => rpc('link_add', { p_emp: e, p: l }),
  deleteLink: (e, id) => rpc('link_delete', { p_emp: e, p_id: id })
};

function blankPlan(subject, grade, section) {
  return { id: uid(), subject, grade, section, teacher: '', test_date: null, students_total: null, students_weak: null,
    weak_skills: '', strategies: '', start_date: null, end_date: null, pre_score: null, post_score: null,
    components: {}, status: 'لم تبدأ', notes: '', updated_by: null, updated_at: new Date().toISOString() };
}
function demoSeed() {
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const plans = [];
  for (const s of SUBJECTS) for (const g in STRUCTURE[s]) for (let i = 1; i <= STRUCTURE[s][g]; i++) {
    const p = blankPlan(s, +g, i);
    if (rnd() < 0.8) {
      const total = 22 + Math.floor(rnd() * 10), weak = 2 + Math.floor(rnd() * 8);
      p.students_total = total; p.students_weak = weak;
      COMPONENTS.forEach(([k], idx) => { if (rnd() < 0.85 - idx * 0.08) p.components[k] = true; });
      p.pre_score = Math.round(45 + rnd() * 20); p.post_score = p.components.impact ? Math.round(p.pre_score + 5 + rnd() * 20) : null;
      const c = completion(p); p.status = c === 100 ? 'مكتملة' : c > 0 ? 'قيد التنفيذ' : 'لم تبدأ';
      p.weak_skills = s === 'الرياضيات' ? 'القيمة المنزلية، الجمع مع إعادة التجميع' : 'تصنيف الكائنات الحية، دورة الماء';
      p.strategies = 'التعلم بالأقران، بطاقات علاجية، تدريبات فردية';
    }
    plans.push(p);
  }
  return plans;
}
const DEMO_USERS_KEY = 'rp_demo_users', DEMO_PLANS_KEY = 'rp_demo_plans';
const localApi = {
  _users() { let u = store.get(DEMO_USERS_KEY, null); if (!u) { u = [{ emp_id: '1000', full_name: 'مدير تجريبي', role: 'admin', active: true }]; store.set(DEMO_USERS_KEY, u); } return u; },
  _plans() { let p = store.get(DEMO_PLANS_KEY, null); if (!p) { p = demoSeed(); store.set(DEMO_PLANS_KEY, p); } return p; },
  _check(e, perm) { const u = this._users().find(x => x.emp_id === String(e).trim() && x.active); if (!u) throw new Error('unauthorized'); if (perm && !userCan(u, perm)) throw new Error('forbidden'); return u; },
  async login(e) { const u = this._check(e); return { emp_id: u.emp_id, full_name: u.full_name, role: u.role, perms: u.perms || {}, scope: u.scope || {} }; },
  async listPlans(e) { const u = this._check(e); return this._plans().filter(p => inScope(u, p.subject, p.grade, p.section)); },
  async savePlan(e, p) {
    const u = this._check(e, p.id ? 'edit_plans' : 'add_plans'); if (!inScope(u, p.subject, p.grade, p.section)) throw new Error('forbidden'); const all = this._plans();
    const row = { ...p, updated_by: u.full_name, updated_at: new Date().toISOString() };
    const i = all.findIndex(x => x.id === p.id);
    if (i >= 0) all[i] = row; else { row.id = uid(); all.push(row); }
    store.set(DEMO_PLANS_KEY, all); return row;
  },
  async deletePlan(e, id) { this._check(e, 'delete_plans'); store.set(DEMO_PLANS_KEY, this._plans().filter(x => x.id !== id)); return true; },
  async listUsers(e) { this._check(e, 'manage_users'); return this._users(); },
  async saveUser(e, u) {
    const me = this._check(e, 'manage_users'); if (me.role !== 'admin' && (u.role === 'admin' || (u.perms || {}).manage_users)) throw new Error('forbidden');
    if (u.emp_id === me.emp_id && (u.role !== me.role || !u.active)) throw new Error('لا يمكنك تغيير دورك أو إيقاف حسابك');
    const all = this._users(); const i = all.findIndex(x => x.emp_id === u.emp_id);
    if (i >= 0) all[i] = { ...all[i], ...u }; else all.push(u); store.set(DEMO_USERS_KEY, all); return true;
  },
  _links() { return store.get('rp_demo_links', []); },
  async listLinks(e) { const u = this._check(e); return this._links().filter(l => (['admin', 'supervisor'].includes(u.role) || l.kind !== 'folder' || l.section != null)).filter(l => u.role === 'admin' || (l.grade == null ? (!((u.scope || {}).subjects || []).length || u.scope.subjects.includes(l.subject)) : inScope(u, l.subject, l.grade, l.section))); },
  async addLink(e, l) {
    const u = this._check(e, 'add_links'); const g = (u.scope || {}).grades || [];
    if (!inScope(u, l.subject, l.grade || (g.length ? -1 : 1), l.section)) throw new Error('forbidden');
    if (!/^https:\/\/\S+$/i.test(l.url || '')) throw new Error('الرابط يجب أن يبدأ بـ https://');
    let all = this._links(); const norm = v => v == null || v === '' ? null : v;
    const row = { id: uid(), subject: l.subject, grade: norm(l.grade), section: norm(l.section), component: norm(l.component), kind: l.kind || 'file', title: l.title || (l.kind === 'folder' ? 'رابط مشاركة المجلد' : 'رابط'), url: l.url, added_by: u.full_name, added_by_emp: u.emp_id, created_at: new Date().toISOString() };
    if (row.kind === 'folder') all = all.filter(x => !(x.kind === 'folder' && x.subject === row.subject && x.grade === row.grade && x.section === row.section && x.component === row.component));
    all.push(row); store.set('rp_demo_links', all); return row;
  },
  async deleteLink(e, id) { const u = this._check(e); const l = this._links().find(x => x.id === id); if (!l) return false; if (l.added_by_emp !== u.emp_id && !userCan(u, 'delete_plans')) throw new Error('forbidden'); store.set('rp_demo_links', this._links().filter(x => x.id !== id)); return true; },
  async deleteUser(e, id) { const me = this._check(e, 'manage_users'); if (me.emp_id === id) throw new Error('لا يمكنك حذف حسابك'); store.set(DEMO_USERS_KEY, this._users().filter(x => x.emp_id !== id)); return true; }
};
const api = DEMO ? localApi : remoteApi;

/* ---------------- الأدوار والصلاحيات ---------------- */
const ROLES = { admin: 'مدير', supervisor: 'مشرف', teacher: 'معلم', viewer: 'مشاهد' };
const PERMS = [
  ['view_dashboard', 'عرض لوحة الإحصاء'], ['add_plans', 'إضافة خطط'], ['edit_plans', 'تعديل الخطط وتعبئتها'],
  ['delete_plans', 'حذف الخطط'], ['export', 'تصدير البيانات'], ['add_links', 'إضافة روابط للمجلدات'], ['manage_users', 'إدارة المستخدمين']
];
const PRESETS = {
  admin: Object.fromEntries(PERMS.map(([k]) => [k, true])),
  supervisor: { view_dashboard: true, add_plans: true, edit_plans: true, delete_plans: true, export: true, add_links: true },
  teacher: { view_dashboard: true, edit_plans: true, add_links: true },
  viewer: { view_dashboard: true, export: true }
};
function userCan(u, p) { return u.role === 'admin' || !!(u.perms || {})[p]; }
// النطاق: المواد + الصفوف + الفصول (classes = ["4-1","4-3"]؛ صف بلا فصول محددة = كل فصوله)
function inScope(u, subject, grade, section) {
  if (u.role === 'admin') return true;
  const sc = u.scope || {}, s = sc.subjects || [], g = sc.grades || [], c = sc.classes || [];
  if (s.length && !s.includes(subject)) return false;
  if (g.length && !g.includes(+grade)) return false;
  if (section == null) return true;
  const own = c.filter(x => x.split('-')[0] === String(+grade));
  return !own.length || own.includes(+grade + '-' + +section);
}

/* ---------------- الحالة ---------------- */
const state = { user: null, emp: null, plans: [], users: [], view: 'dashboard', charts: {}, sort: { key: 'default', dir: 1 } };
const isAdmin = () => state.user && state.user.role === 'admin';
const can = p => !!state.user && userCan(state.user, p);
const userScope = () => (state.user && state.user.role !== 'admin' && state.user.scope) || {};
const allowedSubjects = () => (userScope().subjects || []).length ? userScope().subjects : SUBJECTS;
const allowedGrades = () => ((userScope().grades || []).length ? userScope().grades : [1, 2, 3, 4, 5, 6]).map(Number).sort((a, b) => a - b);

/* ---------------- أدوات الواجهة ---------------- */
let toastT, rzT;
window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => state.view === 'dashboard' && state.user && renderDashboard(), 200); });
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 2800);
}
function errMsg(e) {
  const m = e && e.message || String(e);
  if (m === 'unauthorized') return 'الرقم الوظيفي غير مسجل أو غير مفعّل';
  if (m === 'forbidden') return 'ليست لديك صلاحية لهذه العملية';
  if (/Failed to fetch/i.test(m)) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت';
  return m;
}
function confirmBox(msg) {
  return new Promise(res => {
    const d = $('#confirmDialog'); $('#confirmMsg').textContent = msg;
    const done = v => { d.close(); $('#confirmYes').onclick = $('#confirmNo').onclick = null; res(v); };
    $('#confirmYes').onclick = () => done(true); $('#confirmNo').onclick = () => done(false);
    d.showModal();
  });
}
function fillSelect(el, items, keepFirst = true) {
  const first = keepFirst ? el.querySelector('option') : null;
  el.innerHTML = ''; if (first) el.appendChild(first);
  items.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; el.appendChild(o); });
}
const gradeOptions = subject => {
  const set = new Set();
  state.plans.filter(p => !subject || p.subject === subject).forEach(p => set.add(+p.grade));
  return [...set].sort((a, b) => a - b).map(g => [g, 'الصف ' + GRADE_LONG[g]]);
};

/* ---------------- الدخول ---------------- */
async function doLogin(emp, silent) {
  const u = await api.login(emp);
  state.user = u; state.emp = String(emp).trim();
  store.set(SESSION_KEY, state.emp);
  $('#login').hidden = true; $('#app').hidden = false;
  $('#whoName').textContent = u.full_name + ' · ' + (ROLES[u.role] || u.role);
  $('[data-view=users]').hidden = !can('manage_users');
  $('[data-view=dashboard]').hidden = !can('view_dashboard');
  $('#addBtn').hidden = !can('add_plans');
  $('#exportBtn').hidden = !can('export');
  await loadPlans();
  showView(location.hash.startsWith('#folders') ? 'folders' : state.view);
  if (!silent) toast('أهلاً ' + u.full_name);
}
function logout() {
  store.del(SESSION_KEY); state.user = state.emp = null; state.plans = []; state.view = 'dashboard';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  $('#app').hidden = true; $('#login').hidden = false; $('#empId').value = ''; $('#empId').focus();
}

async function loadPlans() {
  const rows = await api.listPlans(state.emp);
  state.plans = (rows || []).map(p => ({ ...p, grade: +p.grade, section: +p.section, components: p.components || {} }));
  refreshFilterOptions();
}

/* ---------------- التنقل ---------------- */
function showView(v) {
  if (v === 'users' && !can('manage_users')) v = can('view_dashboard') ? 'dashboard' : 'plans';
  if (v === 'dashboard' && !can('view_dashboard')) v = 'plans';
  state.view = v;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  $$('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
  if (v === 'dashboard') renderDashboard();
  if (v === 'plans') renderPlans();
  if (v === 'users') loadUsers();
  if (v === 'folders' && window.renderFolders) window.renderFolders();
  if (v !== 'folders' && location.hash.startsWith('#folders')) history.replaceState(null, '', location.pathname + location.search);
}

/* ---------------- الفلاتر ---------------- */
function refreshFilterOptions() {
  const subs = subjectsOf(state.plans).map(s => [s, s]);
  ['#fSubject', '#dSubject'].forEach(id => { const el = $(id), v = el.value; fillSelect(el, subs); el.value = v; });
  syncGradeOptions('#fSubject', '#fGrade'); syncGradeOptions('#dSubject', '#dGrade');
  const sec = [...new Set(state.plans.map(p => p.section))].sort((a, b) => a - b).map(s => [s, 'فصل ' + s]);
  const fs = $('#fSection'), fv = fs.value; fillSelect(fs, sec); fs.value = fv;
  const st = $('#fStatus'), sv = st.value; fillSelect(st, STATUSES.map(s => [s, s])); st.value = sv;
}
function syncGradeOptions(subSel, gradeSel) {
  const el = $(gradeSel), v = el.value; fillSelect(el, gradeOptions($(subSel).value));
  el.value = [...el.options].some(o => o.value === v) ? v : '';
}
function filteredPlans() {
  const q = $('#fSearch').value.trim().toLowerCase();
  const s = $('#fSubject').value, g = $('#fGrade').value, sec = $('#fSection').value, st = $('#fStatus').value, c = $('#fCompletion').value;
  return state.plans.filter(p => {
    if (s && p.subject !== s) return false;
    if (g && p.grade !== +g) return false;
    if (sec && p.section !== +sec) return false;
    if (st && p.status !== st) return false;
    const pc = completion(p);
    if (c === '0' && pc !== 0) return false;
    if (c === 'low' && !(pc < 50)) return false;
    if (c === 'mid' && !(pc >= 50 && pc < 100)) return false;
    if (c === 'full' && pc !== 100) return false;
    if (q) {
      const hay = [p.subject, classLabel(p), p.teacher, p.weak_skills, p.strategies, p.notes, p.status].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
const subjectsOf = list => [...new Set(list.map(p => p.subject))].sort((a, b) => (SUBJECTS.indexOf(a) + 1 || 99) - (SUBJECTS.indexOf(b) + 1 || 99));
const defaultOrder = (a, b) => SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject) || a.grade - b.grade || a.section - b.section;

/* ---------------- جدول الخطط ---------------- */
function renderPlans() {
  const rows = filteredPlans();
  const { key, dir } = state.sort;
  const getters = { teacher: p => p.teacher || '', weak: p => num(p.students_weak) ?? -1, completion: completion, status: p => STATUSES.indexOf(p.status), updated: p => p.updated_at || '' };
  rows.sort((a, b) => {
    if (key === 'default' || !getters[key]) return defaultOrder(a, b);
    const x = getters[key](a), y = getters[key](b);
    return (x > y ? 1 : x < y ? -1 : 0) * dir || defaultOrder(a, b);
  });
  $('#plansCount').textContent = `عدد النتائج: ${fmt(rows.length)} من ${fmt(state.plans.length)}`;
  const th = (k, t) => `<th${k ? ` data-sort="${k}" style="cursor:pointer"` : ''}>${t}${k && key === k ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  const head = `<thead><tr>${th('', 'المادة')}${th('', 'الصف / الفصل')}${th('teacher', 'المعلم')}${th('weak', 'المتعثرون')}${th('completion', 'إنجاز المكونات')}${th('', 'التحسن')}${th('status', 'الحالة')}${th('updated', 'آخر تحديث')}<th></th></tr></thead>`;
  if (!rows.length) { $('#plansTbl').innerHTML = head + `<tbody><tr><td colspan="9" class="empty">لا توجد خطط مطابقة للفلاتر</td></tr></tbody>`; return; }
  const body = rows.map(p => {
    const c = completion(p), pre = num(p.pre_score), post = num(p.post_score);
    const imp = pre !== null && post !== null ? (post - pre) : null;
    const weak = num(p.students_weak), tot = num(p.students_total);
    return `<tr>
      <td>${esc(p.subject)}</td>
      <td><b>${esc(classLabel(p))}</b></td>
      <td>${esc(p.teacher) || '<span class="muted">—</span>'}</td>
      <td class="num">${weak === null ? '—' : fmt(weak) + (tot ? ` / ${fmt(tot)}` : '')}</td>
      <td><div class="progress"><div class="bar ${c === 100 ? 'full' : c < 50 ? 'low' : ''}"><i style="width:${c}%"></i></div><span class="num">${fmt(c)}%</span></div></td>
      <td class="num">${imp === null ? '—' : (imp >= 0 ? '+' : '') + fmt(imp, 1) + '%'}</td>
      <td><span class="pill s${Math.max(0, STATUSES.indexOf(p.status))}">${esc(p.status)}</span></td>
      <td class="muted sm">${p.updated_at ? new Date(p.updated_at).toLocaleDateString('ar-SA-u-ca-islamic-umalqura') : '—'}${p.updated_by ? '<br>' + esc(p.updated_by) : ''}</td>
      <td><button class="icon-btn edit" data-edit="${esc(p.id)}">${can('edit_plans') ? 'تعديل' : 'عرض'}</button>${can('delete_plans') ? `<button class="icon-btn del" data-del="${esc(p.id)}">حذف</button>` : ''}</td>
    </tr>`;
  }).join('');
  $('#plansTbl').innerHTML = head + '<tbody>' + body + '</tbody>';
}

/* ---------------- نموذج الخطة ---------------- */
function openPlan(p, preset) {
  const f = $('#planForm'); const isNew = !p; preset = preset || {};
  p = p || blankPlan(preset.subject || $('#fSubject').value || allowedSubjects()[0], +(preset.grade || $('#fGrade').value || allowedGrades()[0]), +(preset.section || $('#fSection').value || 1));
  const ro = !(isNew ? can('add_plans') : can('edit_plans'));
  $('#planTitle').textContent = isNew ? 'إضافة خطة علاجية' : `${ro ? 'عرض' : 'تعديل'} خطة ${p.subject} – ${classLabel(p)}`;
  const subjOpts = allowedSubjects(), gradeOpts = allowedGrades();
  fillSelect(f.subject, [...new Set([...subjOpts, p.subject])].map(s => [s, s]), false);
  fillSelect(f.grade, [...new Set([...gradeOpts, +p.grade])].map(g => [g, 'الصف ' + GRADE_LONG[g]]), false);
  fillSelect(f.status, STATUSES.map(s => [s, s]), false);
  f.id.value = isNew ? '' : p.id;
  ['subject', 'grade', 'section', 'teacher', 'test_date', 'status', 'students_total', 'students_weak', 'start_date', 'end_date', 'pre_score', 'post_score', 'weak_skills', 'strategies', 'notes']
    .forEach(k => { f[k].value = p[k] ?? ''; });
  $('#compChecks').innerHTML = COMPONENTS.map(([k, t]) => `<label><input type="checkbox" name="c_${k}" ${p.components && p.components[k] ? 'checked' : ''}> ${t}</label>`).join('');
  $('#planErr').textContent = '';
  [...f.elements].forEach(el => { if (el.type !== 'button' && el.type !== 'submit' && el.type !== 'hidden') el.disabled = ro; });
  $('#planSave').hidden = ro;
  $('#planDialog').showModal();
}
async function savePlan(ev) {
  ev.preventDefault();
  const f = $('#planForm');
  const p = { id: f.id.value || undefined, subject: f.subject.value, grade: +f.grade.value, section: +f.section.value,
    teacher: f.teacher.value.trim(), test_date: f.test_date.value || null, status: f.status.value,
    students_total: num(f.students_total.value), students_weak: num(f.students_weak.value),
    start_date: f.start_date.value || null, end_date: f.end_date.value || null,
    pre_score: num(f.pre_score.value), post_score: num(f.post_score.value),
    weak_skills: f.weak_skills.value.trim(), strategies: f.strategies.value.trim(), notes: f.notes.value.trim(), components: {} };
  COMPONENTS.forEach(([k]) => { if (f['c_' + k].checked) p.components[k] = true; });
  if (!p.section || p.section < 1) return $('#planErr').textContent = 'أدخل رقم الفصل';
  if (p.students_weak !== null && p.students_total !== null && p.students_weak > p.students_total) return $('#planErr').textContent = 'عدد المتعثرين أكبر من عدد الطلاب';
  if (!p.id && state.plans.some(x => x.subject === p.subject && x.grade === p.grade && x.section === p.section))
    return $('#planErr').textContent = 'توجد خطة لهذا الفصل في هذه المادة، استخدم التعديل';
  if (!p.id) delete p.id;
  const btn = $('#planSave'); btn.disabled = true;
  try {
    await api.savePlan(state.emp, p);
    $('#planDialog').close(); await loadPlans(); showView(state.view); toast('تم حفظ الخطة');
  } catch (e) { $('#planErr').textContent = errMsg(e); }
  finally { btn.disabled = false; }
}
async function deletePlan(id) {
  const p = state.plans.find(x => x.id === id); if (!p) return;
  if (!(await confirmBox(`حذف خطة ${p.subject} – ${classLabel(p)}؟ لا يمكن التراجع.`))) return;
  try { await api.deletePlan(state.emp, id); await loadPlans(); renderPlans(); toast('تم الحذف'); }
  catch (e) { toast(errMsg(e), true); }
}
function exportCSV() {
  const rows = filteredPlans().sort(defaultOrder);
  const head = ['المادة', 'الصف', 'الفصل', 'المعلم', 'تاريخ الاختبار', 'عدد الطلاب', 'المتعثرون', 'نسبة الإنجاز', ...COMPONENTS.map(c => c[1]), 'قبل', 'بعد', 'المهارات', 'الاستراتيجيات', 'الحالة', 'ملاحظات'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(',')].concat(rows.map(p => [p.subject, GRADE_LONG[p.grade], p.section, p.teacher, p.test_date, p.students_total, p.students_weak, completion(p) + '%',
    ...COMPONENTS.map(([k]) => p.components[k] ? 'نعم' : 'لا'), p.pre_score, p.post_score, p.weak_skills, p.strategies, p.status, p.notes].map(q).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'الخطط_العلاجية_' + (CFG.YEAR || '') + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- لوحة الإحصاء ---------------- */
const PALETTE = { brand: '#14806a', brandSoft: 'rgba(20,128,106,.25)', gold: '#c8912b', red: '#c0453c', grey: '#9aa7a3', math: '#14806a', sci: '#3d6fb6' };
function dashPlans() {
  const s = $('#dSubject').value, g = $('#dGrade').value;
  return state.plans.filter(p => (!s || p.subject === s) && (!g || p.grade === +g)).sort(defaultOrder);
}
function renderDashboard() {
  const rows = dashPlans();
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const comp = rows.map(completion);
  const totalStudents = rows.reduce((s, p) => s + (num(p.students_total) || 0), 0);
  const totalWeak = rows.reduce((s, p) => s + (num(p.students_weak) || 0), 0);
  const withImpact = rows.filter(p => num(p.pre_score) !== null && num(p.post_score) !== null);
  const impact = avg(withImpact.map(p => p.post_score - p.pre_score));
  const done = rows.filter(p => completion(p) === 100).length;
  $('#kpis').innerHTML = [
    ['عدد الخطط (الفصول)', fmt(rows.length), `${fmt(new Set(rows.map(p => p.subject)).size)} مادة`, ''],
    ['متوسط إنجاز المكونات', fmt(avg(comp)) + '%', `${fmt(done)} خطة مكتملة`, ''],
    ['الطلاب المتعثرون', fmt(totalWeak), totalStudents ? `${fmt(totalWeak / totalStudents * 100, 1)}% من ${fmt(totalStudents)} طالب` : 'لم تُدخل أعداد الطلاب', 'red'],
    ['متوسط التحسن بعد الخطة', impact === null ? '—' : (impact >= 0 ? '+' : '') + fmt(impact, 1) + '%', `من ${fmt(withImpact.length)} فصل مقاس`, 'gold'],
    ['خطط لم تبدأ', fmt(rows.filter(p => completion(p) === 0).length), 'بحاجة متابعة', '']
  ].map(([l, v, s, c]) => `<div class="kpi ${c}"><div class="lbl">${l}</div><div class="val num">${v}</div><div class="sub">${s}</div></div>`).join('');

  const showSubj = !$('#dSubject').value;
  const labels = rows.map(p => (showSubj ? (SUBJ_ABBR[p.subject] || p.subject.slice(0, 2)) + ' ' : '') + GRADE_SHORT[p.grade] + ' ' + p.section);
  const full = rows.map(p => p.subject + ' – ' + classLabel(p));
  const colors = rows.map(p => SUBJ_COLOR[p.subject] || PALETTE.math);
  const legendSubj = showSubj ? [...new Set(rows.map(p => p.subject))].map(s => [s + ' (' + (SUBJ_ABBR[s] || s.slice(0, 2)) + ')', SUBJ_COLOR[s] || PALETTE.math]) : null;

  barChart('cCompletion', { labels, full, max: 100, suffix: '%', legend: legendSubj, series: [{ name: 'الإنجاز', data: comp, colors }] });
  const weakPct = rows.map(p => num(p.students_total) ? +(100 * (num(p.students_weak) || 0) / p.students_total).toFixed(1) : null);
  barChart('cWeak', { labels, full, suffix: '%', series: [{ name: 'نسبة التعثر', data: weakPct, color: PALETTE.red }] });
  barChart('cImpact', { labels, full, max: 100, suffix: '%', legend: [['قبل الخطة', PALETTE.grey], ['بعد الخطة', PALETTE.gold]], series: [
    { name: 'قبل الخطة', data: rows.map(p => num(p.pre_score)), color: PALETTE.grey },
    { name: 'بعد الخطة', data: rows.map(p => num(p.post_score)), color: PALETTE.gold }] });
  const compPct = COMPONENTS.map(([k]) => rows.length ? Math.round(rows.filter(p => p.components[k]).length / rows.length * 100) : 0);
  hBarChart('cComponents', COMPONENTS.map(c => c[1]), compPct, PALETTE.brand);
  renderTables(rows);
}
function renderTables(rows) {
  // ملخص حسب المادة والصف
  const groups = {};
  rows.forEach(p => { const k = p.subject + '|' + p.grade; (groups[k] = groups[k] || []).push(p); });
  const keys = Object.keys(groups).sort((a, b) => { const [sa, ga] = a.split('|'), [sb, gb] = b.split('|'); return SUBJECTS.indexOf(sa) - SUBJECTS.indexOf(sb) || ga - gb; });
  const sumRow = (label, list, strong) => {
    const tot = list.reduce((s, p) => s + (num(p.students_total) || 0), 0), weak = list.reduce((s, p) => s + (num(p.students_weak) || 0), 0);
    const imp = list.filter(p => num(p.pre_score) !== null && num(p.post_score) !== null).map(p => p.post_score - p.pre_score);
    const c = list.length ? Math.round(list.reduce((s, p) => s + completion(p), 0) / list.length) : 0;
    const tag = strong ? 'th' : 'td';
    return `<tr${strong ? ' style="background:#f7faf9"' : ''}><${tag}>${label}</${tag}><td class="num">${fmt(list.length)}</td><td class="num">${fmt(list.filter(p => completion(p) === 100).length)}</td>
      <td><div class="progress"><div class="bar ${c === 100 ? 'full' : c < 50 ? 'low' : ''}"><i style="width:${c}%"></i></div><span class="num">${fmt(c)}%</span></div></td>
      <td class="num">${fmt(tot)}</td><td class="num">${fmt(weak)}</td><td class="num">${tot ? fmt(weak / tot * 100, 1) + '%' : '—'}</td>
      <td class="num">${imp.length ? '+' + fmt(imp.reduce((a, b) => a + b, 0) / imp.length, 1) + '%' : '—'}</td></tr>`;
  };
  $('#summaryTbl').innerHTML = `<thead><tr><th>المادة / الصف</th><th>الفصول</th><th>مكتملة</th><th>متوسط الإنجاز</th><th>الطلاب</th><th>المتعثرون</th><th>نسبة التعثر</th><th>متوسط التحسن</th></tr></thead><tbody>` +
    (keys.length ? keys.map(k => { const [s, g] = k.split('|'); return sumRow(`${esc(s)} – الصف ${GRADE_LONG[g]}`, groups[k]); }).join('') + sumRow('الإجمالي', rows, true)
      : '<tr><td colspan="8" class="empty">لا توجد بيانات</td></tr>') + '</tbody>';
  // مصفوفة مكونات كل فصل
  $('#matrixTbl').innerHTML = `<thead><tr><th>المادة</th><th>الفصل</th>${COMPONENTS.map(c => `<th class="c">${c[1]}</th>`).join('')}<th class="c">الإنجاز</th></tr></thead><tbody>` +
    (rows.length ? rows.map(p => `<tr><td>${esc(p.subject)}</td><td><b>${esc(classLabel(p))}</b></td>${COMPONENTS.map(([k]) => p.components[k] ? '<td class="c yes">✔</td>' : '<td class="c no">—</td>').join('')}<td class="c num"><b>${fmt(completion(p))}%</b></td></tr>`).join('')
      : '<tr><td colspan="11" class="empty">لا توجد بيانات</td></tr>') + '</tbody>';
}


/* ---------------- رسوم بيانية SVG (بدون مكتبات خارجية) ---------------- */
function barChart(id, { labels, full, series, max, suffix = '', legend }) {
  const el = document.getElementById(id); if (!el) return;
  const n = labels.length;
  if (!n || series.every(s => s.data.every(v => v === null))) { el.innerHTML = '<div class="empty">لا توجد بيانات بعد</div>'; return; }
  const all = series.flatMap(s => s.data).filter(v => v !== null);
  const top = max || Math.max(10, Math.ceil(Math.max(...all) / 10) * 10);
  const W = Math.max(el.clientWidth || 600, n * series.length * 9 + 60), H = el.clientHeight || 300;
  const padL = 12, padR = 40, padT = legend ? 26 : 10, padB = 58;
  const cw = (W - padL - padR) / n, bw = Math.min(26, cw * 0.72 / series.length);
  const y = v => padT + (H - padT - padB) * (1 - v / top);
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" font-family="Tajawal, sans-serif" style="direction:ltr">`;
  for (let t = 0; t <= 4; t++) { const v = top * t / 4, yy = y(v);
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="#eef1f0"/><text x="${W - padR + 6}" y="${yy + 4}" font-size="10" fill="#5d6b67">${fmt(v)}${suffix}</text>`; }
  labels.forEach((lab, i) => {
    const cx = W - padR - cw * (i + .5); // من اليمين لليسار
    series.forEach((s, j) => {
      const v = s.data[i]; if (v === null || v === undefined) return;
      const x = cx - (bw * series.length) / 2 + bw * (series.length - 1 - j), yy = y(Math.min(v, top));
      const c = s.colors ? s.colors[i] : s.color;
      svg += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - 1.5).toFixed(1)}" height="${(H - padB - yy).toFixed(1)}" rx="3" fill="${c}"><title>${esc(full[i])}\n${esc(s.name)}: ${fmt(v, 1)}${suffix}</title></rect>`;
    });
    svg += `<text transform="translate(${cx + 3},${H - padB + 10}) rotate(-60)" text-anchor="end" font-size="10.5" fill="#5d6b67">${esc(lab)}</text>`;
  });
  svg += `<line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" stroke="#cfd8d5"/>`;
  if (legend) { let lx = W - padR; legend.forEach(([t, c]) => { svg += `<rect x="${lx - 12}" y="6" width="12" height="12" rx="3" fill="${c}"/><text x="${lx - 18}" y="16" font-size="12" text-anchor="end" fill="#15231f">${esc(t)}</text>`; lx -= 30 + t.length * 6.2; }); }
  el.innerHTML = `<div class="chart-scroll">${svg}</svg></div>`;
}
function hBarChart(id, labels, data, color) {
  const el = document.getElementById(id); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 300, labW = 150, padL = 44, rowH = (H - 16) / labels.length, bh = Math.min(22, rowH * .62);
  const x = v => padL + (W - labW - padL - 8) * v / 100;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" font-family="Tajawal, sans-serif" style="direction:ltr">`;
  labels.forEach((lab, i) => {
    const cy = 8 + rowH * (i + .5), right = W - labW - 8, w = x(data[i]) - padL;
    svg += `<text x="${W - 4}" y="${cy + 4}" font-size="12" text-anchor="end" fill="#15231f">${esc(lab)}</text>
      <rect x="${padL}" y="${cy - bh / 2}" width="${right - padL}" height="${bh}" rx="4" fill="#eef1f0"/>
      <rect x="${right - w}" y="${cy - bh / 2}" width="${Math.max(0, w)}" height="${bh}" rx="4" fill="${color}"><title>${esc(lab)}: ${data[i]}% من الفصول</title></rect>
      <text x="${right - w - 6}" y="${cy + 4}" font-size="11.5" text-anchor="end" font-weight="700" fill="#15231f">${fmt(data[i])}%</text>`;
  });
  el.innerHTML = svg + '</svg>';
}

/* ---------------- المستخدمون ---------------- */
async function loadUsers() {
  if (!$('#uPerms').children.length || $('#uRole').dataset.for !== state.emp) { buildUserForm(); $('#uRole').dataset.for = state.emp; }
  try { state.users = (await api.listUsers(state.emp) || []).map(u => ({ ...u, perms: u.perms || {}, scope: u.scope || {} })); renderUsers(); }
  catch (e) { toast(errMsg(e), true); }
}
const ROLE_ORDER = ['admin', 'supervisor', 'teacher', 'viewer'];
function scopeText(u) {
  if (u.role === 'admin') return 'الكل';
  const s = (u.scope || {}).subjects || [], g = (u.scope || {}).grades || [], c = (u.scope || {}).classes || [];
  const gradeText = x => { const own = c.filter(k => k.split('-')[0] === String(x)).map(k => k.split('-')[1]).sort((a, b) => a - b);
    return GRADE_LONG[x] + (own.length ? ' (فصل ' + own.join('، ') + ')' : ''); };
  return (s.length ? s.join('، ') : 'كل المواد') + ' · ' + (g.length ? 'الصفوف: ' + [...g].sort((a, b) => a - b).map(gradeText).join('، ') : 'كل الصفوف');
}
function permsText(u) {
  if (u.role === 'admin') return 'كل الصلاحيات';
  const l = PERMS.filter(([k]) => (u.perms || {})[k]).map(([, t]) => t);
  return l.length ? l.join('، ') : 'عرض الخطط فقط';
}
function renderUsers() {
  const q = ($('#uSearch') && $('#uSearch').value.trim()) || '';
  const rows = [...state.users].filter(u => !q || (u.emp_id + ' ' + u.full_name).includes(q))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || String(a.full_name).localeCompare(b.full_name, 'ar'));
  const counts = ROLE_ORDER.map(r => [r, state.users.filter(u => u.role === r).length]).filter(([, n]) => n);
  $('#usersSummary').innerHTML = `<b>${fmt(state.users.length)}</b> مستخدم — ` + counts.map(([r, n]) => `${ROLES[r]}: ${fmt(n)}`).join(' · ');
  const editable = u => u.emp_id !== state.emp && (isAdmin() || u.role !== 'admin');
  $('#usersTbl').innerHTML = `<thead><tr><th>الرقم الوظيفي</th><th>الاسم</th><th>الدور</th><th>نطاق الوصول</th><th>الصلاحيات</th><th>الحالة</th><th></th></tr></thead><tbody>` +
    (rows.length ? rows.map(u => `<tr><td class="num">${esc(u.emp_id)}</td><td><b>${esc(u.full_name)}</b></td>
      <td><span class="pill role-${esc(u.role)}">${esc(ROLES[u.role] || u.role)}</span></td>
      <td class="wrap sm">${esc(scopeText(u))}</td><td class="wrap sm muted">${esc(permsText(u))}</td>
      <td><span class="pill ${u.active ? 's2' : 's0'}">${u.active ? 'مفعّل' : 'موقوف'}</span></td>
      <td>${u.emp_id === state.emp ? '<span class="muted sm">حسابك</span>' : editable(u) ? `<button class="icon-btn edit" data-uedit="${esc(u.emp_id)}">تعديل</button><button class="icon-btn edit" data-toggle="${esc(u.emp_id)}">${u.active ? 'إيقاف' : 'تفعيل'}</button><button class="icon-btn del" data-udel="${esc(u.emp_id)}">حذف</button>` : '<span class="muted sm">—</span>'}</td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">لا يوجد مستخدمون</td></tr>') + '</tbody>';
}
function buildUserForm() {
  $('#uRole').innerHTML = ROLE_ORDER.filter(r => r !== 'admin' || isAdmin()).map(r => `<option value="${r}">${ROLES[r]}</option>`).join('');
  $('#uPerms').innerHTML = PERMS.map(([k, t]) => `<label><input type="checkbox" name="perm_${k}" ${k === 'manage_users' && !isAdmin() ? 'data-locked="1"' : ''}> ${t}</label>`).join('');
  $('#uSubjects').innerHTML = SUBJECTS.map(s => `<label><input type="checkbox" name="subj" value="${esc(s)}"> ${esc(s)}</label>`).join('');
  $('#uGrades').innerHTML = [1, 2, 3, 4, 5, 6].map(g => `<label><input type="checkbox" name="grade" value="${g}"> الصف ${GRADE_LONG[g]}</label>`).join('');
  resetUserForm();
}
// اختيار الفصول لكل صف محدد
function renderClassPicker(keep) {
  const sel = new Set(keep || $$('#uClasses input:checked').map(el => el.value));
  const grades = $$('#uGrades input:checked').map(el => +el.value).sort((a, b) => a - b);
  const dis = $('#uRole').value === 'admin';
  $('#uClasses').innerHTML = grades.length
    ? grades.map(g => `<div class="cgroup"><b>الصف ${GRADE_LONG[g]}</b><div class="checks six">${Array.from({ length: SECTIONS[g] || 0 }, (_, i) => i + 1)
        .map(n => `<label><input type="checkbox" value="${g}-${n}" ${sel.has(g + '-' + n) ? 'checked' : ''} ${dis ? 'disabled' : ''}> فصل ${GRADE_SHORT[g]} ${n}</label>`).join('')}</div></div>`).join('')
    : '<p class="hint" style="margin:0">اختر صفاً أو أكثر أعلاه لتظهر فصوله ويمكنك تحديد فصول بعينها.</p>';
}
function applyRoleToForm(fromPreset) {
  const role = $('#uRole').value, isA = role === 'admin';
  if (fromPreset) PERMS.forEach(([k]) => { $('#userForm')['perm_' + k].checked = !!PRESETS[role][k]; });
  PERMS.forEach(([k]) => { const el = $('#userForm')['perm_' + k]; el.disabled = isA || !!el.dataset.locked; if (isA) el.checked = true; });
  $$('#uSubjects input, #uGrades input').forEach(el => { el.disabled = isA; if (isA) el.checked = false; });
  $('#uScopeNote').hidden = !isA;
  renderClassPicker(isA ? [] : undefined);
}
function resetUserForm() {
  const f = $('#userForm'); f.reset(); f.dataset.editing = '';
  $('#uEmp').readOnly = false; $('#uRole').value = 'teacher'; $('#uClasses').innerHTML = ''; applyRoleToForm(true);
  $('#uSave').textContent = 'إضافة المستخدم'; $('#uCancel').hidden = true; $('#uFormTitle').textContent = 'إضافة مستخدم جديد';
}
function editUser(u) {
  const f = $('#userForm'); f.dataset.editing = u.emp_id;
  $('#uEmp').value = u.emp_id; $('#uEmp').readOnly = true; $('#uName').value = u.full_name; $('#uRole').value = u.role;
  PERMS.forEach(([k]) => { f['perm_' + k].checked = !!(u.perms || {})[k]; });
  const s = (u.scope || {}).subjects || [], g = ((u.scope || {}).grades || []).map(Number);
  $$('#uSubjects input').forEach(el => { el.checked = s.includes(el.value); });
  $$('#uGrades input').forEach(el => { el.checked = g.includes(+el.value); });
  renderClassPicker((u.scope || {}).classes || []);
  applyRoleToForm(false);
  $('#uSave').textContent = 'حفظ التعديلات'; $('#uCancel').hidden = false; $('#uFormTitle').textContent = 'تعديل المستخدم: ' + u.full_name;
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function readUserForm() {
  const f = $('#userForm'), role = $('#uRole').value;
  const perms = {}; PERMS.forEach(([k]) => { if (role === 'admin' || f['perm_' + k].checked) perms[k] = true; });
  const subjects = role === 'admin' ? [] : $$('#uSubjects input:checked').map(el => el.value);
  const grades = role === 'admin' ? [] : $$('#uGrades input:checked').map(el => +el.value);
  const classes = role === 'admin' ? [] : $$('#uClasses input:checked').map(el => el.value).filter(v => grades.includes(+v.split('-')[0]));
  const prev = state.users.find(x => x.emp_id === f.dataset.editing);
  return { emp_id: $('#uEmp').value.trim(), full_name: $('#uName').value.trim(), role, active: prev ? prev.active : true, perms, scope: { subjects, grades, classes } };
}

/* ---------------- الأحداث ---------------- */
function bind() {
  $('#loginSchool').textContent = (CFG.SCHOOL_NAME || '') + (CFG.YEAR ? ' · ' + CFG.YEAR + 'هـ' : '');
  $('#brandSub').textContent = $('#loginSchool').textContent;
  $('#foot').textContent = (CFG.SCHOOL_NAME || '') + ' — الخطط العلاجية للاختبار التكويني ' + (CFG.YEAR || '');
  $('#demoHint').hidden = !DEMO; $('#demoBanner').hidden = !DEMO;

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); const emp = $('#empId').value.trim(); if (!emp) return;
    const b = $('#loginBtn'); b.disabled = true; $('#loginErr').textContent = '';
    try { await doLogin(emp); } catch (err) { $('#loginErr').textContent = errMsg(err); } finally { b.disabled = false; }
  });
  $('#logoutBtn').onclick = logout;
  $$('.tab').forEach(t => t.onclick = () => showView(t.dataset.view));

  ['#fSearch', '#fSection', '#fStatus', '#fCompletion', '#fGrade'].forEach(id => $(id).addEventListener('input', renderPlans));
  $('#fSubject').addEventListener('input', () => { syncGradeOptions('#fSubject', '#fGrade'); renderPlans(); });
  $('#resetFilters').onclick = () => { ['#fSearch', '#fSubject', '#fGrade', '#fSection', '#fStatus', '#fCompletion'].forEach(id => $(id).value = ''); syncGradeOptions('#fSubject', '#fGrade'); renderPlans(); };
  $('#dSubject').addEventListener('input', () => { syncGradeOptions('#dSubject', '#dGrade'); renderDashboard(); });
  $('#dGrade').addEventListener('input', renderDashboard);

  $('#addBtn').onclick = () => openPlan(null);
  $('#exportBtn').onclick = exportCSV;
  $('#plansTbl').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'), so = e.target.closest('[data-sort]');
    if (ed) openPlan(state.plans.find(p => p.id === ed.dataset.edit));
    if (dl) deletePlan(dl.dataset.del);
    if (so) { const k = so.dataset.sort; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 }; renderPlans(); }
  });
  $('#planForm').addEventListener('submit', savePlan);
  $$('[data-close]').forEach(b => b.onclick = () => $('#planDialog').close());
  $('#planForm').addEventListener('change', e => {
    if (!e.target.name || !e.target.name.startsWith('c_')) return;
    const f = $('#planForm'), n = COMPONENTS.filter(([k]) => f['c_' + k].checked).length;
    f.status.value = n === COMPONENTS.length ? 'مكتملة' : n > 0 ? 'قيد التنفيذ' : 'لم تبدأ';
  });

  $('#userForm').addEventListener('submit', async e => {
    e.preventDefault();
    const u = readUserForm(), editing = $('#userForm').dataset.editing;
    if (!u.emp_id || !u.full_name) return;
    if (!editing && state.users.some(x => x.emp_id === u.emp_id)) return toast('هذا الرقم الوظيفي مسجل مسبقاً، استخدم تعديل', true);
    const b = $('#uSave'); b.disabled = true;
    try { await api.saveUser(state.emp, u); resetUserForm(); await loadUsers(); toast(editing ? 'تم حفظ التعديلات' : 'تمت إضافة المستخدم'); }
    catch (err) { toast(errMsg(err), true); } finally { b.disabled = false; }
  });
  $('#uRole').addEventListener('change', () => applyRoleToForm(true));
  $('#uGrades').addEventListener('change', () => renderClassPicker());
  $('#uCancel').onclick = resetUserForm;
  $('#uSearch').addEventListener('input', renderUsers);
  $('#usersTbl').addEventListener('click', async e => {
    const t = e.target.closest('[data-toggle]'), d = e.target.closest('[data-udel]'), ed = e.target.closest('[data-uedit]');
    if (ed) return editUser(state.users.find(x => x.emp_id === ed.dataset.uedit));
    try {
      if (t) { const u = state.users.find(x => x.emp_id === t.dataset.toggle); await api.saveUser(state.emp, { ...u, active: !u.active }); await loadUsers(); }
      if (d && await confirmBox('حذف الرقم ' + d.dataset.udel + ' من قائمة الدخول؟')) { await api.deleteUser(state.emp, d.dataset.udel); await loadUsers(); toast('تم الحذف'); }
    } catch (err) { toast(errMsg(err), true); }
  });
}

window.RP = { state, api, SUBJECTS, STRUCTURE, COMPONENTS, STATUSES, GRADE_LONG, GRADE_SHORT, completion, classLabel, esc, fmt, num, toast, errMsg, openPlan, loadPlans, showView, defaultOrder, isAdmin, can, subjectsOf };

async function init() {
  bind();
  const saved = store.get(SESSION_KEY, null);
  if (saved) { try { await doLogin(saved, true); return; } catch { store.del(SESSION_KEY); } }
  $('#login').hidden = false; $('#empId').focus();
}
init();
})();
