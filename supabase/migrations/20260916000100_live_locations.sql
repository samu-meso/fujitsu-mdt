-- One current position per user; no movement history or audit trail.
create table public.live_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision not null check (accuracy >= 0 and accuracy < 'Infinity'::double precision),
  sampled_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create function public.prepare_live_location() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  new.sampled_at = least(new.sampled_at, new.updated_at);
  return new;
end;
$$;
create trigger live_locations_prepare before insert or update on public.live_locations for each row execute function public.prepare_live_location();
alter table public.live_locations enable row level security;
revoke all on public.live_locations from public, anon, authenticated;
grant select, insert, update, delete on public.live_locations to authenticated;
create policy live_locations_read on public.live_locations for select to authenticated using (
  public.current_profile_active() and (
    user_id = auth.uid() or (
      updated_at > now() - interval '45 seconds' and sampled_at > now() - interval '45 seconds'
      and exists (select 1 from public.profiles p where p.id = user_id and p.active)
    )
  )
);
create policy live_locations_insert on public.live_locations for insert to authenticated with check (user_id = auth.uid() and public.current_profile_active());
create policy live_locations_update on public.live_locations for update to authenticated using (user_id = auth.uid() and public.current_profile_active()) with check (user_id = auth.uid() and public.current_profile_active());
create policy live_locations_delete on public.live_locations for delete to authenticated using (user_id = auth.uid());
