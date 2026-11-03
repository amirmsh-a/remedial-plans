-- =====================================================================
--  روابط الدرايف (مشاركة المجلد) لمستوى المادة والصف: للمدير والمشرف فقط
--  بقية الأدوار (معلم، مشاهد) ترى روابط الدرايف على مستوى الفصل ومجلداته فقط
--  شغّله بعد supabase-classes.sql من: SQL Editor → New query → Run
-- =====================================================================

create or replace function links_list(p_emp text)
returns json language plpgsql security definer set search_path = public as $$
declare u app_users;
begin
  u := _rp_user(p_emp);
  return coalesce((select json_agg(l order by l.created_at) from folder_links l
   where u.role = 'admin' or (
     (coalesce(jsonb_array_length(u.scope->'subjects'), 0) = 0 or (u.scope->'subjects') ? l.subject) and
     (l.grade is null or coalesce(jsonb_array_length(u.scope->'grades'), 0) = 0 or (u.scope->'grades') @> to_jsonb(l.grade)) and
     _rp_class_ok(u, l.grade, l.section) and
     -- روابط مشاركة المادة والصف للمدير والمشرف فقط
     (u.role = 'supervisor' or l.kind <> 'folder' or l.section is not null))), '[]'::json);
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
  if k = 'folder' and sec is null and u.role not in ('admin','supervisor') then raise exception 'forbidden'; end if;
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
