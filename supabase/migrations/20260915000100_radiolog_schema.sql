create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'user');
create type public.dossier_status as enum ('bozza', 'aperto', 'chiuso');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 3 and 60),
  email text not null,
  role public.app_role not null default 'user',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));
create unique index profiles_email_lower_key on public.profiles (lower(email));

create table public.report_types (
  id text primary key,
  name text not null,
  color text not null,
  icon text not null,
  active boolean not null default true
);

create table public.dossier_counters (
  year integer primary key,
  value integer not null check (value > 0)
);

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  title text not null check (char_length(trim(title)) between 3 and 180),
  content text not null default '<p></p>',
  status public.dossier_status not null default 'bozza',
  notes text not null default '',
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text not null check (char_length(trim(description)) between 3 and 10000),
  event_date timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text not null default '',
  type_id text not null references public.report_types(id),
  author_id uuid not null references public.profiles(id),
  dossier_id uuid references public.dossiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','application/pdf')),
  size bigint not null check (size > 0),
  uploaded_by uuid not null references public.profiles(id),
  dossier_id uuid references public.dossiers(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint attachment_one_parent check ((dossier_id is null) <> (report_id is null)),
  constraint reports_images_only check (report_id is null or mime_type like 'image/%')
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null check (entity_type in ('dossiers','reports','users')),
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

create index reports_event_date_idx on public.reports(event_date desc);
create index reports_type_idx on public.reports(type_id);
create index reports_author_idx on public.reports(author_id);
create index reports_dossier_idx on public.reports(dossier_id);
create index dossiers_updated_idx on public.dossiers(updated_at desc);
create index dossiers_author_idx on public.dossiers(author_id);
create index attachments_dossier_idx on public.attachments(dossier_id);
create index attachments_report_idx on public.attachments(report_id);
create index audit_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);

create or replace function public.current_profile_active()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select active from public.profiles where id = auth.uid()), false) $$;

create or replace function public.current_profile_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select active and role = 'admin' from public.profiles where id = auth.uid()), false) $$;

revoke all on function public.current_profile_active() from public;
revoke all on function public.current_profile_admin() from public;
grant execute on function public.current_profile_active() to authenticated;
grant execute on function public.current_profile_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger dossiers_updated before update on public.dossiers for each row execute function public.set_updated_at();
create trigger reports_updated before update on public.reports for each row execute function public.set_updated_at();

create or replace function public.reject_dangerous_html()
returns trigger language plpgsql as $$
begin
  if new.content ~* '<\s*(script|iframe|object|embed|style|svg|form)' or
     new.content ~* '\son[a-z]+\s*=' or new.content ~* '(javascript|data)\s*:' then
    raise exception 'Il contenuto contiene HTML non consentito.';
  end if;
  return new;
end $$;
create trigger dossiers_safe_html before insert or update of content on public.dossiers for each row execute function public.reject_dangerous_html();

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then
    new.id := old.id; new.role := old.role; new.active := old.active; new.email := old.email; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create or replace function public.prepare_dossier()
returns trigger language plpgsql security definer set search_path = '' as $$
declare current_year integer; next_value integer;
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'service_role' and new.public_code is not null then
      current_year := split_part(new.public_code, '-', 2)::integer;
      next_value := split_part(new.public_code, '-', 3)::integer;
      insert into public.dossier_counters(year,value) values(current_year,next_value)
        on conflict(year) do update set value=greatest(public.dossier_counters.value,excluded.value);
    else
      current_year := extract(year from now())::integer;
      insert into public.dossier_counters(year, value) values (current_year, 1)
        on conflict(year) do update set value = public.dossier_counters.value + 1
        returning value into next_value;
      new.public_code := format('FASC-%s-%s', current_year, lpad(next_value::text, 4, '0'));
      new.author_id := auth.uid(); new.created_at := now();
    end if;
  else
    new.public_code := old.public_code; new.author_id := old.author_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger dossiers_prepare before insert or update on public.dossiers for each row execute function public.prepare_dossier();

create or replace function public.prepare_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' then new.author_id := auth.uid(); new.created_at := now(); end if;
  else
    new.author_id := old.author_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger reports_prepare before insert or update on public.reports for each row execute function public.prepare_report();

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; entity uuid; label text;
begin
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  actor := coalesce(auth.uid(), case when tg_op = 'DELETE' then old.author_id else new.author_id end);
  entity := case when tg_op = 'DELETE' then old.id else new.id end;
  label := case tg_op when 'INSERT' then 'Creazione' when 'UPDATE' then 'Modifica' else 'Eliminazione' end;
  insert into public.audit_log(user_id, action, entity_type, entity_id) values(actor, label, tg_table_name, entity);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger dossiers_audit after insert or update or delete on public.dossiers for each row execute function public.write_audit_log();
create trigger reports_audit after insert or update or delete on public.reports for each row execute function public.write_audit_log();

alter table public.profiles enable row level security;
alter table public.report_types enable row level security;
alter table public.dossiers enable row level security;
alter table public.reports enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;
alter table public.dossier_counters enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.current_profile_active());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() and public.current_profile_active()) with check (id = auth.uid() and public.current_profile_active());
create policy types_read on public.report_types for select to authenticated using (public.current_profile_active());
create policy dossiers_read on public.dossiers for select to authenticated using (public.current_profile_active());
create policy dossiers_insert on public.dossiers for insert to authenticated with check (public.current_profile_active() and author_id = auth.uid());
create policy dossiers_update on public.dossiers for update to authenticated using (public.current_profile_active()) with check (public.current_profile_active());
create policy dossiers_delete on public.dossiers for delete to authenticated using (public.current_profile_admin());
create policy reports_read on public.reports for select to authenticated using (public.current_profile_active());
create policy reports_insert on public.reports for insert to authenticated with check (public.current_profile_active() and author_id = auth.uid());
create policy reports_update on public.reports for update to authenticated using (public.current_profile_active()) with check (public.current_profile_active());
create policy reports_delete on public.reports for delete to authenticated using (public.current_profile_admin());
create policy attachments_read on public.attachments for select to authenticated using (public.current_profile_active());
create policy attachments_delete on public.attachments for delete to authenticated using (uploaded_by = auth.uid() or public.current_profile_admin());
create policy audit_read on public.audit_log for select to authenticated using (public.current_profile_active());

insert into public.report_types(id,name,color,icon) values
  ('radio','Scansione frequenze','#548bfb','radio'),
  ('emergency','Emergenza','#ef6b73','triangle')
on conflict(id) do update set name=excluded.name,color=excluded.color,icon=excluded.icon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('attachments','attachments',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_read on storage.objects for select to authenticated using (bucket_id='attachments' and public.current_profile_active());
create policy storage_delete on storage.objects for delete to authenticated using (bucket_id='attachments' and (owner_id=auth.uid()::text or public.current_profile_admin()));

grant usage on schema public to authenticated;
grant select(id,username,role,active,created_at,updated_at) on public.profiles to authenticated;
grant select on public.report_types,public.dossiers,public.reports,public.attachments,public.audit_log to authenticated;
grant insert,update on public.dossiers,public.reports to authenticated;
grant delete on public.attachments to authenticated;
grant update(username) on public.profiles to authenticated;
grant delete on public.dossiers,public.reports to authenticated;
