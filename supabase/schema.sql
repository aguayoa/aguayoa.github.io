-- Aware Life database
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Every table has row-level security: each signed-in user can only read and write their own rows.

-- ── Projects ────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null default 'New project',
  tagline     text not null default '',
  category    text not null default '',
  status      text not null default 'planning' check (status in ('active', 'planning', 'talks', 'paused', 'done')),
  icon        text not null default '📁',
  link        text not null default '',
  overview    text not null default '',
  focus       jsonb not null default '[]',
  tasks       jsonb not null default '[]',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Events (single or multi-day, e.g. a trip) ──────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  start_date  date not null,
  end_date    date not null,
  color       text not null default '#2b59c3',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ── Reminders ───────────────────────────────────────────────
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  due_date    date not null,
  due_time    time,
  color       text not null default '#0a84ff',
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── To-dos ──────────────────────────────────────────────────
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  text        text not null,
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Day summaries ───────────────────────────────────────────
create table if not exists public.day_notes (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  day         date not null,
  body        text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- ── Visits (who signed in and when) ─────────────────────────
create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  page        text not null default '',
  visited_at  timestamptz not null default now()
);

-- ── Admins (you) ────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- ── Row-level security ──────────────────────────────────────
alter table public.projects  enable row level security;
alter table public.events    enable row level security;
alter table public.reminders enable row level security;
alter table public.todos     enable row level security;
alter table public.day_notes enable row level security;
alter table public.visits    enable row level security;
alter table public.admins    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects', 'events', 'reminders', 'todos', 'day_notes'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "log own visit" on public.visits;
create policy "log own visit" on public.visits for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "see own admin row" on public.admins;
create policy "see own admin row" on public.admins for select to authenticated
  using (user_id = auth.uid());

-- ── Admin-only visitor list ─────────────────────────────────
create or replace function public.admin_visitors()
returns table (email text, joined timestamptz, last_visit timestamptz, visits bigint)
language sql
security definer
set search_path = public
as $$
  select u.email::text, u.created_at, max(v.visited_at), count(v.id)
  from auth.users u
  left join public.visits v on v.user_id = u.id
  where exists (select 1 from public.admins a where a.user_id = auth.uid())
  group by u.id, u.email, u.created_at
  order by max(v.visited_at) desc nulls last;
$$;

revoke all on function public.admin_visitors() from public, anon;
grant execute on function public.admin_visitors() to authenticated;
