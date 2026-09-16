alter table public.reports add column ping_duration_hours integer default 48;
alter table public.reports add constraint reports_duration_allowed check (
  (ping_duration_hours is null or ping_duration_hours in (24,48))
  and (type_id = 'emergency' or (ping_duration_hours is not null and ping_duration_hours = 48))
);
