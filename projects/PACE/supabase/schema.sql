-- PACE account snapshots. Run once in the Supabase SQL Editor.
-- No local data is uploaded by this script.
begin;
create table if not exists public.pace_account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint pace_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint pace_payload_size check (octet_length(payload::text) <= 20971520)
);
alter table public.pace_account_data enable row level security;
revoke all on public.pace_account_data from anon, authenticated;
grant select on public.pace_account_data to authenticated;
drop policy if exists pace_read_own on public.pace_account_data;
create policy pace_read_own on public.pace_account_data
  for select to authenticated using ((select auth.uid()) = user_id);

-- Authenticated callers cannot write the table directly. This function binds
-- ownership to auth.uid() and atomically checks the expected server revision.
create or replace function public.pace_save_snapshot(p_payload jsonb, p_expected_revision bigint)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
  v_time timestamptz;
  v_key text;
  v_value jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 20971520 then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;
  for v_key, v_value in select * from jsonb_each(p_payload) loop
    if v_key not in ('pace.certifications.v1','pace.study-plans.v1',
       'pace.availability.v1','pace.availability.v2',
       'pace.planning-settings.v1','pace.distribution-settings.v1',
       'pace.personal-events.v1') or jsonb_typeof(v_value) <> 'string' then
      raise exception 'Unsupported snapshot key or value' using errcode = '22023';
    end if;
    -- Stored values retain their original JSON strings, including stable IDs.
    perform (v_value #>> '{}')::jsonb;
  end loop;
  if p_expected_revision = 0 then
    insert into public.pace_account_data as target (user_id, payload)
      values (v_uid, p_payload)
      on conflict (user_id) do nothing
      returning target.revision, target.updated_at into v_revision, v_time;
  elsif p_expected_revision > 0 then
    update public.pace_account_data as target
      set payload = p_payload, revision = target.revision + 1, updated_at = now()
      where target.user_id = v_uid and target.revision = p_expected_revision
      returning target.revision, target.updated_at into v_revision, v_time;
  else
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;
  if v_revision is null then raise exception 'Snapshot conflict' using errcode = '40001'; end if;
  return query select v_revision, v_time;
end;
$$;
revoke all on function public.pace_save_snapshot(jsonb,bigint) from public, anon;
grant execute on function public.pace_save_snapshot(jsonb,bigint) to authenticated;
commit;
