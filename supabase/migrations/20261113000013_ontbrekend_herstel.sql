-- Herstel van avf_ontbrekend uit migratie 12: de meldingen moesten expliciet als tekst worden toegevoegd.
-- (Migratie 12 bevat dezelfde, nu juiste functie.)
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
