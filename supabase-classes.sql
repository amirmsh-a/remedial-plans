-- =====================================================================
--  تحديد الفصول ضمن الصف في نطاق صلاحيات المستخدم
--  scope.classes = ["4-1","4-2"]  (الصف-الفصل). إذا اختيرت فصول لصفٍّ ما يقتصر الوصول عليها،
--  وإذا لم يُختر أي فصل لذلك الصف يصل المستخدم إلى كل فصوله.
--  شغّله مرة واحدة بعد supabase-links.sql من: SQL Editor → New query → Run
-- =====================================================================

-- هل للصف g فصول محددة في نطاق المستخدم؟ وهل الفصل sec منها؟
create or replace function _rp_class_ok(u app_users, g int, sec int)
returns boolean language sql stable as $$
  select g is null or sec is null
      or not exists (select 1 from jsonb_array_elements_text(coalesce(u.scope->'classes', '[]'::jsonb)) c
                     where split_part(c, '-', 1) = g::text)
      or coalesce(u.scope->'classes', '[]'::jsonb) ? (g::text || '-' || sec::text)
$$;
create or replace function _rp_grade_has_classes(u app_users, g int)
returns boolean language sql stable as $$
  select exists (select 1 from jsonb_array_elements_text(coalesce(u.scope->'classes', '[]'::jsonb)) c
                 where split_part(c, '-', 1) = g::text)
$$;

-- نطاق الخطط: المادة + الصف + الفصل
drop function if exists _rp_in_scope(app_users, text, int);
create or replace function _rp_in_scope(u app_users, s text, g int, sec int default null)
returns boolean language sql stable as $$
  select u.role = 'admin' or (
    (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? s) and
    (coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(g)) and
    _rp_class_ok(u, g, sec)
  )
$$;

-- نطاق إضافة الروابط: رابط مستوى أعلى لا يضيفه من قُيِّد بمستوى أدنى
drop function if exists _rp_link_scope(app_users, text, int);
create or replace function _rp_link_scope(u app_users, s text, g int, sec int default null)
returns boolean language sql stable as $$
  select u.role = 'admin' or (
    (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? s) and
    (case
       when g is null then coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0
                           and coalesce(jsonb_array_length(u.scope->'classes'), 0) = 0
       else (coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(g))
            and (case when sec is null then not _rp_grade_has_classes(u, g) else _rp_class_ok(u, g, sec) end)
     end)
  )
$$;

create or replace function plans_list(p_emp text)
returns setof plans language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return query select * from plans where _rp_in_scope(u, subject, grade, section) order by subject, grade, section;
end $$;

create or replace function plan_save(p_emp text, p jsonb)
returns plans language plpgsql security definer set search_path = public as $$
declare u app_users; r plans; old plans;
begin
  u := _rp_user(p_emp);
  if not _rp_in_scope(u, p->>'subject', (p->>'grade')::int, (p->>'section')::int) then raise exception 'forbidden'; end if;
  if nullif(p->>'id','') is not null then
    if not _rp_can(u, 'edit_plans') then raise exception 'forbidden'; end if;
    select * into old from plans where id = (p->>'id')::uuid;
    if not found then raise exception 'الخطة غير موجودة'; end if;
    if not _rp_in_scope(u, old.subject, old.grade, old.section) then raise exception 'forbidden'; end if;
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
  else
    if not _rp_can(u, 'add_plans') then raise exception 'forbidden'; end if;
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
declare u app_users; old plans;
begin
  u := _rp_user(p_emp);
  if not _rp_can(u, 'delete_plans') then raise exception 'forbidden'; end if;
  select * into old from plans where id = p_id;
  if not found then return false; end if;
  if not _rp_in_scope(u, old.subject, old.grade, old.section) then raise exception 'forbidden'; end if;
  delete from plans where id = p_id;
  return true;
end $$;

create or replace function links_list(p_emp text)
returns json language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return coalesce((select json_agg(l order by l.created_at) from folder_links l
   where u.role = 'admin' or (
     (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? l.subject) and
     (l.grade is null or coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(l.grade)) and
     _rp_class_ok(u, l.grade, l.section))), '[]'::json);
end $$;

create or replace function link_add(p_emp text, p jsonb)
returns folder_links language plpgsql security definer set search_path = public as $$
declare u app_users; r folder_links;
  s text := p->>'subject'; g int := nullif(p->>'grade','')::int; sec int := nullif(p->>'section','')::int;
  comp text := nullif(p->>'component',''); k text := coalesce(nullif(p->>'kind',''), 'file');
  lnk text := trim(coalesce(p->>'url','')); t text := trim(coalesce(p->>'title',''));
begin
  u := _rp_user(p_emp);
  if not _rp_can(u, 'add_links') then raise exception 'forbidden'; end if;
  if s is null or not _rp_link_scope(u, s, g, sec) then raise exception 'forbidden'; end if;
  if k not in ('folder','file') then raise exception 'نوع الرابط غير صحيح'; end if;
  if lnk !~* '^https://\S+$' then raise exception 'الرابط يجب أن يبدأ بـ https://'; end if;
  if length(lnk) > 2000 or length(t) > 200 then raise exception 'الرابط أو العنوان طويل جداً'; end if;
  if t = '' then t := case when k = 'folder' then 'رابط مشاركة المجلد' else 'رابط' end; end if;
  if k = 'folder' then
    delete from folder_links where kind = 'folder' and subject = s and grade is not distinct from g
      and section is not distinct from sec and component is not distinct from comp;
  end if;
  insert into folder_links (subject, grade, section, component, kind, title, url, added_by, added_by_emp)
  values (s, g, sec, comp, k, t, lnk, u.full_name, u.emp_id)
  returning * into r;
  return r;
end $$;

create or replace function link_delete(p_emp text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare u app_users; l folder_links;
begin
  u := _rp_user(p_emp);
  select * into l from folder_links where id = p_id;
  if not found then return false; end if;
  if not (l.added_by_emp = u.emp_id or (_rp_can(u, 'delete_plans') and _rp_link_scope(u, l.subject, l.grade, l.section))) then
    raise exception 'forbidden';
  end if;
  delete from folder_links where id = p_id;
  return true;
end $$;

revoke execute on function _rp_class_ok(app_users, int, int), _rp_grade_has_classes(app_users, int),
  _rp_in_scope(app_users, text, int, int), _rp_link_scope(app_users, text, int, int) from public, anon, authenticated;
