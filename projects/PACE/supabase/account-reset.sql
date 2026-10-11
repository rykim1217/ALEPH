-- Run in Supabase SQL Editor after schema.sql. No records are changed by installation.
begin;
create or replace function public.pace_reset_snapshot(p_expected_user_id uuid, p_expected_revision bigint)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or auth.uid() <> p_expected_user_id then
  raise exception 'Account changed' using errcode = '42501';
 end if;
 -- Keep the row and advance its revision, so older devices cannot resurrect data.
 return query select s.revision, s.updated_at
 from public.pace_save_snapshot('{}'::jsonb, p_expected_revision) as s;
end;
$$;
revoke all on function public.pace_reset_snapshot(uuid,bigint) from public, anon;
grant execute on function public.pace_reset_snapshot(uuid,bigint) to authenticated;
-- Read-only readiness check: the UI stays disabled until this script is installed.
create or replace function public.pace_account_reset_ready()
returns integer language sql security invoker set search_path = ''
as $$ select 1; $$;
revoke all on function public.pace_account_reset_ready() from public, anon;
grant execute on function public.pace_account_reset_ready() to authenticated;
commit;
