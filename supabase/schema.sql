-- ==============================================================================
-- RealityOS Database & Supabase Row-Level Security (RLS) Schema
-- Canonical Schema Definition
-- ==============================================================================

-- 0. Ensure required cryptographic extension for token hashing
create extension if not exists pgcrypto with schema extensions;

-- 1. Profiles table linked to Supabase Auth
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  organization text default 'Metropolitan Authority',
  role text default 'Lead Infrastructure Planner', -- Professional job title / discipline
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
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Workspaces table
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete restrict not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists workspaces_created_by_idx on public.workspaces (created_by);

-- 3. Workspace members table (RBAC authorization)
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  joined_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);
create index if not exists workspace_members_ws_role_idx on public.workspace_members (workspace_id, role);

-- 4. Workspace invitations table
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')), -- 'owner' excluded
  token_hash text unique not null, -- Non-reversible SHA-256 token hash
  invited_by uuid references auth.users(id) on delete cascade not null,
  status text default 'pending' not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists workspace_invitations_ws_email_idx on public.workspace_invitations (workspace_id, lower(email));
create index if not exists workspace_invitations_expires_idx on public.workspace_invitations (expires_at);

-- 5. Trigger: Add workspace creator as initial 'owner' member atomically
create or replace function public.handle_new_workspace()
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- 6. Immutability & Safety Triggers
-- 6a. Prevent altering creator on workspaces
create or replace function public.protect_workspace_immutability()
returns trigger as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Cannot alter the creator of a workspace';
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_workspace_update on public.workspaces;
create trigger on_workspace_update
  before update on public.workspaces
  for each row execute function public.protect_workspace_immutability();

-- 6b. Prevent altering identifiers on workspace_members and protect sole owner from demotion
-- Uses FOR UPDATE on parent workspace to serialize concurrent demotions
create or replace function public.protect_workspace_member_update()
returns trigger as $$
declare
  v_owner_count int;
begin
  if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
    raise exception 'Cannot alter workspace_id or user_id of an existing membership';
  end if;

  -- Prevent demoting the last remaining owner
  if old.role = 'owner' and new.role <> 'owner' then
    -- Serialize owner updates per workspace using parent workspace lock
    perform 1 from public.workspaces where id = old.workspace_id for update;

    select count(*) into v_owner_count
    from public.workspace_members
    where workspace_id = old.workspace_id and role = 'owner' and id <> old.id;

    if v_owner_count < 1 then
      raise exception 'Cannot demote the sole workspace owner. Transfer ownership or add another owner first.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_workspace_member_update on public.workspace_members;
create trigger on_workspace_member_update
  before update on public.workspace_members
  for each row execute function public.protect_workspace_member_update();

-- 6c. Prevent removing the sole workspace owner on deletion and serialize concurrent removals
create or replace function public.protect_workspace_member_delete()
returns trigger as $$
declare
  v_owner_count int;
begin
  if old.role = 'owner' then
    -- Serialize owner removals per workspace using parent workspace lock
    perform 1 from public.workspaces where id = old.workspace_id for update;
    if not found then
      -- Parent workspace was deleted in this transaction (CASCADE); allow member deletion
      return old;
    end if;

    select count(*) into v_owner_count
    from public.workspace_members
    where workspace_id = old.workspace_id and role = 'owner' and id <> old.id;

    if v_owner_count < 1 then
      raise exception 'Cannot remove the sole workspace owner. Transfer ownership or assign another owner first.';
    end if;
  end if;

  return old;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_workspace_member_delete on public.workspace_members;
create trigger on_workspace_member_delete
  before delete on public.workspace_members
  for each row execute function public.protect_workspace_member_delete();

-- 6d. Prevent altering core attributes on workspace_invitations and freeze finalized invitations
create or replace function public.protect_workspace_invitation_update()
returns trigger as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.email is distinct from old.email
     or new.token_hash is distinct from old.token_hash
     or new.invited_by is distinct from old.invited_by then
    raise exception 'Cannot alter core invitation attributes (workspace_id, email, token_hash, invited_by)';
  end if;

  -- Finalized invitations (accepted, revoked, expired) are completely immutable
  if old.status in ('accepted', 'revoked', 'expired') then
    raise exception 'Cannot modify a finalized invitation (status: %)', old.status;
  end if;

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_workspace_invitation_update on public.workspace_invitations;
create trigger on_workspace_invitation_update
  before update on public.workspace_invitations
  for each row execute function public.protect_workspace_invitation_update();

-- 7. Helper function for RLS checks (prevents RLS recursion, uses fixed search_path)
create or replace function public.is_workspace_member(ws_id uuid, req_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and (
        req_role is null
        or (req_role = 'viewer' and role in ('owner', 'admin', 'editor', 'viewer'))
        or (req_role = 'editor' and role in ('owner', 'admin', 'editor'))
        or (req_role = 'admin' and role in ('owner', 'admin'))
        or (req_role = 'owner' and role = 'owner')
      )
  );
$$;

-- Helper function to check if a workspace has any active members (bypasses RLS to prevent recursion / visibility distortion)
create or replace function public.workspace_has_members(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = ws_id
  );
$$;

-- 8. Atomic Invitation Acceptance Function
create or replace function public.accept_workspace_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.workspace_invitations%rowtype;
  v_user_email text;
  v_user_id uuid;
  v_existing_role text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to accept an invitation';
  end if;

  if invitation_token is null or length(trim(invitation_token)) = 0 then
    raise exception 'Invitation token is required';
  end if;

  -- Resolve authenticated user's email from JWT or auth.users
  v_user_email := lower(auth.jwt()->>'email');
  if v_user_email is null then
    select lower(email) into v_user_email from auth.users where id = v_user_id;
  end if;

  if v_user_email is null then
    raise exception 'User email not found in authentication context';
  end if;

  -- Cryptographic SHA-256 hash comparison of the supplied plaintext token
  v_token_hash := pg_catalog.encode(extensions.digest(invitation_token, 'sha256'), 'hex');

  -- Locate active invitation with row-level locking
  select * into v_invitation
  from public.workspace_invitations
  where token_hash = v_token_hash
  for update;

  if not found then
    raise exception 'Invalid or non-existent invitation token';
  end if;

  -- Verify invitee email matches authenticated user email
  if lower(v_invitation.email) <> v_user_email then
    raise exception 'Invitation email does not match authenticated user';
  end if;

  -- Check if already accepted, revoked, or expired
  if v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'error', format('Invitation is no longer active (status: %s)', v_invitation.status),
      'code', 'INVITATION_INACTIVE'
    );
  end if;

  -- Check expiration: update to 'expired' and return JSON failure so the status persists upon commit
  if v_invitation.expires_at <= now() then
    update public.workspace_invitations
    set status = 'expired',
        updated_at = now()
    where id = v_invitation.id;

    return jsonb_build_object(
      'success', false,
      'error', 'Invitation has expired',
      'code', 'INVITATION_EXPIRED'
    );
  end if;

  -- Check if user is already a member of this workspace
  select role into v_existing_role
  from public.workspace_members
  where workspace_id = v_invitation.workspace_id
    and user_id = v_user_id;

  if found then
    -- User is already a member; mark invitation accepted to finalize the invite token
    -- but preserve existing membership privileges without overwriting/downgrading their role
    update public.workspace_invitations
    set status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    where id = v_invitation.id;

    return jsonb_build_object(
      'success', true,
      'workspace_id', v_invitation.workspace_id,
      'role', v_existing_role,
      'already_member', true
    );
  end if;

  -- Mark invitation as accepted
  update public.workspace_invitations
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where id = v_invitation.id;

  -- Atomically grant workspace membership with the invitation's immutable role
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invitation.workspace_id, v_user_id, v_invitation.role);

  return jsonb_build_object(
    'success', true,
    'workspace_id', v_invitation.workspace_id,
    'role', v_invitation.role,
    'already_member', false
  );
end;
$$;

-- 9. Projects table
create table if not exists public.projects (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text default '' not null,
  infra_type text not null,
  region text not null,
  status text default 'Planning' not null,
  budget_crore double precision not null,
  target_completion text not null,
  risk_level text default 'Moderate' not null,
  capacity_target text default '' not null,
  sustainability_priorities jsonb default '[]'::jsonb not null,
  requirements text default '' not null,
  stations double precision,
  corridor_km double precision,
  featured boolean default false not null,
  archived boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists projects_workspace_idx on public.projects (workspace_id);
create index if not exists projects_created_by_idx on public.projects (created_by);

-- Protect project workspace assignment and creator immutability
create or replace function public.protect_project_workspace_immutability()
returns trigger as $$
begin
  -- Prohibit modifying workspace assignment in ordinary updates (requires dedicated migration)
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'Cannot modify project workspace assignment';
  end if;

  -- Prohibit modifying creator to impersonate other users
  if new.created_by is distinct from old.created_by then
    raise exception 'Cannot alter the creator of a project';
  end if;

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_project_workspace_check on public.projects;
create trigger on_project_workspace_check
  before update on public.projects
  for each row execute function public.protect_project_workspace_immutability();

-- 10. Reports table
create table if not exists public.reports (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id text references public.projects(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  report_type text not null,
  status text default 'Draft' not null,
  content jsonb not null,
  created_at timestamptz default now() not null
);

create index if not exists reports_workspace_idx on public.reports (workspace_id);
create index if not exists reports_project_idx on public.reports (project_id);
create index if not exists reports_created_by_idx on public.reports (created_by);

-- Protect report workspace assignment, parent project, and creator immutability
create or replace function public.protect_report_workspace_immutability()
returns trigger as $$
begin
  -- Prohibit modifying workspace assignment in ordinary updates (requires dedicated migration)
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'Cannot modify report workspace assignment';
  end if;

  -- Prohibit re-parenting report to a different project
  if new.project_id is distinct from old.project_id then
    raise exception 'Cannot alter parent project of a report';
  end if;

  -- Prohibit modifying creator to impersonate other users
  if new.created_by is distinct from old.created_by then
    raise exception 'Cannot alter the creator of a report';
  end if;

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_report_workspace_check on public.reports;
create trigger on_report_workspace_check
  before update on public.reports
  for each row execute function public.protect_report_workspace_immutability();

-- Enforce report/project workspace consistency on insert and update
create or replace function public.protect_report_workspace_consistency()
returns trigger as $$
declare
  v_project_workspace_id uuid;
begin
  -- Resolve the parent project's workspace_id
  select workspace_id into v_project_workspace_id
  from public.projects
  where id = new.project_id;

  if not found then
    raise exception 'Referenced project % does not exist', new.project_id;
  end if;

  -- Enforce workspace consistency
  if new.workspace_id is not null then
    -- Workspace-scoped report: parent project must belong to the exact same workspace
    if v_project_workspace_id is null then
      raise exception 'Cannot reference a global demonstration project from a workspace-scoped report';
    elsif v_project_workspace_id <> new.workspace_id then
      raise exception 'Report workspace (%) does not match parent project workspace (%)', new.workspace_id, v_project_workspace_id;
    end if;
  else
    -- Global demonstration report (workspace_id is null): parent project must also be global (workspace_id is null)
    if v_project_workspace_id is not null then
      raise exception 'Global demonstration report cannot reference a workspace-assigned project';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

drop trigger if exists on_report_workspace_consistency on public.reports;
create trigger on_report_workspace_consistency
  before insert or update on public.reports
  for each row execute function public.protect_report_workspace_consistency();

-- 11. Enable Row-Level Security
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.projects enable row level security;
alter table public.reports enable row level security;

-- 12. Workspaces RLS policies
drop policy if exists "Workspace members can view workspaces" on public.workspaces;
create policy "Workspace members can view workspaces"
  on public.workspaces for select
  to authenticated
  using (
    public.is_workspace_member(id)
    or (
      created_by = auth.uid()
      and not public.workspace_has_members(id)
    )
  );

drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces"
  on public.workspaces for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Admins and owners can update workspaces" on public.workspaces;
create policy "Admins and owners can update workspaces"
  on public.workspaces for update
  to authenticated
  using (public.is_workspace_member(id, 'admin'))
  with check (public.is_workspace_member(id, 'admin'));

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces"
  on public.workspaces for delete
  to authenticated
  using (public.is_workspace_member(id, 'owner'));

-- 13. Workspace Members RLS policies
drop policy if exists "Members can view other members in their workspace" on public.workspace_members;
create policy "Members can view other members in their workspace"
  on public.workspace_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "Owners and admins can add members" on public.workspace_members;
create policy "Owners and admins can add members"
  on public.workspace_members for insert
  to authenticated
  with check (
    -- Initial owner creation is handled strictly by the handle_new_workspace() trigger.
    -- Manual inserts must be performed by an existing admin/owner and cannot create 'owner' role.
    public.is_workspace_member(workspace_id, 'admin')
    and role in ('admin', 'editor', 'viewer')
  );

drop policy if exists "Owners and admins can update member roles" on public.workspace_members;
create policy "Owners and admins can update member roles"
  on public.workspace_members for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id, 'owner')
    or (
      public.is_workspace_member(workspace_id, 'admin')
      and role in ('editor', 'viewer')
    )
  )
  with check (
    (
      public.is_workspace_member(workspace_id, 'owner')
      and role in ('owner', 'admin', 'editor', 'viewer')
    )
    or (
      public.is_workspace_member(workspace_id, 'admin')
      and role in ('editor', 'viewer')
    )
  );

drop policy if exists "Members can leave; admins and owners can remove members" on public.workspace_members;
create policy "Members can leave; admins and owners can remove members"
  on public.workspace_members for delete
  to authenticated
  using (
    (user_id = auth.uid() and role != 'owner')
    or (public.is_workspace_member(workspace_id, 'admin') and role in ('editor', 'viewer'))
    or (public.is_workspace_member(workspace_id, 'owner') and user_id != auth.uid())
  );

-- 14. Workspace Invitations RLS policies
drop policy if exists "Admins can view invitations; invitees can view own" on public.workspace_invitations;
create policy "Admins can view invitations; invitees can view own"
  on public.workspace_invitations for select
  to authenticated
  using (
    public.is_workspace_member(workspace_id, 'admin')
    or lower(email) = lower(auth.jwt()->>'email')
  );

drop policy if exists "Admins and owners can create invitations" on public.workspace_invitations;
create policy "Admins and owners can create invitations"
  on public.workspace_invitations for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id, 'admin')
    and role in ('admin', 'editor', 'viewer')
    and invited_by = auth.uid()
  );

drop policy if exists "Admins and owners can update invitations; invitees can accept" on public.workspace_invitations;
drop policy if exists "Admins and owners can update invitations" on public.workspace_invitations;
create policy "Admins and owners can update invitations"
  on public.workspace_invitations for update
  to authenticated
  using (public.is_workspace_member(workspace_id, 'admin'))
  with check (
    public.is_workspace_member(workspace_id, 'admin')
    and role in ('admin', 'editor', 'viewer')
  );

drop policy if exists "Admins and owners can delete invitations" on public.workspace_invitations;
create policy "Admins and owners can delete invitations"
  on public.workspace_invitations for delete
  to authenticated
  using (public.is_workspace_member(workspace_id, 'admin'));

-- 15. Projects RLS policies
drop policy if exists "Authenticated users can read projects" on public.projects;
drop policy if exists "Authenticated users can insert projects" on public.projects;
drop policy if exists "Authenticated users can update projects" on public.projects;
drop policy if exists "Authenticated users can delete projects" on public.projects;
drop policy if exists "Users can view workspace projects or unassigned demo projects" on public.projects;
drop policy if exists "Public can view demonstration projects" on public.projects;
drop policy if exists "Workspace members can view workspace projects" on public.projects;

-- Explicit demonstration project boundary: only designated seed projects where workspace_id IS NULL are public
create policy "Public can view demonstration projects"
  on public.projects for select
  to authenticated, anon
  using (
    workspace_id is null
    and id in ('PRJ-1001', 'PRJ-1002', 'PRJ-1003', 'PRJ-1004', 'PRJ-1005', 'PRJ-1006', 'PRJ-1007', 'PRJ-1008')
  );

create policy "Workspace members can view workspace projects"
  on public.projects for select
  to authenticated
  using (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'viewer')
  );

drop policy if exists "Workspace editors and above can create projects" on public.projects;
create policy "Workspace editors and above can create projects"
  on public.projects for insert
  to authenticated
  with check (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
    and created_by = auth.uid()
  );

drop policy if exists "Workspace editors and above can update projects" on public.projects;
create policy "Workspace editors and above can update projects"
  on public.projects for update
  to authenticated
  using (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
  )
  with check (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
  );

drop policy if exists "Workspace admins and owners can delete projects" on public.projects;
create policy "Workspace admins and owners can delete projects"
  on public.projects for delete
  to authenticated
  using (
    workspace_id is not null
    and (
      public.is_workspace_member(workspace_id, 'admin')
      or (created_by = auth.uid() and public.is_workspace_member(workspace_id, 'editor'))
    )
  );

-- 16. Reports RLS policies
drop policy if exists "Authenticated users can read reports" on public.reports;
drop policy if exists "Authenticated users can insert reports" on public.reports;
drop policy if exists "Authenticated users can update reports" on public.reports;
drop policy if exists "Authenticated users can delete reports" on public.reports;
drop policy if exists "Users can view workspace reports or unassigned demo reports" on public.reports;
drop policy if exists "Public can view demonstration reports" on public.reports;
drop policy if exists "Workspace members can view workspace reports" on public.reports;

-- Explicit demonstration report boundary: only designated seed reports where workspace_id IS NULL are public
create policy "Public can view demonstration reports"
  on public.reports for select
  to authenticated, anon
  using (
    workspace_id is null
    and id in ('RPT-5001', 'RPT-5002')
  );

create policy "Workspace members can view workspace reports"
  on public.reports for select
  to authenticated
  using (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'viewer')
  );

drop policy if exists "Workspace editors and above can create reports" on public.reports;
create policy "Workspace editors and above can create reports"
  on public.reports for insert
  to authenticated
  with check (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
    and created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = reports.project_id
        and p.workspace_id = reports.workspace_id
    )
  );

drop policy if exists "Workspace editors and above can update reports" on public.reports;
create policy "Workspace editors and above can update reports"
  on public.reports for update
  to authenticated
  using (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
  )
  with check (
    workspace_id is not null
    and public.is_workspace_member(workspace_id, 'editor')
  );

drop policy if exists "Workspace admins and owners can delete reports" on public.reports;
create policy "Workspace admins and owners can delete reports"
  on public.reports for delete
  to authenticated
  using (
    workspace_id is not null
    and (
      public.is_workspace_member(workspace_id, 'admin')
      or (created_by = auth.uid() and public.is_workspace_member(workspace_id, 'editor'))
    )
  );

-- 17. Table Privileges (Defense in Depth)
revoke all on table public.workspaces from public, anon;
revoke all on table public.workspace_members from public, anon;
revoke all on table public.workspace_invitations from public, anon;
revoke insert, update, delete, truncate on table public.projects from public, anon;
revoke insert, update, delete, truncate on table public.reports from public, anon;

grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.workspace_invitations to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.reports to authenticated;

grant select on table public.projects to anon;
grant select on table public.reports to anon;

-- 18. Function Execution Privileges
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_workspace() from public, anon, authenticated;
revoke execute on function public.protect_workspace_immutability() from public, anon, authenticated;
revoke execute on function public.protect_workspace_member_update() from public, anon, authenticated;
revoke execute on function public.protect_workspace_member_delete() from public, anon, authenticated;
revoke execute on function public.protect_workspace_invitation_update() from public, anon, authenticated;
revoke execute on function public.protect_project_workspace_immutability() from public, anon, authenticated;
revoke execute on function public.protect_report_workspace_immutability() from public, anon, authenticated;
revoke execute on function public.protect_report_workspace_consistency() from public, anon, authenticated;

grant execute on function public.is_workspace_member(uuid, text) to authenticated;
revoke execute on function public.is_workspace_member(uuid, text) from public, anon;

grant execute on function public.workspace_has_members(uuid) to authenticated;
revoke execute on function public.workspace_has_members(uuid) from public, anon;

grant execute on function public.accept_workspace_invitation(text) to authenticated;
revoke execute on function public.accept_workspace_invitation(text) from public, anon;
