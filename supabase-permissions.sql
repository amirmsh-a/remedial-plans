-- =====================================================================
--  تحديث الصلاحيات: أدوار + صلاحيات تفصيلية + نطاق (مواد/صفوف) لكل مستخدم
--  شغّله مرة واحدة بعد supabase-setup.sql من: SQL Editor → New query → Run
-- =====================================================================

-- الأدوار: admin مدير، supervisor مشرف، teacher معلم، viewer مشاهد
alter table app_users add column if not exists perms jsonb not null default '{}'::jsonb;
alter table app_users add column if not exists scope jsonb not null default '{}'::jsonb;
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (role in ('admin','supervisor','teacher','viewer'));

-- صلاحيات افتراضية للمعلمين الحاليين
update app_users set perms = '{"view_dashboard":true,"edit_plans":true}'::jsonb
where role = 'teacher' and perms = '{}'::jsonb;

-- هل يملك المستخدم الصلاحية؟ (المدير يملك كل شيء)
create or replace function _rp_can(u app_users, p text)
returns boolean language sql stable as $$
  select u.role = 'admin' or coalesce((u.perms->>p)::boolean, false)
$$;

-- هل المادة/الصف ضمن نطاق المستخدم؟ (نطاق فارغ = الكل)
create or replace function _rp_in_scope(u app_users, s text, g int)
returns boolean language sql stable as $$
  select u.role = 'admin' or (
    (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? s) and
    (coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(g))
  )
$$;

create or replace function app_login(p_emp text)
returns json language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return json_build_object('emp_id', u.emp_id, 'full_name', u.full_name, 'role', u.role, 'perms', u.perms, 'scope', u.scope);
end $$;

create or replace function plans_list(p_emp text)
returns setof plans language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return query select * from plans where _rp_in_scope(u, subject, grade) order by subject, grade, section;
end $$;

create or replace function plan_save(p_emp text, p jsonb)
returns plans language plpgsql security definer set search_path = public as $$
declare u app_users; r plans; old plans;
begin
  u := _rp_user(p_emp);
  if not _rp_in_scope(u, p->>'subject', (p->>'grade')::int) then raise exception 'forbidden'; end if;
  if nullif(p->>'id','') is not null then
    if not _rp_can(u, 'edit_plans') then raise exception 'forbidden'; end if;
    select * into old from plans where id = (p->>'id')::uuid;
    if not found then raise exception 'الخطة غير موجودة'; end if;
    if not _rp_in_scope(u, old.subject, old.grade) then raise exception 'forbidden'; end if;
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
  if not _rp_in_scope(u, old.subject, old.grade) then raise exception 'forbidden'; end if;
  delete from plans where id = p_id;
  return true;
end $$;

create or replace function users_list(p_emp text)
returns setof app_users language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  if not _rp_can(u, 'manage_users') then raise exception 'forbidden'; end if;
  return query select * from app_users order by role, full_name;
end $$;

drop function if exists user_save(text, text, text, text, boolean);
create or replace function user_save(p_emp text, p_id text, p_name text, p_role text, p_active boolean,
                                     p_perms jsonb default '{}'::jsonb, p_scope jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare me app_users; target app_users;
begin
  me := _rp_user(p_emp);
  if not _rp_can(me, 'manage_users') then raise exception 'forbidden'; end if;
  if coalesce(trim(p_id),'') = '' or coalesce(trim(p_name),'') = '' then raise exception 'الرقم الوظيفي والاسم مطلوبان'; end if;
  select * into target from app_users where emp_id = trim(p_id);
  if me.role <> 'admin' then
    -- المشرف المفوَّض لا يمنح صلاحية المدير ولا يعدّل حسابات المديرين
    if p_role = 'admin' or coalesce((p_perms->>'manage_users')::boolean, false) or (found and target.role = 'admin') then
      raise exception 'forbidden';
    end if;
  end if;
  if trim(p_id) = me.emp_id and (coalesce(p_role,'') <> me.role or not coalesce(p_active,true)) then
    raise exception 'لا يمكنك تغيير دورك أو إيقاف حسابك';
  end if;
  insert into app_users (emp_id, full_name, role, active, perms, scope)
  values (trim(p_id), trim(p_name), coalesce(p_role,'teacher'), coalesce(p_active,true),
          coalesce(p_perms,'{}'::jsonb), coalesce(p_scope,'{}'::jsonb))
  on conflict (emp_id) do update set full_name = excluded.full_name, role = excluded.role, active = excluded.active,
                                     perms = excluded.perms, scope = excluded.scope;
  return true;
end $$;

create or replace function user_delete(p_emp text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me app_users; target app_users;
begin
  me := _rp_user(p_emp);
  if not _rp_can(me, 'manage_users') then raise exception 'forbidden'; end if;
  if trim(p_id) = me.emp_id then raise exception 'لا يمكنك حذف حسابك'; end if;
  select * into target from app_users where emp_id = trim(p_id);
  if found and target.role = 'admin' and me.role <> 'admin' then raise exception 'forbidden'; end if;
  delete from app_users where emp_id = trim(p_id);
  return found;
end $$;

revoke execute on function _rp_can(app_users, text), _rp_in_scope(app_users, text, int) from public, anon, authenticated;
grant execute on function user_save(text, text, text, text, boolean, jsonb, jsonb) to anon, authenticated;
