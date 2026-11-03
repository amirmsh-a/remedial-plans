-- =====================================================================
--  روابط المجلدات: يضيف المستخدمون روابط ملفات/مرفقات ورابط مشاركة لكل مجلد
--  شغّله مرة واحدة بعد supabase-permissions.sql من: SQL Editor → New query → Run
-- =====================================================================

create table if not exists folder_links (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  grade        int  check (grade between 1 and 6),     -- فارغ = رابط على مستوى المادة
  section      int,                                    -- فارغ = رابط على مستوى الصف
  component    text,                                   -- فارغ = رابط على مستوى الفصل
  kind         text not null default 'file' check (kind in ('folder','file')),  -- folder = رابط مشاركة المجلد نفسه
  title        text not null,
  url          text not null check (url ~* '^https://\S+$'),
  added_by     text,
  added_by_emp text,
  created_at   timestamptz not null default now()
);
create index if not exists folder_links_target on folder_links (subject, grade, section, component);
alter table folder_links enable row level security;
revoke all on folder_links from anon, authenticated;

-- نطاق الإضافة: المادة ضمن النطاق، ورابط مستوى المادة لا يضيفه من قُيِّد بصفوف معينة
create or replace function _rp_link_scope(u app_users, s text, g int)
returns boolean language sql stable as $$
  select u.role = 'admin' or (
    (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? s) and
    (case when g is null then coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0
          else coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(g) end)
  )
$$;

create or replace function links_list(p_emp text)
returns setof folder_links language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return query select * from folder_links l
   where u.role = 'admin' or (
     (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? l.subject) and
     (l.grade is null or coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(l.grade)))
   order by l.created_at;
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
  if s is null or not _rp_link_scope(u, s, g) then raise exception 'forbidden'; end if;
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
  -- صاحب الرابط يحذفه، ومن يملك صلاحية حذف الخطط يحذف أي رابط ضمن نطاقه
  if not (l.added_by_emp = u.emp_id or (_rp_can(u, 'delete_plans') and _rp_link_scope(u, l.subject, l.grade))) then
    raise exception 'forbidden';
  end if;
  delete from folder_links where id = p_id;
  return true;
end $$;

revoke execute on function _rp_link_scope(app_users, text, int) from public, anon, authenticated;
grant execute on function links_list(text), link_add(text, jsonb), link_delete(text, uuid) to anon, authenticated;
