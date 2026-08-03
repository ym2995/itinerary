-- ============================================================
--  Itinerary — schema, row level security, storage
--  Paste this whole file into Supabase → SQL Editor → Run
-- ============================================================

-- ---------- tables -----------------------------------------

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  on_date     date not null,
  at_time     time not null default '09:00',
  kind        text not null default 'plan'
              check (kind in ('flight','stay','transfer','plan')),
  title       text not null,
  place       text not null default '',
  reference   text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists entries_on_date_idx on public.entries (on_date, at_time);

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id) on delete cascade,
  name        text not null,          -- original filename, shown in the UI
  path        text not null,          -- key inside the 'docs' storage bucket
  created_at  timestamptz not null default now()
);

create index if not exists documents_entry_idx on public.documents (entry_id);

-- ---------- row level security ------------------------------
-- One shared account. Logged in = full access. Logged out = nothing.

alter table public.entries   enable row level security;
alter table public.documents enable row level security;

drop policy if exists "entries: signed in" on public.entries;
create policy "entries: signed in"
  on public.entries for all
  to authenticated
  using (true) with check (true);

drop policy if exists "documents: signed in" on public.documents;
create policy "documents: signed in"
  on public.documents for all
  to authenticated
  using (true) with check (true);

-- ---------- storage bucket ----------------------------------

insert into storage.buckets (id, name, public)
values ('docs', 'docs', false)
on conflict (id) do nothing;

drop policy if exists "docs: read"   on storage.objects;
drop policy if exists "docs: write"  on storage.objects;
drop policy if exists "docs: delete" on storage.objects;

create policy "docs: read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'docs');

create policy "docs: write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'docs');

create policy "docs: delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'docs');
