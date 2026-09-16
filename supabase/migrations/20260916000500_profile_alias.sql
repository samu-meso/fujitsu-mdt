alter table public.profiles add column alias text not null default '';
alter table public.profiles add constraint profiles_alias_length check (char_length(alias) <= 40 and alias = btrim(alias));
grant select(alias), update(alias) on public.profiles to authenticated;
