-- Datenbank für den Teamplaner.
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und mit "Run" ausführen.
--
-- WICHTIG: Ersetzt unten BEIDE Male 'HIER-EUREN-TEAM-CODE' durch denselben
-- Team-Code (ein langes, zufälliges Passwort, das nur ihr im Team kennt).
-- Ohne diesen Code sieht niemand Daten oder E-Mail-Adressen.

create table if not exists public.project_state (
  id         integer primary key,
  data       jsonb not null default '{}'::jsonb,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Genau eine Zeile enthält das ganze Projekt.
insert into public.project_state (id) values (1) on conflict (id) do nothing;

alter table public.project_state enable row level security;

drop policy if exists "team_lesen" on public.project_state;
drop policy if exists "team_aendern" on public.project_state;

-- Lesen und Ändern ist nur erlaubt, wenn die Anfrage den richtigen Team-Code mitschickt.
create policy "team_lesen" on public.project_state
  for select to anon
  using (
    id = 1 and
    (current_setting('request.headers', true)::json ->> 'x-team-code') = 'NRM28-ma48:-)'
  );

create policy "team_aendern" on public.project_state
  for update to anon
  using (
    id = 1 and
    (current_setting('request.headers', true)::json ->> 'x-team-code') = 'NRM28-ma48:-)'
  )
  with check (id = 1);
