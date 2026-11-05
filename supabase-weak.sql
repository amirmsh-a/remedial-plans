-- =====================================================================
--  الطلاب الضعاف: قوائم الطلاب لكل مادة وفصل ومعلم، ودرجاتهم قبل الخطة وبعدها
--  شغّله مرة واحدة بعد supabase-drive-roles.sql من: SQL Editor → New query → Run
-- =====================================================================

create table if not exists weak_students (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  grade        int  not null check (grade between 1 and 6),
  section      int  not null check (section between 1 and 20),
  teacher      text not null default '',
  student_no   text not null,                 -- رقم الهوية / رقم الطالب
  full_name    text not null,
  max_score    numeric not null default 20,   -- الدرجة العظمى للاختبار
  pre_score    numeric,                       -- درجة الاختبار التكويني
  pre_pct      numeric,                       -- النسبة قبل الخطة
  skills       text not null default '',      -- المهارات المستهدفة (يكملها المعلم)
  evidence     text not null default '',      -- الشواهد (يكملها المعلم)
  post_score   numeric,                       -- درجة الاختبار البعدي (يكملها المعلم)
  notes        text not null default '',
  source_file  text,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (subject, grade, section, student_no)
);
alter table weak_students enable row level security;
revoke all on weak_students from anon, authenticated;

-- القائمة حسب نطاق المستخدم (المادة/الصف/الفصل)
create or replace function weak_list(p_emp text)
returns json language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return coalesce((select json_agg(w order by subject, grade, section, pre_pct nulls last, full_name)
                   from weak_students w where _rp_in_scope(u, w.subject, w.grade, w.section)), '[]'::json);
end $$;

-- المعلم يكمل: المهارات، الشواهد، درجة الاختبار البعدي، الملاحظات
create or replace function weak_save(p_emp text, p jsonb)
returns weak_students language plpgsql security definer set search_path = public as $$
declare u app_users; r weak_students; ps numeric;
begin
  u := _rp_user(p_emp);
  if not _rp_can(u, 'edit_plans') then raise exception 'forbidden'; end if;
  select * into r from weak_students where id = (p->>'id')::uuid;
  if not found then raise exception 'not found'; end if;
  if not _rp_in_scope(u, r.subject, r.grade, r.section) then raise exception 'forbidden'; end if;
  ps := nullif(p->>'post_score', '')::numeric;
  if ps is not null and (ps < 0 or ps > r.max_score) then raise exception 'درجة الاختبار البعدي يجب أن تكون بين 0 و %', r.max_score; end if;
  update weak_students set
    skills = left(coalesce(p->>'skills', ''), 2000),
    evidence = left(coalesce(p->>'evidence', ''), 2000),
    post_score = ps,
    notes = left(coalesce(p->>'notes', ''), 2000),
    updated_by = u.full_name, updated_at = now()
  where id = r.id returning * into r;
  return r;
end $$;

-- استيراد القوائم (للمدير فقط): يحدّث بيانات الطالب ويحتفظ بما أكمله المعلم
create or replace function weak_import(p_emp text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare u app_users; x jsonb; n int := 0;
begin
  u := _rp_user(p_emp, true);
  for x in select * from jsonb_array_elements(p_rows) loop
    insert into weak_students (subject, grade, section, teacher, student_no, full_name, max_score, pre_score, pre_pct, source_file, updated_by)
    values (x->>'subject', (x->>'grade')::int, (x->>'section')::int, coalesce(x->>'teacher', ''), x->>'student_no', x->>'full_name',
            coalesce((x->>'max_score')::numeric, 20), (x->>'pre_score')::numeric, (x->>'pre_pct')::numeric, x->>'source_file', u.full_name)
    on conflict (subject, grade, section, student_no) do update set
      teacher = excluded.teacher, full_name = excluded.full_name, max_score = excluded.max_score,
      pre_score = excluded.pre_score, pre_pct = excluded.pre_pct, source_file = excluded.source_file;
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function weak_list(text), weak_save(text, jsonb), weak_import(text, jsonb) to anon, authenticated;
