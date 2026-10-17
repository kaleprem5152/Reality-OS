-- ==============================================================================
-- RealityOS Database & Supabase Row-Level Security (RLS) Schema
-- ==============================================================================

-- 1. Profiles table linked to Supabase Auth
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  organization text default 'Metropolitan Authority',
  role text default 'Lead Infrastructure Planner',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to create profile upon new signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, organization, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'organization', 'Metropolitan Authority'),
    coalesce(new.raw_user_meta_data->>'role', 'Lead Infrastructure Planner')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Projects table
create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text default '' not null,
  infra_type text not null,
  region text not null,
  status text default 'Planning' not null,
  budget_crore integer not null,
  target_completion text not null,
  risk_level text default 'Moderate' not null,
  capacity_target text default '' not null,
  sustainability_priorities jsonb default '[]'::jsonb not null,
  requirements text default '' not null,
  stations integer,
  corridor_km integer,
  featured boolean default false not null,
  archived boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on projects
alter table public.projects enable row level security;

create policy "Authenticated users can read projects"
  on public.projects for select
  to authenticated, anon
  using (true);

create policy "Authenticated users can insert projects"
  on public.projects for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update projects"
  on public.projects for update
  to authenticated
  using (true);

create policy "Authenticated users can delete projects"
  on public.projects for delete
  to authenticated
  using (true);

-- 3. Reports table
create table if not exists public.reports (
  id text primary key,
  project_id text references public.projects(id) on delete cascade not null,
  title text not null,
  report_type text not null,
  status text default 'Draft' not null,
  content jsonb not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on reports
alter table public.reports enable row level security;

create policy "Authenticated users can read reports"
  on public.reports for select
  to authenticated, anon
  using (true);

create policy "Authenticated users can insert reports"
  on public.reports for insert
  to authenticated
  with check (true);

create policy "Authenticated users can delete reports"
  on public.reports for delete
  to authenticated
  using (true);
