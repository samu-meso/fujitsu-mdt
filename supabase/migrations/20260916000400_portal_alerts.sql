create table public.portal_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index portal_sessions_presence on public.portal_sessions(user_id,updated_at);
create function public.prepare_portal_session() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
create trigger portal_sessions_prepare before insert or update on public.portal_sessions for each row execute function public.prepare_portal_session();
alter table public.portal_sessions enable row level security;
revoke all on public.portal_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.portal_sessions to authenticated;
create policy portal_sessions_read on public.portal_sessions for select to authenticated using (public.current_profile_active() and (user_id=auth.uid() or (updated_at>now()-interval '45 seconds' and exists(select 1 from public.profiles p where p.id=user_id and p.active))));
create policy portal_sessions_insert on public.portal_sessions for insert to authenticated with check(user_id=auth.uid() and public.current_profile_active());
create policy portal_sessions_update on public.portal_sessions for update to authenticated using(user_id=auth.uid() and public.current_profile_active()) with check(user_id=auth.uid() and public.current_profile_active());
create policy portal_sessions_delete on public.portal_sessions for delete to authenticated using(user_id=auth.uid());

create table public.portal_alerts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('emergency','info')),
  message text not null check(length(btrim(message)) between 3 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check(sender_id<>recipient_id)
);
create index portal_alerts_inbox on public.portal_alerts(recipient_id,created_at) where read_at is null;
alter table public.portal_alerts enable row level security;
revoke all on public.portal_alerts from public,anon,authenticated;
grant select on public.portal_alerts to authenticated;
grant insert(sender_id,recipient_id,kind,message) on public.portal_alerts to authenticated;
grant update(read_at) on public.portal_alerts to authenticated;
create policy portal_alerts_read on public.portal_alerts for select to authenticated using(public.current_profile_active() and (recipient_id=auth.uid() or sender_id=auth.uid()));
create policy portal_alerts_insert on public.portal_alerts for insert to authenticated with check (
  public.current_profile_active() and sender_id=auth.uid()
  and exists(select 1 from public.portal_sessions s join public.profiles p on p.id=s.user_id where s.user_id=recipient_id and p.active and s.updated_at>now()-interval '45 seconds')
);
create policy portal_alerts_acknowledge on public.portal_alerts for update to authenticated using(recipient_id=auth.uid() and public.current_profile_active()) with check(recipient_id=auth.uid() and public.current_profile_active());
do $$ begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
end $$;
alter publication supabase_realtime add table public.portal_alerts;
