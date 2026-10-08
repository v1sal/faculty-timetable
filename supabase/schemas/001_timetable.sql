-- Apply once to a new Supabase project. No example records are inserted.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.timetable_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.timetable_admins enable row level security;
revoke all on public.timetable_admins from anon, authenticated;
grant select on public.timetable_admins to authenticated;
create policy "Check own admin membership" on public.timetable_admins for select to authenticated
 using (user_id = (select auth.uid()));

create table public.sessions (
 id uuid primary key default gen_random_uuid(),
 professor text not null check (length(trim(professor)) between 1 and 120),
 subject text not null check (length(trim(subject)) between 1 and 120),
 room text not null check (length(trim(room)) between 1 and 120),
 groups text[] not null check (cardinality(groups) between 1 and 30 and array_position(groups,null) is null),
 day smallint not null check (day between 1 and 6),
 start time(0) not null,
 "end" time(0) not null,
 kind text not null check (kind in ('Lecture','Seminar','Lab','Office hours')),
 notes text not null default '' check (length(notes)<=2000),
 updated_at timestamptz not null default now(),
 check ("end" > start),
 check (extract(second from start)=0 and extract(second from "end")=0),
 check ("end" < '24:00'::time)
);
create index sessions_day_start_idx on public.sessions(day,start);
alter table public.sessions enable row level security;
revoke all on public.sessions from anon, authenticated;
grant select on public.sessions to anon, authenticated;
grant insert,update,delete on public.sessions to authenticated;
create policy "Visitors read schedules" on public.sessions for select to anon, authenticated using (true);
create policy "Admins add classes" on public.sessions for insert to authenticated
 with check (exists (select 1 from public.timetable_admins where user_id=(select auth.uid())));
create policy "Admins edit classes" on public.sessions for update to authenticated
 using (exists (select 1 from public.timetable_admins where user_id=(select auth.uid())))
 with check (exists (select 1 from public.timetable_admins where user_id=(select auth.uid())));
create policy "Admins remove classes" on public.sessions for delete to authenticated
 using (exists (select 1 from public.timetable_admins where user_id=(select auth.uid())));

-- Resource reservations make overlap protection atomic even for simultaneous writes.
create table private.schedule_bookings (
 session_id uuid not null references public.sessions(id) on delete cascade,
 resource text not null,
 period int4range not null,
 primary key(session_id, resource),
 exclude using gist (resource extensions.gist_text_ops with =, period with &&)
);
alter table private.schedule_bookings enable row level security;
revoke all on private.schedule_bookings from public, anon, authenticated;

create function private.sync_bookings() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
 booking_period int4range;
 resource_name text;
begin
 if auth.uid() is null or not exists (select 1 from public.timetable_admins where user_id=auth.uid()) then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 if exists (select 1 from unnest(new.groups) g where length(trim(g)) not between 1 and 60) then
   raise exception 'Each group must contain 1 to 60 characters' using errcode='23514';
 end if;
 booking_period := int4range(
   new.day::integer*1440+extract(hour from new.start)::integer*60+extract(minute from new.start)::integer,
   new.day::integer*1440+extract(hour from new."end")::integer*60+extract(minute from new."end")::integer,'[)');
 delete from private.schedule_bookings where session_id=new.id;
 for resource_name in
   select distinct x from unnest(array['professor:'||lower(trim(new.professor)), 'room:'||lower(trim(new.room))]
     || array(select 'group:'||lower(trim(g)) from unnest(new.groups) g)) x
 loop
   insert into private.schedule_bookings(session_id,resource,period) values(new.id,resource_name,booking_period);
 end loop;
 return new;
end;
$$;
revoke all on function private.sync_bookings() from public, anon, authenticated;
create trigger maintain_schedule_bookings after insert or update on public.sessions
 for each row execute function private.sync_bookings();
