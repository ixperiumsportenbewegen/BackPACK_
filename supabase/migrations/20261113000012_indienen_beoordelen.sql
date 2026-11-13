-- Opdracht 4: indienen en beoordelen.
-- Uitgangspunten (docs/rechtenmatrix.md):
--  * status, versie en goedkeuring wijzigen alleen via functies met eigen rechtencontrole;
--  * avf_versie, verbeterverzoek en themacheck zijn voor clients alleen leesbaar (schrijven via functies);
--  * een verbeterverzoek wordt automatisch "aangepast" zodra de projectgroep er iets aan wijzigt (triggers);
--  * een wezenlijke wijziging na goedkeuring zet `opnieuw_te_controleren` (trigger).

create type public.verzoek_status as enum ('open', 'aangepast', 'afgehandeld');
create type public.themacheck_oordeel as enum ('akkoord', 'aandachtspunt');

-- ------------------------------------------------------------ tabellen
create table public.avf_versie (
  id uuid primary key default gen_random_uuid(),
  avf_id uuid not null references public.avf (id) on delete cascade,
  versie int not null check (versie >= 1),
  inhoud jsonb not null,
  ingediend_door_naam text not null,
  wijzigingssamenvatting text check (wijzigingssamenvatting is null or char_length(wijzigingssamenvatting) <= 1000),
  created_at timestamptz not null default now(),
  unique (avf_id, versie)
);

create table public.verbeterverzoek (
  id uuid primary key default gen_random_uuid(),
  avf_id uuid not null references public.avf (id) on delete cascade,
  sectie text not null check (sectie in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
  onderdeel_id uuid references public.avf_onderdeel (id) on delete set null,
  veld_sleutel text check (veld_sleutel is null or char_length(veld_sleutel) <= 80),
  projectgroeprol public.projectgroeprol not null,
  tekst text not null check (char_length(btrim(tekst)) between 1 and 1000),
  status public.verzoek_status not null default 'open',
  door_account uuid references public.account (id) on delete set null,
  door_naam text not null,
  aangepast_op timestamptz,
  afgehandeld_op timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.verbeterverzoek (avf_id, status);
create index on public.verbeterverzoek (onderdeel_id);

create table public.themacheck (
  avf_id uuid not null references public.avf (id) on delete cascade,
  stuurgroeprol_code public.stuurgroeprol_code not null,
  oordeel public.themacheck_oordeel not null,
  toelichting text check (toelichting is null or char_length(toelichting) <= 1000),
  door_account uuid references public.account (id) on delete set null,
  door_naam text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (avf_id, stuurgroeprol_code)
);

create trigger verbeterverzoek_updated_at before update on public.verbeterverzoek
  for each row execute function public.set_updated_at();
create trigger themacheck_updated_at before update on public.themacheck
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ afscherming
alter table public.avf_versie enable row level security;
alter table public.verbeterverzoek enable row level security;
alter table public.themacheck enable row level security;
revoke all on public.avf_versie, public.verbeterverzoek, public.themacheck from anon, authenticated;
grant select on public.avf_versie, public.verbeterverzoek, public.themacheck to authenticated;

create policy avf_versie_lezen on public.avf_versie for select to authenticated using (public.mag_avf_lezen(avf_id));
create policy verbeterverzoek_lezen on public.verbeterverzoek for select to authenticated using (public.mag_avf_lezen(avf_id));
create policy themacheck_lezen on public.themacheck for select to authenticated using (public.mag_avf_lezen(avf_id));

-- ------------------------------------------------------ verzoeken en wezenlijk
-- Zet open verbeterverzoeken voor een sectie (en eventueel een onderdeel) op "aangepast".
create function public.verzoeken_markeren_aangepast(p_avf_id uuid, p_sectie text, p_onderdeel_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.verbeterverzoek
  set status = 'aangepast', aangepast_op = now()
  where avf_id = p_avf_id and status = 'open' and sectie = p_sectie
    and (onderdeel_id is null or onderdeel_id = p_onderdeel_id)
$$;

-- Zet "opnieuw te controleren" bij een goedgekeurd AVF en schrijft dat een keer in het logboek.
create function public.avf_wezenlijk_gewijzigd(p_avf_id uuid, p_reden text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype;
begin
  update public.avf set opnieuw_te_controleren = true
  where id = p_avf_id and status = 'goedgekeurd' and not opnieuw_te_controleren
  returning * into a;
  if found then
    insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
    values ('avf', a.id, 'opnieuw_te_controleren', auth.uid(), null, a.cluster_id, a.projectgroep_id,
            jsonb_build_object('reden', p_reden));
  end if;
end $$;

create function public.avf_na_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.titel is distinct from old.titel or new.verschijningsvorm is distinct from old.verschijningsvorm
     or new.publieke_samenvatting is distinct from old.publieke_samenvatting
     or new.organiserende_studenten is distinct from old.organiserende_studenten
     or new.doelgroep is distinct from old.doelgroep or new.aantal_deelnemers is distinct from old.aantal_deelnemers
     or new.contactpersoon is distinct from old.contactpersoon then
    perform public.verzoeken_markeren_aangepast(new.id, 'A', null);
  end if;
  if new.beginsituatie is distinct from old.beginsituatie then perform public.verzoeken_markeren_aangepast(new.id, 'B', null); end if;
  if new.doelen is distinct from old.doelen then perform public.verzoeken_markeren_aangepast(new.id, 'C', null); end if;
  if new.veiligheid is distinct from old.veiligheid then perform public.verzoeken_markeren_aangepast(new.id, 'E', null); end if;
  if new.organisatie is distinct from old.organisatie then perform public.verzoeken_markeren_aangepast(new.id, 'G', null); end if;
  if new.communicatie is distinct from old.communicatie then perform public.verzoeken_markeren_aangepast(new.id, 'H', null); end if;

  -- wezenlijk: verschijningsvorm en sectie E (docs/avf-velden.md)
  if old.status = 'goedgekeurd' and new.status = 'goedgekeurd'
     and (new.verschijningsvorm is distinct from old.verschijningsvorm or new.veiligheid is distinct from old.veiligheid) then
    perform public.avf_wezenlijk_gewijzigd(new.id, case when new.veiligheid is distinct from old.veiligheid then 'sectie E' else 'verschijningsvorm' end);
  end if;
  return null;
end $$;
create trigger avf_na_wijziging after update on public.avf
  for each row execute function public.avf_na_wijziging();

create function public.avf_fase_na_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    perform public.verzoeken_markeren_aangepast(new.avf_id, 'D', null);
  end if;
  return null;
end $$;
create trigger avf_fase_na_wijziging after update on public.avf_fase
  for each row execute function public.avf_fase_na_wijziging();

create function public.avf_onderdeel_na_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.verzoeken_markeren_aangepast(new.avf_id, 'D', null);
    perform public.avf_wezenlijk_gewijzigd(new.avf_id, 'onderdeel toegevoegd');
  elsif tg_op = 'UPDATE' then
    -- het verschuiven van de volgorde telt niet als wijziging
    if (to_jsonb(new) - 'updated_at' - 'volgorde') is distinct from (to_jsonb(old) - 'updated_at' - 'volgorde') then
      perform public.verzoeken_markeren_aangepast(new.avf_id, 'D', new.id);
    end if;
    if new.fysieke_veiligheid is distinct from old.fysieke_veiligheid then
      perform public.avf_wezenlijk_gewijzigd(new.avf_id, 'fysieke veiligheid');
    end if;
  end if;
  return null;
end $$;
create trigger avf_onderdeel_na_wijziging after insert or update on public.avf_onderdeel
  for each row execute function public.avf_onderdeel_na_wijziging();

-- Bij verwijderen gebeurt het vooraf, zodat het verzoek van dit onderdeel nog bij het onderdeel hoort.
create function public.avf_onderdeel_voor_verwijderen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.verzoeken_markeren_aangepast(old.avf_id, 'D', old.id);
  perform public.avf_wezenlijk_gewijzigd(old.avf_id, 'onderdeel verwijderd');
  return old;
end $$;
create trigger avf_onderdeel_voor_verwijderen before delete on public.avf_onderdeel
  for each row execute function public.avf_onderdeel_voor_verwijderen();

-- ------------------------------------------------- controle verplichte velden
-- Zelfde regels als src/lib/avfVoortgang.ts. Geeft een lijst met meldingen (leeg = klaar om in te dienen).
create function public.tekst_leeg(p text) returns boolean
language sql immutable as $$ select nullif(btrim(coalesce(p, '')), '') is null $$;

create function public.avf_ontbrekend(p_avf_id uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  a public.avf%rowtype;
  res text[] := '{}';
  f public.fase;
  naam text;
  w text;
  sc jsonb;
  s text;
  o record;
  n int;
  i int;
  leeg text[];
  v jsonb;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found then return array['AVF niet gevonden']; end if;

  -- A
  if public.tekst_leeg(a.titel) then res := array_append(res, ('Titel van de belevenis')::text); end if;
  if public.tekst_leeg(a.verschijningsvorm) then res := array_append(res, ('Verschijningsvorm')::text); end if;
  if public.tekst_leeg(a.publieke_samenvatting) then res := array_append(res, ('Korte omschrijving voor andere groepen')::text); end if;
  if public.tekst_leeg(a.organiserende_studenten) then res := array_append(res, ('Organiserende studenten')::text); end if;
  if public.tekst_leeg(a.doelgroep) then res := array_append(res, ('Doelgroep')::text); end if;
  if a.aantal_deelnemers is null then res := array_append(res, ('Aantal deelnemers')::text); end if;
  if public.tekst_leeg(a.contactpersoon) then res := array_append(res, ('Contactpersoon tijdens de belevenis')::text); end if;

  -- B
  if public.tekst_leeg(a.beginsituatie ->> 'algemeen') then res := array_append(res, ('Algemene omschrijving van de groep')::text); end if;
  if public.tekst_leeg(a.beginsituatie ->> 'motorisch') and public.tekst_leeg(a.beginsituatie ->> 'cognitief')
     and public.tekst_leeg(a.beginsituatie ->> 'sociaal_emotioneel') then
    res := array_append(res, ('Beginsituatie: minstens één domein')::text);
  end if;

  -- C
  if public.tekst_leeg(a.doelen ->> 'motorisch') and public.tekst_leeg(a.doelen ->> 'cognitief')
     and public.tekst_leeg(a.doelen ->> 'sociaal_emotioneel') then
    res := array_append(res, ('Doelen: minstens één activiteitsdoel')::text);
  end if;

  -- D
  foreach f in array enum_range(null::public.fase) loop
    naam := initcap(f::text);
    if public.tekst_leeg((select organisatievorm from public.avf_fase where avf_id = a.id and fase = f)) then
      res := array_append(res, ((naam || ': organisatievorm'))::text);
    end if;
    if public.tekst_leeg((select coachen_instructies from public.avf_fase where avf_id = a.id and fase = f)) then
      res := array_append(res, ((naam || ': coachen en instructies'))::text);
    end if;
    v := coalesce((select opruimen from public.avf_fase where avf_id = a.id and fase = f), '{}'::jsonb);
    leeg := '{}';
    foreach w in array array['wie', 'wat', 'waar', 'wanneer', 'hoe', 'wat_erna'] loop
      if public.tekst_leeg(v ->> w) then leeg := leeg || w; end if;
    end loop;
    if array_length(leeg, 1) > 0 then res := array_append(res, ((naam || ': opruimen (6 W''s) is niet compleet'))::text); end if;

    select count(*) into n from public.avf_onderdeel where avf_id = a.id and fase = f;
    if n = 0 then res := array_append(res, ((naam || ': minstens één onderdeel'))::text); end if;
    i := 0;
    for o in select * from public.avf_onderdeel where avf_id = a.id and fase = f order by volgorde loop
      i := i + 1;
      if public.tekst_leeg(o.naam) then res := array_append(res, (format('%s, onderdeel %s: naam', naam, i))::text); end if;
      if o.duur_minuten is null then res := array_append(res, (format('%s, onderdeel %s: duur', naam, i))::text); end if;
      if public.tekst_leeg(o.beschrijving) then res := array_append(res, (format('%s, onderdeel %s: beschrijving', naam, i))::text); end if;
      if public.tekst_leeg(o.fysieke_veiligheid) then res := array_append(res, (format('%s, onderdeel %s: fysieke veiligheid', naam, i))::text); end if;
    end loop;
  end loop;

  -- E
  if not exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(a.veiligheid -> 'risicos') = 'array' then a.veiligheid -> 'risicos' else '[]'::jsonb end) r
    where not public.tekst_leeg(r ->> 'risico')
  ) then
    res := array_append(res, ('Risico''s: minstens één risico met maatregel')::text);
  end if;
  foreach s in array array['zeer_warm', 'zware_regen', 'onweer', 'koel'] loop
    sc := coalesce(a.veiligheid #> array['weer', s], '{}'::jsonb);
    if jsonb_typeof(sc -> 'relevant') is distinct from 'boolean' then
      res := array_append(res, (('Weer ' || s || ': afwegen (wel of niet relevant)'))::text);
    elsif (sc ->> 'relevant')::boolean then
      if public.tekst_leeg(sc ->> 'maatregel') or public.tekst_leeg(sc ->> 'alternatief')
         or public.tekst_leeg(sc ->> 'stopcriterium') or public.tekst_leeg(sc ->> 'beslisser') then
        res := array_append(res, (('Weer ' || s || ': nog niet alles ingevuld'))::text);
      end if;
    end if;
  end loop;
  if jsonb_typeof(a.veiligheid #> array['ehbo', 'aanvullend']) is distinct from 'boolean' then
    res := array_append(res, ('EHBO: zijn aanvullende maatregelen nodig (ja of nee)?')::text);
  elsif (a.veiligheid #>> array['ehbo', 'aanvullend'])::boolean and public.tekst_leeg(a.veiligheid #>> array['ehbo', 'maatregelen']) then
    res := array_append(res, ('EHBO: welke maatregelen (wie, waar, middelen)?')::text);
  end if;

  -- G
  if public.tekst_leeg(a.organisatie ->> 'bijdrage_thema') then res := array_append(res, ('Bijdrage aan het meerdaagsethema')::text); end if;
  select count(*) into n from public.projectgroep_rol where projectgroep_id = a.projectgroep_id and not public.tekst_leeg(namen);
  if n < 6 then res := array_append(res, ('Rolverdeling: alle zes de rollen hebben een naam nodig')::text); end if;
  if not public.tekst_leeg(a.organisatie ->> 'catering') and jsonb_typeof(a.organisatie -> 'allergieen_rekening_gehouden') is distinct from 'boolean' then
    res := array_append(res, ('Allergieën: is er rekening mee gehouden (ja of nee)?')::text);
  end if;

  -- H
  if public.tekst_leeg(a.communicatie ->> 'voor') then res := array_append(res, ('Communicatie: voor')::text); end if;
  if public.tekst_leeg(a.communicatie ->> 'tijdens') then res := array_append(res, ('Communicatie: tijdens')::text); end if;

  return res;
end $$;

-- ------------------------------------------------------------- functies
create function public.avf_indienen(
  p_avf_id uuid, p_naam text, p_samenvatting text, p_open_bevestigd boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.avf%rowtype;
  v_versie int;
  v_ontbrekend text[];
  v_open jsonb;
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_samen text := nullif(btrim(coalesce(p_samenvatting, '')), '');
begin
  select * into a from public.avf where id = p_avf_id for update;
  if not found or public.mijn_soort() is distinct from 'projectgroep' or a.projectgroep_id is distinct from public.mijn_projectgroep() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if a.status not in ('in_ontwikkeling', 'aanpassing_gevraagd') then
    return jsonb_build_object('ok', false, 'reden', 'status');
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;

  v_ontbrekend := public.avf_ontbrekend(a.id);
  if array_length(v_ontbrekend, 1) > 0 then
    return jsonb_build_object('ok', false, 'reden', 'ontbreekt', 'ontbrekend', to_jsonb(v_ontbrekend));
  end if;

  v_versie := a.versie + 1;
  if v_versie >= 2 and v_samen is null then
    return jsonb_build_object('ok', false, 'reden', 'samenvatting');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'sectie', sectie, 'tekst', tekst) order by created_at), '[]'::jsonb)
  into v_open from public.verbeterverzoek where avf_id = a.id and status = 'open';
  if jsonb_array_length(v_open) > 0 and not coalesce(p_open_bevestigd, false) then
    return jsonb_build_object('ok', false, 'reden', 'open_verzoeken', 'verzoeken', v_open);
  end if;

  insert into public.avf_versie (avf_id, versie, inhoud, ingediend_door_naam, wijzigingssamenvatting)
  values (a.id, v_versie, jsonb_build_object(
    'avf', to_jsonb(a) - 'sectie_bijgewerkt',
    'fasen', coalesce((select jsonb_agg(to_jsonb(f) order by f.fase) from public.avf_fase f where f.avf_id = a.id), '[]'::jsonb),
    'onderdelen', coalesce((select jsonb_agg(to_jsonb(o) order by o.fase, o.volgorde) from public.avf_onderdeel o where o.avf_id = a.id), '[]'::jsonb),
    'rolverdeling', coalesce((select jsonb_agg(jsonb_build_object('rol', r.rol, 'namen', r.namen)) from public.projectgroep_rol r where r.projectgroep_id = a.projectgroep_id), '[]'::jsonb)
  ), v_naam, case when v_versie >= 2 then left(v_samen, 1000) else null end);

  update public.avf
  set status = 'ingediend', versie = v_versie, ingediend_op = now(), ingediend_door_naam = v_naam, opnieuw_te_controleren = false
  where id = a.id;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'avf_ingediend', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('versie', v_versie, 'open_verzoeken', jsonb_array_length(v_open)));
  return jsonb_build_object('ok', true, 'versie', v_versie);
end $$;

create function public.avf_aanpassing_vragen(p_avf_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into a from public.avf where id = p_avf_id for update;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if a.status not in ('ingediend', 'goedgekeurd') then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  if not exists (select 1 from public.verbeterverzoek where avf_id = a.id and status = 'open') then
    return jsonb_build_object('ok', false, 'reden', 'geen_open_verzoek');
  end if;
  update public.avf set status = 'aanpassing_gevraagd', opnieuw_te_controleren = false where id = a.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'aanpassing_gevraagd', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create function public.avf_goedkeuren(p_avf_id uuid, p_naam text, p_open_bevestigd boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_open int;
begin
  select * into a from public.avf where id = p_avf_id for update;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if not (a.status = 'ingediend' or (a.status = 'goedgekeurd' and a.opnieuw_te_controleren)) then
    return jsonb_build_object('ok', false, 'reden', 'status');
  end if;
  select count(*) into v_open from public.verbeterverzoek where avf_id = a.id and status = 'open';
  if v_open > 0 and not coalesce(p_open_bevestigd, false) then
    return jsonb_build_object('ok', false, 'reden', 'open_verzoeken', 'aantal', v_open);
  end if;
  update public.avf
  set status = 'goedgekeurd', opnieuw_te_controleren = false, goedgekeurd_op = now(),
      goedgekeurd_door_naam = v_naam, goedgekeurd_door_account = auth.uid()
  where id = a.id;
  update public.verbeterverzoek set status = 'afgehandeld', afgehandeld_op = now()
  where avf_id = a.id and status in ('open', 'aangepast');
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'avf_goedgekeurd', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('versie', a.versie, 'open_verzoeken', v_open));
  return jsonb_build_object('ok', true);
end $$;

create function public.verbeterverzoek_plaatsen(
  p_avf_id uuid, p_sectie text, p_onderdeel_id uuid, p_veld_sleutel text,
  p_rol public.projectgroeprol, p_tekst text, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_id uuid;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if a.status = 'in_ontwikkeling' then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  if p_sectie not in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H') or p_rol is null
     or char_length(btrim(coalesce(p_tekst, ''))) not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_onderdeel_id is not null and not exists (select 1 from public.avf_onderdeel where id = p_onderdeel_id and avf_id = a.id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  insert into public.verbeterverzoek (avf_id, sectie, onderdeel_id, veld_sleutel, projectgroeprol, tekst, door_account, door_naam)
  values (a.id, p_sectie, p_onderdeel_id, left(p_veld_sleutel, 80), p_rol, btrim(p_tekst), auth.uid(), v_naam)
  returning id into v_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'verbeterverzoek_geplaatst', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('verzoek_id', v_id, 'sectie', p_sectie));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- De stuurgroep zet een verzoek op "afgehandeld" (tevreden) of terug op "open" (nog niet goed).
create function public.verbeterverzoek_status_zetten(p_id uuid, p_status public.verzoek_status, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.verbeterverzoek%rowtype; a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into v from public.verbeterverzoek where id = p_id for update;
  if not found then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into a from public.avf where id = v.avf_id;
  if not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_status = 'aangepast' then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  update public.verbeterverzoek
  set status = p_status,
      afgehandeld_op = case when p_status = 'afgehandeld' then now() else null end,
      aangepast_op = case when p_status = 'open' then null else aangepast_op end
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'verbeterverzoek_' || p_status::text, auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('verzoek_id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create function public.themacheck_zetten(
  p_avf_id uuid, p_rol public.stuurgroeprol_code, p_oordeel public.themacheck_oordeel, p_toelichting text, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_toel text := nullif(btrim(coalesce(p_toelichting, '')), '');
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_oordeel = 'aandachtspunt' and v_toel is null then return jsonb_build_object('ok', false, 'reden', 'toelichting'); end if;
  insert into public.themacheck (avf_id, stuurgroeprol_code, oordeel, toelichting, door_account, door_naam)
  values (a.id, p_rol, p_oordeel, left(v_toel, 1000), auth.uid(), v_naam)
  on conflict (avf_id, stuurgroeprol_code) do update
    set oordeel = excluded.oordeel, toelichting = excluded.toelichting,
        door_account = excluded.door_account, door_naam = excluded.door_naam;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'themacheck', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('rol', p_rol, 'oordeel', p_oordeel));
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------- rechten
-- Hulpfuncties en triggerfuncties zijn niet bedoeld om rechtstreeks aan te roepen.
do $$
declare f text;
begin
  foreach f in array array[
    'verzoeken_markeren_aangepast(uuid, text, uuid)', 'avf_wezenlijk_gewijzigd(uuid, text)',
    'avf_na_wijziging()', 'avf_fase_na_wijziging()', 'avf_onderdeel_na_wijziging()', 'avf_onderdeel_voor_verwijderen()',
    'avf_ontbrekend(uuid)', 'tekst_leeg(text)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'avf_indienen(uuid, text, text, boolean)', 'avf_aanpassing_vragen(uuid, text)', 'avf_goedkeuren(uuid, text, boolean)',
    'verbeterverzoek_plaatsen(uuid, text, uuid, text, public.projectgroeprol, text, text)',
    'verbeterverzoek_status_zetten(uuid, public.verzoek_status, text)',
    'themacheck_zetten(uuid, public.stuurgroeprol_code, public.themacheck_oordeel, text, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
