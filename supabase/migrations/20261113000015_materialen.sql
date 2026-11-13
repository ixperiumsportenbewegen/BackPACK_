-- Opdracht 5, deel A (2): gedeelde materialenlijst en materialen in het AVF.
-- Uitgangspunten:
--  * één lijst voor VD en VC, met de voorraad per locatie (camping en bivak);
--  * Logistiek & Facilitair van VD bouwt de lijst (concept) en maakt hem definitief; pas daarna kunnen projectgroepen kiezen;
--  * VC ziet de lijst pas als hij definitief is en mag alleen materialen toevoegen;
--  * materialen worden hergebruikt: er is alleen een tekort als twee belevenissen op dezelfde locatie tegelijk
--    meer nodig hebben dan er ligt (of één belevenis alleen al meer vraagt dan er ligt).

-- ------------------------------------------------------------ hulpfuncties
create function public.mijn_cluster_code() returns text
language sql stable security definer set search_path = public as $$
  select c.code from public.cluster c where c.id = public.mijn_cluster()
$$;

create function public.mijn_stuurgroeprol_code() returns text
language sql stable security definer set search_path = public as $$
  select r.code::text from public.stuurgroeprol r where r.id = public.mijn_stuurgroeprol()
$$;

-- ----------------------------------------------------------------- tabellen
create table public.materiaal (
  id uuid primary key default gen_random_uuid(),
  naam text not null check (char_length(btrim(naam)) between 1 and 100),
  categorie text check (categorie is null or char_length(categorie) <= 60),
  voorraad_camping int not null default 0 check (voorraad_camping between 0 and 99999),
  voorraad_bivak int not null default 0 check (voorraad_bivak between 0 and 99999),
  opmerking text check (opmerking is null or char_length(opmerking) <= 300),
  actief boolean not null default true,
  toegevoegd_door_cluster uuid references public.cluster (id) on delete set null,
  bijgewerkt_door_naam text check (bijgewerkt_door_naam is null or char_length(bijgewerkt_door_naam) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index materiaal_naam_uniek on public.materiaal (lower(btrim(naam)));

create trigger materiaal_updated_at before update on public.materiaal
  for each row execute function public.set_updated_at();

-- Eén rij: is de lijst nog concept of definitief?
create table public.materiaallijst_status (
  id boolean primary key default true check (id),
  status text not null default 'concept' check (status in ('concept', 'definitief')),
  definitief_op timestamptz,
  definitief_door_naam text,
  definitief_door_cluster uuid references public.cluster (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.materiaallijst_status (id) values (true);

create function public.materiaallijst_definitief() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'definitief' from public.materiaallijst_status), false)
$$;

-- Wie bouwt de lijst: de docent en Logistiek & Facilitair van VD (en van TEST, om te kunnen oefenen).
create function public.mag_materiaal_beheren() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_docent()
         or (public.mijn_soort() = 'stuurgroep' and public.mijn_stuurgroeprol_code() = 'logistiek_facilitair'
             and public.mijn_cluster_code() in ('VD', 'TEST'))
$$;

-- Wie mag materialen toevoegen: de bouwers, en Logistiek & Facilitair van VC zodra de lijst definitief is.
create function public.mag_materiaal_toevoegen() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mag_materiaal_beheren()
         or (public.mijn_soort() = 'stuurgroep' and public.mijn_stuurgroeprol_code() = 'logistiek_facilitair'
             and public.mijn_cluster_code() = 'VC' and public.materiaallijst_definitief())
$$;

-- Wie mag de lijst lezen: de bouwers altijd; stuurgroepen en projectgroepen zodra hij definitief is.
create function public.mag_materiaal_lezen() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mag_materiaal_beheren()
         or (public.materiaallijst_definitief() and public.mijn_soort() in ('stuurgroep', 'projectgroep'))
$$;

-- Zet wie een materiaal toevoegde, en logt wijzigingen in de lijst.
create function public.materiaal_voor_toevoegen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.toegevoegd_door_cluster := public.mijn_cluster();
  return new;
end $$;
create trigger materiaal_voor_toevoegen before insert on public.materiaal
  for each row execute function public.materiaal_voor_toevoegen();

create function public.materiaal_logboek() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
    values ('materiaal', new.id, 'materiaal_toegevoegd', auth.uid(), new.bijgewerkt_door_naam, public.mijn_cluster(),
            jsonb_build_object('naam', new.naam, 'voorraad_camping', new.voorraad_camping, 'voorraad_bivak', new.voorraad_bivak));
  elsif (to_jsonb(new) - 'updated_at' - 'bijgewerkt_door_naam') is distinct from (to_jsonb(old) - 'updated_at' - 'bijgewerkt_door_naam') then
    insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
    values ('materiaal', new.id, 'materiaal_gewijzigd', auth.uid(), new.bijgewerkt_door_naam, public.mijn_cluster(),
            jsonb_build_object('naam', new.naam,
              'voorraad_camping', jsonb_build_array(old.voorraad_camping, new.voorraad_camping),
              'voorraad_bivak', jsonb_build_array(old.voorraad_bivak, new.voorraad_bivak),
              'actief', jsonb_build_array(old.actief, new.actief)));
  end if;
  return null;
end $$;
create trigger materiaal_logboek after insert or update on public.materiaal
  for each row execute function public.materiaal_logboek();

-- Materialen in een AVF (sectie F). De locatie van de belevenis staat in het AVF; daarom één aantal.
create table public.avf_materiaal (
  id uuid primary key default gen_random_uuid(),
  avf_id uuid not null references public.avf (id) on delete cascade,
  fase public.fase,
  materiaal_id uuid references public.materiaal (id),
  omschrijving text check (omschrijving is null or char_length(btrim(omschrijving)) between 1 and 150),
  aantal int not null check (aantal between 1 and 9999),
  aantal_gecorrigeerd int check (aantal_gecorrigeerd is null or aantal_gecorrigeerd between 0 and 9999),
  gecorrigeerd_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avf_materiaal_soort check ((materiaal_id is not null) <> (omschrijving is not null))
);
create unique index avf_materiaal_uniek_fase on public.avf_materiaal (avf_id, materiaal_id, fase) where materiaal_id is not null and fase is not null;
create unique index avf_materiaal_uniek_geen_fase on public.avf_materiaal (avf_id, materiaal_id) where materiaal_id is not null and fase is null;
create index on public.avf_materiaal (avf_id);
create index on public.avf_materiaal (materiaal_id);

create trigger avf_materiaal_updated_at before update on public.avf_materiaal
  for each row execute function public.set_updated_at();

-- Materialen kiezen kan pas als de locatie bekend is, en alleen uit materialen die nog actief zijn.
create function public.avf_materiaal_controle() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; m public.materiaal%rowtype;
begin
  select * into a from public.avf where id = new.avf_id;
  if a.locatie_keuze is null then
    raise exception 'Kies eerst de locatie van de belevenis (camping of bivak)' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.materiaal_id is not null then
    select * into m from public.materiaal where id = new.materiaal_id;
    if not found or not m.actief then
      raise exception 'Dit materiaal is niet beschikbaar' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger avf_materiaal_controle before insert or update on public.avf_materiaal
  for each row execute function public.avf_materiaal_controle();

-- De locatie kan niet meer leeg worden zodra er materialen zijn gekozen.
create function public.avf_locatie_bewaken() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.locatie_keuze is null and old.locatie_keuze is not null
     and exists (select 1 from public.avf_materiaal where avf_id = new.id) then
    raise exception 'De locatie kan niet leeg worden zolang er materialen zijn gekozen' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger avf_locatie_bewaken before update of locatie_keuze on public.avf
  for each row execute function public.avf_locatie_bewaken();

-- Een wijziging in de materialen zet verzoeken bij sectie F op "aangepast" en is wezenlijk na goedkeuring.
create function public.avf_materiaal_na_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_avf uuid := coalesce(new.avf_id, old.avf_id);
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at' - 'aantal_gecorrigeerd' - 'gecorrigeerd_door_naam')
         is not distinct from (to_jsonb(old) - 'updated_at' - 'aantal_gecorrigeerd' - 'gecorrigeerd_door_naam') then
    return null; -- alleen een correctie van de stuurgroep
  end if;
  perform public.verzoeken_markeren_aangepast(v_avf, 'F', null);
  perform public.avf_wezenlijk_gewijzigd(v_avf, 'materialen');
  return null;
end $$;
create trigger avf_materiaal_na_wijziging after insert or update or delete on public.avf_materiaal
  for each row execute function public.avf_materiaal_na_wijziging();

-- --------------------------------------------------------------- afscherming
alter table public.materiaal enable row level security;
alter table public.materiaallijst_status enable row level security;
alter table public.avf_materiaal enable row level security;
revoke all on public.materiaal, public.materiaallijst_status, public.avf_materiaal from anon, authenticated;

grant select on public.materiaallijst_status to authenticated;
create policy materiaallijst_status_lezen on public.materiaallijst_status for select to authenticated using (true);

grant select on public.materiaal to authenticated;
grant insert (naam, categorie, voorraad_camping, voorraad_bivak, opmerking, bijgewerkt_door_naam) on public.materiaal to authenticated;
grant update (naam, categorie, voorraad_camping, voorraad_bivak, opmerking, actief, bijgewerkt_door_naam) on public.materiaal to authenticated;
create policy materiaal_lezen on public.materiaal for select to authenticated using (public.mag_materiaal_lezen());
create policy materiaal_toevoegen on public.materiaal for insert to authenticated with check (public.mag_materiaal_toevoegen());
create policy materiaal_wijzigen on public.materiaal for update to authenticated
  using (public.mag_materiaal_beheren()) with check (public.mag_materiaal_beheren());

grant select, delete on public.avf_materiaal to authenticated;
grant insert (avf_id, fase, materiaal_id, omschrijving, aantal) on public.avf_materiaal to authenticated;
grant update (fase, omschrijving, aantal) on public.avf_materiaal to authenticated;
create policy avf_materiaal_lezen on public.avf_materiaal for select to authenticated using (public.mag_avf_lezen(avf_id));
create policy avf_materiaal_toevoegen on public.avf_materiaal for insert to authenticated
  with check (public.mag_avf_schrijven(avf_id) and (materiaal_id is null or public.materiaallijst_definitief()));
create policy avf_materiaal_wijzigen on public.avf_materiaal for update to authenticated
  using (public.mag_avf_schrijven(avf_id)) with check (public.mag_avf_schrijven(avf_id));
create policy avf_materiaal_verwijderen on public.avf_materiaal for delete to authenticated
  using (public.mag_avf_schrijven(avf_id));

-- ----------------------------------------------------------------- functies
-- Lijst definitief maken: daarna kunnen projectgroepen materialen kiezen en ziet VC de lijst.
create function public.materiaallijst_definitief_maken(p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  if not public.mag_materiaal_beheren() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if public.materiaallijst_definitief() then return jsonb_build_object('ok', false, 'reden', 'al_definitief'); end if;
  if not exists (select 1 from public.materiaal where actief) then return jsonb_build_object('ok', false, 'reden', 'leeg'); end if;
  update public.materiaallijst_status
  set status = 'definitief', definitief_op = now(), definitief_door_naam = v_naam,
      definitief_door_cluster = public.mijn_cluster(), updated_at = now()
  where id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaallijst_status', null, 'materiaallijst_definitief', auth.uid(), v_naam, public.mijn_cluster(), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- Alleen de docent kan de lijst weer op concept zetten (bijvoorbeeld om nog iets recht te zetten).
create function public.materiaallijst_terugzetten(p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  if not public.is_docent() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  update public.materiaallijst_status
  set status = 'concept', definitief_op = null, definitief_door_naam = null, definitief_door_cluster = null, updated_at = now()
  where id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaallijst_status', null, 'materiaallijst_concept', auth.uid(), v_naam, null, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- Correctie van de stuurgroep op een aantal (leeg = correctie weghalen).
create function public.avf_materiaal_corrigeren(p_id uuid, p_aantal int, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.avf_materiaal%rowtype; a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into m from public.avf_materiaal where id = p_id for update;
  if not found then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into a from public.avf where id = m.avf_id;
  if not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_aantal is not null and (p_aantal < 0 or p_aantal > 9999) then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  update public.avf_materiaal
  set aantal_gecorrigeerd = case when p_aantal is not distinct from aantal then null else p_aantal end,
      gecorrigeerd_door_naam = v_naam
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'materiaal_gecorrigeerd', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('avf_materiaal_id', p_id, 'van', m.aantal, 'naar', p_aantal));
  return jsonb_build_object('ok', true);
end $$;

-- Per materiaal: voorraad op de locatie van dit AVF en wat andere belevenissen op dezelfde locatie tegelijk gebruiken.
-- De projectgroep ziet alleen de aantallen, niet welke belevenis het is. VD en VC tellen mee; TEST staat apart.
create function public.materiaal_beschikbaar(p_avf_id uuid)
returns table (materiaal_id uuid, voorraad int, anderen int)
language plpgsql stable security definer set search_path = public as $$
declare a public.avf%rowtype; ra public.programma_regel%rowtype; v_test boolean;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_avf_lezen(p_avf_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if a.locatie_keuze is null or not (public.materiaallijst_definitief() or public.mag_materiaal_beheren()) then
    return;
  end if;
  select (c.code = 'TEST') into v_test from public.cluster c where c.id = a.cluster_id;
  select * into ra from public.programma_regel where id = a.programma_regel_id;
  return query
  select m.id,
         case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end,
         coalesce((
           select sum(coalesce(x.aantal_gecorrigeerd, x.aantal))::int
           from public.avf_materiaal x
           join public.avf b on b.id = x.avf_id
           join public.cluster cb on cb.id = b.cluster_id
           join public.programma_regel rb on rb.id = b.programma_regel_id
           where x.materiaal_id = m.id and b.id <> a.id and b.locatie_keuze = a.locatie_keuze
             and (cb.code = 'TEST') = v_test
             and ra.id is not null and rb.dag = ra.dag and rb.starttijd < ra.eindtijd and rb.eindtijd > ra.starttijd
         ), 0)
  from public.materiaal m;
end $$;

-- Voor de stuurgroep: per belevenis van het cluster en materiaal wat er ligt en wat anderen tegelijk gebruiken.
create function public.materiaal_context(p_cluster_id uuid)
returns table (avf_id uuid, materiaal_id uuid, locatie text, voorraad int, anderen int)
language plpgsql stable security definer set search_path = public as $$
declare v_test boolean;
begin
  if not public.mag_programma_beheren(p_cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  select (c.code = 'TEST') into v_test from public.cluster c where c.id = p_cluster_id;
  return query
  select a.id, g.materiaal_id, a.locatie_keuze,
         case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end,
         coalesce((
           select sum(coalesce(x.aantal_gecorrigeerd, x.aantal))::int
           from public.avf_materiaal x
           join public.avf b on b.id = x.avf_id
           join public.cluster cb on cb.id = b.cluster_id
           join public.programma_regel rb on rb.id = b.programma_regel_id
           where x.materiaal_id = g.materiaal_id and b.id <> a.id and b.locatie_keuze = a.locatie_keuze
             and (cb.code = 'TEST') = v_test
             and ra.id is not null and rb.dag = ra.dag and rb.starttijd < ra.eindtijd and rb.eindtijd > ra.starttijd
         ), 0)
  from public.avf a
  join (select distinct x.avf_id, x.materiaal_id from public.avf_materiaal x where x.materiaal_id is not null) g on g.avf_id = a.id
  join public.materiaal m on m.id = g.materiaal_id
  left join public.programma_regel ra on ra.id = a.programma_regel_id
  where a.cluster_id = p_cluster_id and a.locatie_keuze is not null;
end $$;

-- ------------------------------------------------------------------- rechten
do $$
declare f text;
begin
  foreach f in array array[
    'mijn_cluster_code()', 'mijn_stuurgroeprol_code()', 'materiaallijst_definitief()',
    'mag_materiaal_beheren()', 'mag_materiaal_toevoegen()', 'mag_materiaal_lezen()',
    'materiaallijst_definitief_maken(text)', 'materiaallijst_terugzetten(text)',
    'avf_materiaal_corrigeren(uuid, int, text)', 'materiaal_beschikbaar(uuid)', 'materiaal_context(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'materiaal_voor_toevoegen()', 'materiaal_logboek()', 'avf_materiaal_controle()', 'avf_locatie_bewaken()',
    'avf_materiaal_na_wijziging()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
