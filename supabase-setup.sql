-- =====================================================================
--  الخطط العلاجية للاختبار التكويني 1448 — إعداد قاعدة بيانات Supabase
--  شغّل هذا الملف مرة واحدة من: Supabase → SQL Editor → New query → Run
--  ⚠️ قبل التشغيل: استبدل 0000000 في آخر الملف برقمك الوظيفي.
-- =====================================================================

create extension if not exists pgcrypto;

-- المستخدمون المسموح لهم بالدخول (يديرهم المدير فقط)
create table if not exists app_users (
  emp_id     text primary key,
  full_name  text not null,
  role       text not null default 'teacher' check (role in ('admin','teacher')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- الخطط العلاجية (سجل لكل فصل في كل مادة)
create table if not exists plans (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null,
  grade          int  not null check (grade between 1 and 6),
  section        int  not null check (section between 1 and 20),
  teacher        text not null default '',
  test_date      date,
  students_total int,
  students_weak  int,
  weak_skills    text not null default '',
  strategies     text not null default '',
  start_date     date,
  end_date       date,
  pre_score      numeric,
  post_score     numeric,
  components     jsonb not null default '{}'::jsonb,
  status         text not null default 'لم تبدأ',
  notes          text not null default '',
  updated_by     text,
  updated_at     timestamptz not null default now(),
  unique (subject, grade, section)
);

-- منع الوصول المباشر للجداول؛ كل العمليات تمر عبر الدوال أدناه
alter table app_users enable row level security;
alter table plans     enable row level security;
revoke all on app_users, plans from anon, authenticated;

-- ---------------------------------------------------------------------
--  دالة التحقق من المستخدم (داخلية)
-- ---------------------------------------------------------------------
create or replace function _rp_user(p_emp text, p_admin boolean default false)
returns app_users language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  select * into u from app_users where emp_id = trim(p_emp) and active;
  if not found then raise exception 'unauthorized'; end if;
  if p_admin and u.role <> 'admin' then raise exception 'forbidden'; end if;
  return u;
end $$;

-- ---------------------------------------------------------------------
--  الدوال العامة التي يستدعيها الموقع
-- ---------------------------------------------------------------------
create or replace function app_login(p_emp text)
returns json language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return json_build_object('emp_id', u.emp_id, 'full_name', u.full_name, 'role', u.role);
end $$;

create or replace function plans_list(p_emp text)
returns setof plans language plpgsql security definer set search_path = public as $$
begin
  perform _rp_user(p_emp);
  return query select * from plans order by subject, grade, section;
end $$;

create or replace function plan_save(p_emp text, p jsonb)
returns plans language plpgsql security definer set search_path = public as $$
declare u app_users; r plans;
begin
  u := _rp_user(p_emp);
  if nullif(p->>'id','') is not null then
    update plans set
      subject        = p->>'subject',
      grade          = (p->>'grade')::int,
      section        = (p->>'section')::int,
      teacher        = coalesce(p->>'teacher',''),
      test_date      = nullif(p->>'test_date','')::date,
      students_total = nullif(p->>'students_total','')::int,
      students_weak  = nullif(p->>'students_weak','')::int,
      weak_skills    = coalesce(p->>'weak_skills',''),
      strategies     = coalesce(p->>'strategies',''),
      start_date     = nullif(p->>'start_date','')::date,
      end_date       = nullif(p->>'end_date','')::date,
      pre_score      = nullif(p->>'pre_score','')::numeric,
      post_score     = nullif(p->>'post_score','')::numeric,
      components     = coalesce(p->'components','{}'::jsonb),
      status         = coalesce(nullif(p->>'status',''),'لم تبدأ'),
      notes          = coalesce(p->>'notes',''),
      updated_by     = u.full_name,
      updated_at     = now()
    where id = (p->>'id')::uuid
    returning * into r;
    if not found then raise exception 'الخطة غير موجودة'; end if;
  else
    insert into plans (subject, grade, section, teacher, test_date, students_total, students_weak,
                       weak_skills, strategies, start_date, end_date, pre_score, post_score,
                       components, status, notes, updated_by)
    values (p->>'subject', (p->>'grade')::int, (p->>'section')::int, coalesce(p->>'teacher',''),
            nullif(p->>'test_date','')::date, nullif(p->>'students_total','')::int, nullif(p->>'students_weak','')::int,
            coalesce(p->>'weak_skills',''), coalesce(p->>'strategies',''),
            nullif(p->>'start_date','')::date, nullif(p->>'end_date','')::date,
            nullif(p->>'pre_score','')::numeric, nullif(p->>'post_score','')::numeric,
            coalesce(p->'components','{}'::jsonb), coalesce(nullif(p->>'status',''),'لم تبدأ'),
            coalesce(p->>'notes',''), u.full_name)
    returning * into r;
  end if;
  return r;
end $$;

create or replace function plan_delete(p_emp text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform _rp_user(p_emp, true);  -- الحذف للمدير فقط
  delete from plans where id = p_id;
  return found;
end $$;

create or replace function users_list(p_emp text)
returns setof app_users language plpgsql security definer set search_path = public as $$
begin
  perform _rp_user(p_emp, true);
  return query select * from app_users order by role, full_name;
end $$;

create or replace function user_save(p_emp text, p_id text, p_name text, p_role text, p_active boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare me app_users;
begin
  me := _rp_user(p_emp, true);
  if trim(p_id) = me.emp_id and (p_role <> 'admin' or not p_active) then
    raise exception 'لا يمكنك تغيير صلاحية حسابك أو إيقافه';
  end if;
  insert into app_users (emp_id, full_name, role, active)
  values (trim(p_id), trim(p_name), coalesce(p_role,'teacher'), coalesce(p_active,true))
  on conflict (emp_id) do update set full_name = excluded.full_name, role = excluded.role, active = excluded.active;
  return true;
end $$;

create or replace function user_delete(p_emp text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me app_users;
begin
  me := _rp_user(p_emp, true);
  if trim(p_id) = me.emp_id then raise exception 'لا يمكنك حذف حسابك'; end if;
  delete from app_users where emp_id = trim(p_id);
  return found;
end $$;

-- الصلاحيات: الدوال العامة فقط متاحة للموقع
revoke execute on function _rp_user(text, boolean) from public, anon, authenticated;
grant execute on function app_login(text), plans_list(text), plan_save(text, jsonb), plan_delete(text, uuid),
  users_list(text), user_save(text, text, text, text, boolean), user_delete(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
--  البيانات الأولية: فصل لكل مجلد في "الخطط العلاجية للاختبار التكويني 1448"
-- ---------------------------------------------------------------------
insert into plans (subject, grade, section)
select s.subject, s.grade, g
from (values
  ('الرياضيات',1,4), ('الرياضيات',2,3), ('الرياضيات',3,5),
  ('الرياضيات',4,6), ('الرياضيات',5,7), ('الرياضيات',6,7),
  ('العلوم',1,4), ('العلوم',2,3), ('العلوم',3,5), ('العلوم',5,7)
) as s(subject, grade, n)
cross join lateral generate_series(1, s.n) g
on conflict (subject, grade, section) do nothing;

-- ⚠️ حساب المدير: ضع رقمك الوظيفي بدل 0000000
insert into app_users (emp_id, full_name, role)
values ('0000000', 'أمير المشد', 'admin')
on conflict (emp_id) do nothing;
