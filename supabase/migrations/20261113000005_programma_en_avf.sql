-- Opdracht 3: vast programma per cluster, AVF met fasen en onderdelen, planning en afscherming.
-- Uitgangspunten (docs/rechtenmatrix.md):
--  * een projectgroep leest en schrijft alleen het eigen AVF, en alleen zolang het niet `ingediend` is;
--  * tijdvak, locatie, status en goedkeuring wijzigt een projectgroep nooit zelf (kolomrechten + functies);
--  * andere groepen en studenten zien alleen de weergave `avf_publiek`;
--  * programma en toewijzing wijzigen alleen via functies met eigen rechtencontrole.

create type public.avf_status as enum ('in_ontwikkeling', 'ingediend', 'aanpassing_gevraagd', 'goedgekeurd');
create type public.fase as enum ('kop', 'romp', 'staart');
create type public.programma_soort as enum ('vast', 'belevenis');

-- ------------------------------------------------------------ programma
create table public.programma_regel (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  volgorde int not null,
  dag date not null,
  starttijd time not null,
  eindtijd time not null,
  soort public.programma_soort not null default 'vast',
  titel text not null check (char_length(titel) between 1 and 120),
  omschrijving text check (omschrijving is null or char_length(omschrijving) <= 300),
  locatie text check (locatie is null or char_length(locatie) <= 120),
  deelnemers int[] not null default '{}',
  rocks_rivers_groepen int[] not null default '{}',
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cluster_id, volgorde),
  constraint programma_regel_tijd check (eindtijd > starttijd),
  constraint programma_regel_deelnemers check (deelnemers <@ array[1, 2, 3, 4, 5, 6]),
  constraint programma_regel_rocks_rivers check (rocks_rivers_groepen <@ array[1, 2, 3, 4, 5, 6])
);
create index on public.programma_regel (cluster_id, dag, starttijd);

-- ------------------------------------------------------------------- avf
create table public.avf (
  id uuid primary key default gen_random_uuid(),
  projectgroep_id uuid not null unique references public.projectgroep (id) on delete cascade,
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  status public.avf_status not null default 'in_ontwikkeling',
  opnieuw_te_controleren boolean not null default false,
  versie int not null default 0,
  -- A Basisgegevens
  titel text check (titel is null or char_length(titel) <= 80),
  verschijningsvorm text check (verschijningsvorm is null or char_length(verschijningsvorm) <= 60),
  publieke_samenvatting text check (publieke_samenvatting is null or char_length(publieke_samenvatting) <= 280),
  organiserende_studenten text check (organiserende_studenten is null or char_length(organiserende_studenten) <= 300),
  doelgroep text check (doelgroep is null or char_length(doelgroep) <= 200),
  aantal_deelnemers int check (aantal_deelnemers is null or aantal_deelnemers between 0 and 500),
  contactpersoon text check (contactpersoon is null or char_length(contactpersoon) <= 100),
  programma_regel_id uuid unique references public.programma_regel (id) on delete set null,
  locatie_tekst text check (locatie_tekst is null or char_length(locatie_tekst) <= 120),
  -- B, C, E, G, H
  beginsituatie jsonb not null default '{}',
  doelen jsonb not null default '{}',
  veiligheid jsonb not null default '{}',
  organisatie jsonb not null default '{}',
  communicatie jsonb not null default '{}',
  sectie_bijgewerkt jsonb not null default '{}',
  ingediend_op timestamptz,
  ingediend_door_naam text,
  goedgekeurd_op timestamptz,
  goedgekeurd_door_naam text,
  goedgekeurd_door_account uuid references public.account (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.avf (cluster_id);

create table public.avf_fase (
  avf_id uuid not null references public.avf (id) on delete cascade,
  fase public.fase not null,
  organisatievorm text check (organisatievorm is null or char_length(organisatievorm) <= 1000),
  overzichtstekening_pad text,
  overzichtstekening_bijschrift text check (overzichtstekening_bijschrift is null or char_length(overzichtstekening_bijschrift) <= 200),
  coachen_instructies text check (coachen_instructies is null or char_length(coachen_instructies) <= 2000),
  stemgebruik_houding text check (stemgebruik_houding is null or char_length(stemgebruik_houding) <= 1000),
  opruimen jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (avf_id, fase)
);

create table public.avf_onderdeel (
  id uuid primary key default gen_random_uuid(),
  avf_id uuid not null references public.avf (id) on delete cascade,
  fase public.fase not null,
  volgorde int not null,
  naam text check (naam is null or char_length(naam) <= 100),
  duur_minuten int check (duur_minuten is null or duur_minuten between 0 and 600),
  beschrijving text check (beschrijving is null or char_length(beschrijving) <= 3000),
  sociale_veiligheid text check (sociale_veiligheid is null or char_length(sociale_veiligheid) <= 1000),
  fysieke_veiligheid text check (fysieke_veiligheid is null or char_length(fysieke_veiligheid) <= 1000),
  individu_moeilijker text check (individu_moeilijker is null or char_length(individu_moeilijker) <= 500),
  individu_makkelijker text check (individu_makkelijker is null or char_length(individu_makkelijker) <= 500),
  groep_moeilijker text check (groep_moeilijker is null or char_length(groep_moeilijker) <= 500),
  groep_makkelijker text check (groep_makkelijker is null or char_length(groep_makkelijker) <= 500),
  usv_uitdagend text check (usv_uitdagend is null or char_length(usv_uitdagend) <= 500),
  usv_speelbaar text check (usv_speelbaar is null or char_length(usv_speelbaar) <= 500),
  usv_veilig_aanvulling text check (usv_veilig_aanvulling is null or char_length(usv_veilig_aanvulling) <= 500),
  afbeelding_pad text,
  afbeelding_bijschrift text check (afbeelding_bijschrift is null or char_length(afbeelding_bijschrift) <= 200),
  niet_van_toepassing text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avf_onderdeel_volgorde unique (avf_id, fase, volgorde) deferrable initially deferred
);
create index on public.avf_onderdeel (avf_id);

-- updated_at-triggers
do $$
declare t text;
begin
  foreach t in array array['programma_regel', 'avf', 'avf_fase', 'avf_onderdeel']
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;

-- ------------------------------------------------------------ triggers
-- cluster_id van het AVF altijd gelijk aan dat van de projectgroep
create function public.avf_cluster_invullen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select cluster_id into new.cluster_id from public.projectgroep where id = new.projectgroep_id;
  return new;
end $$;
create trigger avf_cluster_invullen before insert on public.avf
  for each row execute function public.avf_cluster_invullen();

-- een tijdvak moet in hetzelfde cluster liggen en van soort `belevenis` zijn
create function public.avf_regel_controle() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.programma_regel%rowtype;
begin
  if new.programma_regel_id is not null then
    select * into r from public.programma_regel where id = new.programma_regel_id;
    if not found or r.cluster_id <> new.cluster_id or r.soort <> 'belevenis' then
      raise exception 'Dit tijdvak hoort niet bij dit cluster of is geen belevenisvak' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger avf_regel_controle before insert or update of programma_regel_id on public.avf
  for each row execute function public.avf_regel_controle();

-- elke projectgroep krijgt automatisch één AVF met drie fasen
create function public.avf_aanmaken() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_avf uuid;
begin
  insert into public.avf (projectgroep_id, cluster_id) values (new.id, new.cluster_id) returning id into v_avf;
  insert into public.avf_fase (avf_id, fase) select v_avf, f from unnest(enum_range(null::public.fase)) as f;
  return new;
end $$;
create trigger avf_aanmaken after insert on public.projectgroep
  for each row execute function public.avf_aanmaken();

-- bestaande projectgroepen
insert into public.avf (projectgroep_id, cluster_id)
select id, cluster_id from public.projectgroep p
where not exists (select 1 from public.avf a where a.projectgroep_id = p.id);
insert into public.avf_fase (avf_id, fase)
select a.id, f from public.avf a, unnest(enum_range(null::public.fase)) as f
on conflict do nothing;

-- ---------------------------------------------------------- hulpfuncties
create function public.mag_avf_lezen(p_avf_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.avf a
    where a.id = p_avf_id
      and (public.is_docent()
           or (public.mijn_soort() = 'stuurgroep' and a.cluster_id = public.mijn_cluster())
           or (public.mijn_soort() = 'projectgroep' and a.projectgroep_id = public.mijn_projectgroep()))
  )
$$;

create function public.mag_avf_schrijven(p_avf_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.avf a
    where a.id = p_avf_id
      and (public.is_docent()
           or (public.mijn_soort() = 'projectgroep' and a.projectgroep_id = public.mijn_projectgroep()
               and a.status <> 'ingediend'))
  )
$$;

create function public.mag_programma_beheren(p_cluster_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_docent()
         or (public.mijn_soort() = 'stuurgroep' and p_cluster_id = public.mijn_cluster())
$$;

-- --------------------------------------------------- rechten en afscherming
alter table public.programma_regel enable row level security;
alter table public.avf enable row level security;
alter table public.avf_fase enable row level security;
alter table public.avf_onderdeel enable row level security;

revoke all on public.programma_regel, public.avf, public.avf_fase, public.avf_onderdeel from anon, authenticated;

-- programma: alleen lezen (wijzigen via functie)
grant select on public.programma_regel to authenticated;
create policy programma_regel_lezen on public.programma_regel
  for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());

-- avf: lezen volgens mag_avf_lezen; schrijven alleen inhoudskolommen, nooit tijdvak, locatie, status of goedkeuring
grant select on public.avf to authenticated;
grant update (
  titel, verschijningsvorm, publieke_samenvatting, organiserende_studenten, doelgroep,
  aantal_deelnemers, contactpersoon, beginsituatie, doelen, veiligheid, organisatie,
  communicatie, sectie_bijgewerkt
) on public.avf to authenticated;
create policy avf_lezen on public.avf
  for select to authenticated using (public.mag_avf_lezen(id));
create policy avf_schrijven on public.avf
  for update to authenticated
  using (public.mag_avf_schrijven(id))
  with check (public.mag_avf_schrijven(id));

-- avf_fase
grant select on public.avf_fase to authenticated;
grant update (
  organisatievorm, overzichtstekening_pad, overzichtstekening_bijschrift,
  coachen_instructies, stemgebruik_houding, opruimen
) on public.avf_fase to authenticated;
create policy avf_fase_lezen on public.avf_fase
  for select to authenticated using (public.mag_avf_lezen(avf_id));
create policy avf_fase_schrijven on public.avf_fase
  for update to authenticated
  using (public.mag_avf_schrijven(avf_id))
  with check (public.mag_avf_schrijven(avf_id));

-- avf_onderdeel
grant select, insert, delete on public.avf_onderdeel to authenticated;
grant update (
  fase, volgorde, naam, duur_minuten, beschrijving, sociale_veiligheid, fysieke_veiligheid,
  individu_moeilijker, individu_makkelijker, groep_moeilijker, groep_makkelijker,
  usv_uitdagend, usv_speelbaar, usv_veilig_aanvulling, afbeelding_pad, afbeelding_bijschrift,
  niet_van_toepassing
) on public.avf_onderdeel to authenticated;
create policy avf_onderdeel_lezen on public.avf_onderdeel
  for select to authenticated using (public.mag_avf_lezen(avf_id));
create policy avf_onderdeel_toevoegen on public.avf_onderdeel
  for insert to authenticated with check (public.mag_avf_schrijven(avf_id));
create policy avf_onderdeel_schrijven on public.avf_onderdeel
  for update to authenticated
  using (public.mag_avf_schrijven(avf_id))
  with check (public.mag_avf_schrijven(avf_id));
create policy avf_onderdeel_verwijderen on public.avf_onderdeel
  for delete to authenticated using (public.mag_avf_schrijven(avf_id));

-- Publieke weergave: wat andere groepen en studenten van een belevenis mogen zien.
-- Draait met de rechten van de eigenaar en filtert zelf op cluster.
create view public.avf_publiek with (security_barrier = true) as
select
  a.id,
  a.cluster_id,
  a.projectgroep_id,
  pg.nummer as projectgroep_nummer,
  pg.naam as projectgroep_naam,
  a.titel,
  a.verschijningsvorm,
  a.publieke_samenvatting,
  a.status,
  a.programma_regel_id,
  r.dag,
  r.starttijd,
  r.eindtijd
from public.avf a
join public.projectgroep pg on pg.id = a.projectgroep_id
left join public.programma_regel r on r.id = a.programma_regel_id
where public.is_docent() or a.cluster_id = public.mijn_cluster();
revoke all on public.avf_publiek from anon, authenticated;
grant select on public.avf_publiek to authenticated;

-- ------------------------------------------------ inhoud per veld bijwerken
-- Zet een waarde diep in een jsonb-structuur en maakt tussenliggende objecten aan.
create function public.jsonb_diep_zetten(p_doel jsonb, p_pad text[], p_waarde jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; kind jsonb;
begin
  if coalesce(array_length(p_pad, 1), 0) = 0 then
    return p_waarde;
  end if;
  k := p_pad[1];
  if jsonb_typeof(p_doel) = 'array' then
    return jsonb_set(p_doel, array[k], public.jsonb_diep_zetten(p_doel -> k::int, p_pad[2:], p_waarde));
  end if;
  p_doel := coalesce(nullif(p_doel, 'null'::jsonb), '{}'::jsonb);
  kind := p_doel -> k;
  return jsonb_set(p_doel, array[k], public.jsonb_diep_zetten(kind, p_pad[2:], p_waarde), true);
end $$;

-- Zoekt een pad op. Een segment in een lijst is het `id` van het lijstitem, geen volgnummer.
create function public.avf_pad_oplossen(p_root jsonb, p_pad text[]) returns jsonb
language plpgsql immutable as $$
declare cur jsonb := coalesce(p_root, '{}'::jsonb); pad text[] := '{}'; seg text; idx int;
begin
  if p_pad is null or array_length(p_pad, 1) is null then
    return jsonb_build_object('pad', '[]'::jsonb, 'huidig', cur, 'gevonden', true);
  end if;
  foreach seg in array p_pad loop
    idx := null;
    if jsonb_typeof(cur) = 'array' then
      select (t.ord - 1)::int into idx
      from jsonb_array_elements(cur) with ordinality as t(el, ord)
      where t.el ->> 'id' = seg;
      if idx is null then
        return jsonb_build_object('pad', to_jsonb(pad), 'huidig', 'null'::jsonb, 'gevonden', false);
      end if;
      pad := pad || idx::text;
      cur := cur -> idx;
    else
      pad := pad || seg;
      cur := case when jsonb_typeof(cur) = 'object' then cur -> seg else null end;
    end if;
  end loop;
  return jsonb_build_object('pad', to_jsonb(pad), 'huidig', coalesce(cur, 'null'::jsonb), 'gevonden', true);
end $$;

-- Slaat één veld in een jsonb-sectie op, alleen als het nog de waarde heeft die de gebruiker zag.
-- Zo blijven wijzigingen in andere velden van dezelfde sectie bewaard.
create function public.avf_veld_opslaan(
  p_avf_id uuid, p_sectie text, p_pad text[], p_oud jsonb, p_nieuw jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_root jsonb; v_res jsonb; v_huidig jsonb; v_pad text[]; v_nieuw jsonb; v_n int;
begin
  if p_sectie not in ('beginsituatie', 'doelen', 'veiligheid', 'organisatie', 'communicatie') then
    raise exception 'Onbekende sectie' using errcode = '22023';
  end if;
  execute format('select %I from public.avf where id = $1 for update', p_sectie) into v_root using p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  v_res := public.avf_pad_oplossen(v_root, p_pad);
  if not (v_res ->> 'gevonden')::boolean then
    return jsonb_build_object('ok', false, 'reden', 'verdwenen');
  end if;
  v_huidig := v_res -> 'huidig';
  if v_huidig is distinct from coalesce(p_oud, 'null'::jsonb) then
    return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', v_huidig);
  end if;
  v_pad := array(select jsonb_array_elements_text(v_res -> 'pad'));
  v_nieuw := public.jsonb_diep_zetten(coalesce(v_root, '{}'::jsonb), v_pad, coalesce(p_nieuw, 'null'::jsonb));
  execute format('update public.avf set %I = $1 where id = $2', p_sectie) using v_nieuw, p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  return jsonb_build_object('ok', true, 'nieuw', coalesce(p_nieuw, 'null'::jsonb));
end $$;

-- Voegt een item toe aan een lijst (bijv. risico's) met een eigen id.
create function public.avf_lijst_toevoegen(
  p_avf_id uuid, p_sectie text, p_pad text[], p_item jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_root jsonb; v_res jsonb; v_lijst jsonb; v_pad text[]; v_item jsonb; v_nieuw jsonb; v_n int;
begin
  if p_sectie not in ('beginsituatie', 'doelen', 'veiligheid', 'organisatie', 'communicatie') then
    raise exception 'Onbekende sectie' using errcode = '22023';
  end if;
  execute format('select %I from public.avf where id = $1 for update', p_sectie) into v_root using p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  v_res := public.avf_pad_oplossen(v_root, p_pad);
  v_lijst := v_res -> 'huidig';
  if jsonb_typeof(v_lijst) is distinct from 'array' then
    v_lijst := '[]'::jsonb;
  end if;
  v_item := coalesce(p_item, '{}'::jsonb) || jsonb_build_object('id', gen_random_uuid()::text);
  v_pad := array(select jsonb_array_elements_text(v_res -> 'pad'));
  v_nieuw := public.jsonb_diep_zetten(coalesce(v_root, '{}'::jsonb), v_pad, v_lijst || jsonb_build_array(v_item));
  execute format('update public.avf set %I = $1 where id = $2', p_sectie) using v_nieuw, p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  return jsonb_build_object('ok', true, 'item', v_item);
end $$;

-- Verwijdert een item uit een lijst op id (al verwijderd telt als gelukt).
create function public.avf_lijst_verwijderen(
  p_avf_id uuid, p_sectie text, p_pad text[], p_item_id text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_root jsonb; v_res jsonb; v_lijst jsonb; v_pad text[]; v_nieuw_lijst jsonb; v_nieuw jsonb; v_n int;
begin
  if p_sectie not in ('beginsituatie', 'doelen', 'veiligheid', 'organisatie', 'communicatie') then
    raise exception 'Onbekende sectie' using errcode = '22023';
  end if;
  execute format('select %I from public.avf where id = $1 for update', p_sectie) into v_root using p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  v_res := public.avf_pad_oplossen(v_root, p_pad);
  v_lijst := v_res -> 'huidig';
  if jsonb_typeof(v_lijst) is distinct from 'array' then
    return jsonb_build_object('ok', true);
  end if;
  select coalesce(jsonb_agg(el), '[]'::jsonb) into v_nieuw_lijst
  from jsonb_array_elements(v_lijst) as el where el ->> 'id' is distinct from p_item_id;
  v_pad := array(select jsonb_array_elements_text(v_res -> 'pad'));
  v_nieuw := public.jsonb_diep_zetten(coalesce(v_root, '{}'::jsonb), v_pad, v_nieuw_lijst);
  execute format('update public.avf set %I = $1 where id = $2', p_sectie) using v_nieuw, p_avf_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Legt vast wie een sectie het laatst wijzigde.
create function public.avf_sectie_markeren(p_avf_id uuid, p_letter text, p_naam text) returns void
language sql security invoker set search_path = public as $$
  update public.avf
  set sectie_bijgewerkt = jsonb_set(
    coalesce(sectie_bijgewerkt, '{}'::jsonb), array[p_letter],
    jsonb_build_object('updated_at', now(), 'naam', left(coalesce(p_naam, ''), 60)), true)
  where id = p_avf_id and p_letter in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
$$;

-- Onderdelen: toevoegen aan het einde van een fase en omhoog of omlaag verschuiven.
create function public.avf_onderdeel_toevoegen(p_avf_id uuid, p_fase public.fase) returns public.avf_onderdeel
language plpgsql security invoker set search_path = public as $$
declare v_rij public.avf_onderdeel;
begin
  insert into public.avf_onderdeel (avf_id, fase, volgorde)
  values (p_avf_id, p_fase,
    coalesce((select max(volgorde) from public.avf_onderdeel where avf_id = p_avf_id and fase = p_fase), 0) + 1)
  returning * into v_rij;
  return v_rij;
end $$;

create function public.avf_onderdeel_verplaatsen(p_onderdeel_id uuid, p_richting int) returns boolean
language plpgsql security invoker set search_path = public as $$
declare a public.avf_onderdeel; b public.avf_onderdeel;
begin
  select * into a from public.avf_onderdeel where id = p_onderdeel_id for update;
  if not found then return false; end if;
  if p_richting < 0 then
    select * into b from public.avf_onderdeel
    where avf_id = a.avf_id and fase = a.fase and volgorde < a.volgorde order by volgorde desc limit 1 for update;
  else
    select * into b from public.avf_onderdeel
    where avf_id = a.avf_id and fase = a.fase and volgorde > a.volgorde order by volgorde asc limit 1 for update;
  end if;
  if not found then return false; end if;
  update public.avf_onderdeel set volgorde = b.volgorde where id = a.id;
  update public.avf_onderdeel set volgorde = a.volgorde where id = b.id;
  return true;
end $$;

-- ------------------------------------------------ programma en planning
-- Wijst een belevenis aan een tijdvak en locatie toe. Eén groep per tijdvak.
create function public.avf_planning_toewijzen(
  p_avf_id uuid, p_regel_id uuid, p_locatie text, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; r public.programma_regel%rowtype; v_bezet text;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  if p_regel_id is not null then
    select * into r from public.programma_regel where id = p_regel_id;
    if not found or r.cluster_id <> a.cluster_id or r.soort <> 'belevenis' then
      return jsonb_build_object('ok', false, 'reden', 'ongeldig_tijdvak');
    end if;
    select pg.naam into v_bezet
    from public.avf b join public.projectgroep pg on pg.id = b.projectgroep_id
    where b.programma_regel_id = p_regel_id and b.id <> p_avf_id;
    if found then
      return jsonb_build_object('ok', false, 'reden', 'bezet', 'door', v_bezet);
    end if;
  end if;
  update public.avf
  set programma_regel_id = p_regel_id, locatie_tekst = nullif(btrim(coalesce(p_locatie, '')), '')
  where id = p_avf_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', p_avf_id, 'planning_toegewezen', auth.uid(), left(p_naam, 60), a.cluster_id, a.projectgroep_id,
          jsonb_build_object('programma_regel_id', p_regel_id, 'locatie', nullif(btrim(coalesce(p_locatie, '')), '')));
  return jsonb_build_object('ok', true);
end $$;

-- Laat twee groepen van tijdvak wisselen.
create function public.avf_planning_wisselen(p_avf_a uuid, p_avf_b uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; b public.avf%rowtype;
begin
  select * into a from public.avf where id = p_avf_a;
  select * into b from public.avf where id = p_avf_b;
  if a.id is null or b.id is null or a.cluster_id <> b.cluster_id or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  update public.avf set programma_regel_id = null where id = a.id;
  update public.avf set programma_regel_id = a.programma_regel_id where id = b.id;
  update public.avf set programma_regel_id = b.programma_regel_id where id = a.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'planning_gewisseld', auth.uid(), left(p_naam, 60), a.cluster_id, a.projectgroep_id,
          jsonb_build_object('met_avf', b.id)),
         ('avf', b.id, 'planning_gewisseld', auth.uid(), left(p_naam, 60), b.cluster_id, b.projectgroep_id,
          jsonb_build_object('met_avf', a.id));
  return jsonb_build_object('ok', true);
end $$;

-- Past een programmaregel aan. Waarschuwt als iemand anders de regel net wijzigde.
create function public.programma_regel_wijzigen(
  p_id uuid, p_titel text, p_omschrijving text, p_locatie text,
  p_dag date, p_start time, p_eind time,
  p_deelnemers int[], p_rocks_rivers int[],
  p_verwacht timestamptz, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.programma_regel%rowtype;
begin
  select * into r from public.programma_regel where id = p_id for update;
  if not found or not public.mag_programma_beheren(r.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  if r.updated_at is distinct from p_verwacht then
    return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', to_jsonb(r));
  end if;
  if p_eind <= p_start or nullif(btrim(coalesce(p_titel, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  update public.programma_regel
  set titel = btrim(p_titel),
      omschrijving = nullif(btrim(coalesce(p_omschrijving, '')), ''),
      locatie = nullif(btrim(coalesce(p_locatie, '')), ''),
      dag = p_dag, starttijd = p_start, eindtijd = p_eind,
      deelnemers = coalesce(p_deelnemers, '{}'), rocks_rivers_groepen = coalesce(p_rocks_rivers, '{}'),
      bijgewerkt_door_naam = left(p_naam, 60)
  where id = p_id
  returning * into r;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('programma_regel', r.id, 'programma_gewijzigd', auth.uid(), left(p_naam, 60), r.cluster_id,
          jsonb_build_object('titel', r.titel, 'dag', r.dag, 'start', r.starttijd, 'eind', r.eindtijd));
  return jsonb_build_object('ok', true, 'updated_at', r.updated_at);
end $$;

-- Alleen ingelogde gebruikers mogen de functies aanroepen.
do $$
declare f text;
begin
  foreach f in array array[
    'mag_avf_lezen(uuid)', 'mag_avf_schrijven(uuid)', 'mag_programma_beheren(uuid)',
    'jsonb_diep_zetten(jsonb, text[], jsonb)', 'avf_pad_oplossen(jsonb, text[])',
    'avf_veld_opslaan(uuid, text, text[], jsonb, jsonb)',
    'avf_lijst_toevoegen(uuid, text, text[], jsonb)',
    'avf_lijst_verwijderen(uuid, text, text[], text)',
    'avf_sectie_markeren(uuid, text, text)',
    'avf_onderdeel_toevoegen(uuid, public.fase)',
    'avf_onderdeel_verplaatsen(uuid, int)',
    'avf_planning_toewijzen(uuid, uuid, text, text)',
    'avf_planning_wisselen(uuid, uuid, text)',
    'programma_regel_wijzigen(uuid, text, text, text, date, time, time, int[], int[], timestamptz, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
