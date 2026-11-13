-- Opdracht 1: basistabellen, enums en hulpfuncties.
-- Afscherming (Row Level Security) staat in de volgende migratie.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.accountsoort as enum ('docent', 'stuurgroep', 'projectgroep', 'student');
create type public.stuurgroeprol_code as enum (
  'projectleiding', 'programma_kwaliteit', 'beleving_thema',
  'veiligheid_welzijn', 'logistiek_facilitair', 'communicatie_financien'
);
create type public.pack_vak as enum ('P', 'A', 'C', 'K');
create type public.projectgroeprol as enum (
  'projectleider', 'programma_beleving', 'veiligheid_ehbo',
  'logistiek_materialen', 'catering', 'corvee_communicatie'
);

-- ------------------------------------------------- updated_at-trigger
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- --------------------------------------------------------------- tabellen
create table public.editie (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  startdatum date not null,
  einddatum date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cluster (
  id uuid primary key default gen_random_uuid(),
  editie_id uuid not null references public.editie (id),
  code text not null check (code in ('VD', 'VC', 'TEST')),
  naam text not null,
  teams_link text,
  forms_link text,
  meerdaagsemodus_aan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (editie_id, code)
);

-- Besluit: budget_totaal staat in een aparte tabel, omdat Row Level Security
-- per rij werkt en projectgroepen en studenten dit bedrag niet mogen lezen
-- (zie docs/beslissingen.md).
create table public.cluster_budget (
  cluster_id uuid primary key references public.cluster (id) on delete cascade,
  budget_totaal numeric(10, 2) not null default 250.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meerdaagsethema (
  cluster_id uuid primary key references public.cluster (id) on delete cascade,
  naam text,
  verhaal text,
  slogan text,
  accentkleur text check (accentkleur is null or accentkleur ~ '^#[0-9A-Fa-f]{6}$'),
  sfeerbeeld_pad text,
  logo_pad text,
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stuurgroeprol (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  code public.stuurgroeprol_code not null,
  naam text not null,
  focus text,
  studenten text,
  pack public.pack_vak not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cluster_id, code)
);

create table public.projectgroep (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  nummer int not null check (nummer between 1 and 6),
  naam text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cluster_id, nummer)
);

create table public.projectgroep_rol (
  projectgroep_id uuid not null references public.projectgroep (id) on delete cascade,
  rol public.projectgroeprol not null,
  namen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (projectgroep_id, rol)
);

create table public.account (
  id uuid primary key references auth.users (id) on delete cascade,
  gebruikersnaam text not null unique,
  soort public.accountsoort not null,
  cluster_id uuid references public.cluster (id) on delete cascade,
  projectgroep_id uuid references public.projectgroep (id) on delete cascade,
  stuurgroeprol_id uuid references public.stuurgroeprol (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_soort_koppeling check (
    (soort = 'docent' and cluster_id is null and projectgroep_id is null and stuurgroeprol_id is null)
    or (soort = 'stuurgroep' and cluster_id is not null and projectgroep_id is null and stuurgroeprol_id is not null)
    or (soort = 'projectgroep' and cluster_id is not null and projectgroep_id is not null and stuurgroeprol_id is null)
    or (soort = 'student' and cluster_id is not null and projectgroep_id is null and stuurgroeprol_id is null)
  )
);

-- Logboek. Alleen aanvullen door functies; cluster_id en projectgroep_id zijn
-- toegevoegd zodat de afscherming per cluster en per groep kan werken.
create table public.wijziging (
  id uuid primary key default gen_random_uuid(),
  tabel text not null,
  record_id uuid,
  actie text not null,
  account_id uuid references public.account (id) on delete set null,
  naam text,
  cluster_id uuid references public.cluster (id) on delete cascade,
  projectgroep_id uuid references public.projectgroep (id) on delete cascade,
  details jsonb,
  created_at timestamptz not null default now()
);

create index on public.wijziging (cluster_id);
create index on public.wijziging (projectgroep_id);

-- updated_at-triggers
do $$
declare t text;
begin
  foreach t in array array['editie', 'cluster', 'cluster_budget', 'meerdaagsethema',
    'stuurgroeprol', 'projectgroep', 'projectgroep_rol', 'account']
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------- hulpfuncties
-- security definer zodat ze de tabel account kunnen lezen zonder zelf onder
-- Row Level Security te vallen; ze geven alleen gegevens van de ingelogde gebruiker.
create function public.mijn_soort() returns public.accountsoort
language sql stable security definer set search_path = public as $$
  select soort from public.account where id = auth.uid()
$$;

create function public.mijn_cluster() returns uuid
language sql stable security definer set search_path = public as $$
  select cluster_id from public.account where id = auth.uid()
$$;

create function public.mijn_projectgroep() returns uuid
language sql stable security definer set search_path = public as $$
  select projectgroep_id from public.account where id = auth.uid()
$$;

create function public.mijn_stuurgroeprol() returns uuid
language sql stable security definer set search_path = public as $$
  select stuurgroeprol_id from public.account where id = auth.uid()
$$;

create function public.is_docent() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select soort = 'docent' from public.account where id = auth.uid()), false)
$$;

-- Cluster van een projectgroep (voor afscherming van projectgroep_rol).
create function public.projectgroep_cluster(p_projectgroep_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select cluster_id from public.projectgroep where id = p_projectgroep_id
$$;

-- Resterend budget van het eigen cluster. Er zijn nog geen budgetaanvragen
-- (opdracht 5); tot dan is het resterende bedrag gelijk aan het totaal.
create function public.budget_resterend(p_cluster_id uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric;
begin
  if not (public.is_docent() or p_cluster_id = public.mijn_cluster()) then
    raise exception 'Geen toegang tot dit cluster' using errcode = '42501';
  end if;
  select budget_totaal into v from public.cluster_budget where cluster_id = p_cluster_id;
  return v;
end $$;

-- Alleen ingelogde gebruikers mogen de functies aanroepen.
do $$
declare f text;
begin
  foreach f in array array[
    'mijn_soort()', 'mijn_cluster()', 'mijn_projectgroep()', 'mijn_stuurgroeprol()',
    'is_docent()', 'projectgroep_cluster(uuid)', 'budget_resterend(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
