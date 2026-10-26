-- Rode este arquivo uma vez no SQL Editor do Supabase.
-- Cria o diário de partidas, privado para cada usuário.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  my_legend text,
  opp_legend text,
  result text check (result in ('W', 'L')),
  format text check (format in ('bo1', 'bo3')),
  log text,
  notes text,
  analysis text
);

create index if not exists matches_user_created on public.matches (user_id, created_at desc);

alter table public.matches enable row level security;

drop policy if exists "ler minhas partidas" on public.matches;
create policy "ler minhas partidas" on public.matches
  for select using (auth.uid() = user_id);

drop policy if exists "criar minhas partidas" on public.matches;
create policy "criar minhas partidas" on public.matches
  for insert with check (auth.uid() = user_id);

drop policy if exists "apagar minhas partidas" on public.matches;
create policy "apagar minhas partidas" on public.matches
  for delete using (auth.uid() = user_id);
