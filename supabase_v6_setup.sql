-- Hockey Coach V6 – Spielerzugänge
create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_key text not null check (team_key in ('second','third')),
  player_ref text not null,
  display_name text not null,
  email text not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id,email),
  unique (club_id,team_key,player_ref)
);

alter table public.player_profiles add column if not exists is_enabled boolean not null default true;
alter table public.player_profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.player_event_status (
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  event_id text not null,
  status text not null check (status in ('present','absent','open')),
  updated_at timestamptz not null default now(),
  primary key (player_profile_id,event_id)
);

create or replace function public.get_my_player_schedule()
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.player_profiles; club_data jsonb; team_data jsonb; event_list jsonb; status_map jsonb;
begin
  select * into p from public.player_profiles
  where auth_user_id=auth.uid() and is_enabled=true limit 1;
  if p.id is null then raise exception 'Kein aktives Spielerprofil zugeordnet'; end if;
  select data into club_data from public.club_state where club_id=p.club_id;
  team_data:=coalesce(club_data->'teams'->p.team_key,'{}'::jsonb);
  select coalesce(jsonb_agg(e order by e->>'date',e->>'time'),'[]'::jsonb)
    into event_list
    from jsonb_array_elements(coalesce(team_data->'events','[]'::jsonb)) e
    where coalesce(e->>'date','')>=current_date::text;
  select coalesce(jsonb_object_agg(event_id,status),'{}'::jsonb)
    into status_map from public.player_event_status where player_profile_id=p.id;
  return jsonb_build_object(
    'profile',jsonb_build_object('id',p.id,'display_name',p.display_name,'team_key',p.team_key,'email',p.email),
    'events',event_list,'statuses',status_map
  );
end;
$$;

create or replace function public.set_my_player_status(target_event_id text,new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare profile_id uuid;
begin
  if new_status not in ('present','absent','open') then raise exception 'Ungültiger Status'; end if;
  select id into profile_id from public.player_profiles
  where auth_user_id=auth.uid() and is_enabled=true limit 1;
  if profile_id is null then raise exception 'Kein aktives Spielerprofil zugeordnet'; end if;
  insert into public.player_event_status(player_profile_id,event_id,status,updated_at)
  values(profile_id,target_event_id,new_status,now())
  on conflict(player_profile_id,event_id)
  do update set status=excluded.status,updated_at=now();
end;
$$;

alter table public.player_profiles enable row level security;
alter table public.player_event_status enable row level security;

drop policy if exists "Coaches manage player profiles" on public.player_profiles;
create policy "Coaches manage player profiles" on public.player_profiles
for all to authenticated using (public.is_club_member(club_id))
with check (public.is_club_member(club_id));

drop policy if exists "Players read own profile" on public.player_profiles;
create policy "Players read own profile" on public.player_profiles
for select to authenticated using (auth_user_id=auth.uid() and is_enabled=true);

drop policy if exists "Coaches read player statuses" on public.player_event_status;
create policy "Coaches read player statuses" on public.player_event_status
for select to authenticated using (
  exists (select 1 from public.player_profiles p
  where p.id=player_profile_id and public.is_club_member(p.club_id))
);

grant select,insert,update,delete on public.player_profiles to authenticated;
grant select on public.player_event_status to authenticated;
grant execute on function public.get_my_player_schedule() to authenticated;
grant execute on function public.set_my_player_status(text,text) to authenticated;
