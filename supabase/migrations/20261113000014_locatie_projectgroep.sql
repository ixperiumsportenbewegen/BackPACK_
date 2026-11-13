-- Opdracht 5, deel A (1): de projectgroep kiest zelf de locatie van de belevenis: camping of bivak,
-- met een tekst over waar precies. Dat is nodig voor de voorraad per locatie bij de materialen.
-- De stuurgroep kan de keuze nog corrigeren via avf_planning_toewijzen (alleen camping of bivak).

alter table public.avf add column locatie_keuze text check (locatie_keuze in ('camping', 'bivak'));
alter table public.avf add column locatie_detail text check (locatie_detail is null or char_length(locatie_detail) <= 200);

-- bestaande waarden uit locatie_tekst overnemen
update public.avf
set locatie_keuze = case
      when lower(locatie_tekst) like '%bivak%' then 'bivak'
      when lower(locatie_tekst) like '%camping%' then 'camping'
    end,
    locatie_detail = case when lower(btrim(locatie_tekst)) in ('camping', 'bivak') then null else left(locatie_tekst, 200) end
where locatie_tekst is not null;

grant update (locatie_keuze, locatie_detail) on public.avf to authenticated;

-- Wijzigingen in locatie tellen mee: verzoeken bij sectie A worden "aangepast" en de keuze is wezenlijk na goedkeuring
create or replace function public.avf_na_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.titel is distinct from old.titel or new.verschijningsvorm is distinct from old.verschijningsvorm
     or new.publieke_samenvatting is distinct from old.publieke_samenvatting
     or new.organiserende_studenten is distinct from old.organiserende_studenten
     or new.doelgroep is distinct from old.doelgroep or new.aantal_deelnemers is distinct from old.aantal_deelnemers
     or new.contactpersoon is distinct from old.contactpersoon
     or new.locatie_keuze is distinct from old.locatie_keuze or new.locatie_detail is distinct from old.locatie_detail then
    perform public.verzoeken_markeren_aangepast(new.id, 'A', null);
  end if;
  if new.beginsituatie is distinct from old.beginsituatie then perform public.verzoeken_markeren_aangepast(new.id, 'B', null); end if;
  if new.doelen is distinct from old.doelen then perform public.verzoeken_markeren_aangepast(new.id, 'C', null); end if;
  if new.veiligheid is distinct from old.veiligheid then perform public.verzoeken_markeren_aangepast(new.id, 'E', null); end if;
  if new.organisatie is distinct from old.organisatie then perform public.verzoeken_markeren_aangepast(new.id, 'G', null); end if;
  if new.communicatie is distinct from old.communicatie then perform public.verzoeken_markeren_aangepast(new.id, 'H', null); end if;

  -- wezenlijk: verschijningsvorm, locatiekeuze en sectie E (docs/avf-velden.md)
  if old.status = 'goedgekeurd' and new.status = 'goedgekeurd'
     and (new.verschijningsvorm is distinct from old.verschijningsvorm or new.veiligheid is distinct from old.veiligheid
          or new.locatie_keuze is distinct from old.locatie_keuze) then
    perform public.avf_wezenlijk_gewijzigd(new.id, case
      when new.veiligheid is distinct from old.veiligheid then 'sectie E'
      when new.locatie_keuze is distinct from old.locatie_keuze then 'locatie'
      else 'verschijningsvorm' end);
  end if;
  return null;
end $$;

-- De stuurgroep wijst een tijdvak toe en kan de locatiekeuze van de groep corrigeren (alleen camping of bivak).
-- Een lege locatie laat de keuze van de projectgroep ongemoeid.
create or replace function public.avf_planning_toewijzen(
  p_avf_id uuid, p_regel_id uuid, p_locatie text, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; r public.programma_regel%rowtype; v_bezet text;
  v_loc text := lower(nullif(btrim(coalesce(p_locatie, '')), ''));
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  if v_loc is not null and v_loc not in ('camping', 'bivak') then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig_locatie');
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
  set programma_regel_id = p_regel_id, locatie_keuze = coalesce(v_loc, locatie_keuze)
  where id = p_avf_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', p_avf_id, 'planning_toegewezen', auth.uid(), left(p_naam, 60), a.cluster_id, a.projectgroep_id,
          jsonb_build_object('programma_regel_id', p_regel_id, 'locatie', v_loc));
  return jsonb_build_object('ok', true);
end $$;

-- Controle verplichte velden: de locatie hoort erbij
create or replace function public.avf_ontbrekend(p_avf_id uuid) returns text[]
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
  if a.locatie_keuze is null then res := array_append(res, ('Locatie: camping of bivak')::text); end if;

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
