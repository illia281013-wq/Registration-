-- Registration: Supabase PostgreSQL schema
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query.
-- No password or service_role key belongs in this table or in frontend code.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) between 0 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Remove broad default access; grant only the minimum required operations.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- A logged-in user can only read their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

-- A logged-in user can only update their own profile.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Set updated_at on profile changes.
create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

-- Create a profile automatically when Supabase Auth creates an account.
-- Security-definer is restricted to this trigger function; it is not executable
-- by application roles and uses an empty search_path plus qualified table names.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;

-- Security checklist in Supabase Dashboard:
-- 1. Authentication -> URL Configuration: set Site URL and exact allowed redirect URLs.
-- 2. Authentication -> Providers -> Email: enable email confirmation for production.
-- 3. Authentication -> Rate Limits: keep appropriate limits; configure SMTP for reliable email delivery.
-- 4. Enable leaked-password protection if available for your plan.
-- 5. Never expose the service_role/secret key; use only the publishable (or legacy anon) key in the browser.
-- 6. Review Auth logs, configure backups, and test RLS with two separate accounts before production.
