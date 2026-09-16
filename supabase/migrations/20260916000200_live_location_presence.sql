-- Expire disconnected sessions, not stationary users whose GPS fix is unchanged.
alter policy live_locations_read on public.live_locations using (
  public.current_profile_active() and (
    user_id = auth.uid() or (
      updated_at > now() - interval '45 seconds'
      and exists (select 1 from public.profiles p where p.id = user_id and p.active)
    )
  )
);
