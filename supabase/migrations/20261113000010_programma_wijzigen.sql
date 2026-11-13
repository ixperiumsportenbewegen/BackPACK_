-- Programma beheren: tijden schuiven mee, activiteiten toevoegen en verwijderen, belevenisvakken blijven vast.
--
-- Regels:
--  * Verandert de eindtijd van een activiteit, dan schuiven de volgende activiteiten van dezelfde dag mee, zolang ze
--    aansluiten (elke activiteit begint waar de vorige eindigde). Bij een gat in het programma stopt het meeschuiven.
--    De duur van elke activiteit blijft gelijk.
--  * Tijden die zijn aangepast krijgen een uitroepteken: de oorspronkelijke tijden blijven bewaard totdat de stuurgroep
--    de wijziging bevestigt of de tijden weer gelijk zijn aan het begin.
--  * Alleen vaste activiteiten kunnen worden toegevoegd en verwijderd. De zes belevenisvakken (soort `belevenis`) kunnen
--    in tijd worden aangepast, maar nooit worden verwijderd of van soort veranderen: de database dwingt dat af.

alter table public.programma_regel
  add column oorspronkelijke_starttijd time,
  add column oorspronkelijke_eindtijd time;

-- Volgnummers mogen tijdelijk door elkaar staan binnen één opdracht (nodig bij invoegen tussen twee activiteiten).
alter table public.programma_regel drop constraint programma_regel_cluster_id_volgorde_key;
alter table public.programma_regel
  add constraint programma_regel_cluster_id_volgorde_key unique (cluster_id, volgorde) deferrable initially deferred;

-- Het opschuiven van volgnummers telt niet als wijziging (anders krijgt iemand die een andere regel bewerkt een onterechte waarschuwing).
drop trigger programma_regel_updated_at on public.programma_regel;
create function public.programma_regel_updated_at() returns trigger
language plpgsql as $$
begin
  if current_setting('app.volgorde_verschuiven', true) = '1' then
    return new;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger programma_regel_updated_at before update on public.programma_regel
  for each row execute function public.programma_regel_updated_at();

-- Belevenisvakken zijn vast: soort verandert niet en verwijderen kan niet (behalve als het hele cluster verdwijnt).
create function public.programma_regel_bewaken() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.soort is distinct from old.soort then
      raise exception 'De soort van een programmaregel kan niet worden gewijzigd' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.soort = 'belevenis' and exists (select 1 from public.cluster where id = old.cluster_id) then
    raise exception 'Een belevenisvak kan niet worden verwijderd' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger programma_regel_bewaken_wijzigen before update on public.programma_regel
  for each row execute function public.programma_regel_bewaken();
create trigger programma_regel_bewaken_verwijderen before delete on public.programma_regel
  for each row execute function public.programma_regel_bewaken();

-- ------------------------------------------------------------ hulpfuncties
create function public.tijd_naar_minuten(t time) returns int
language sql immutable as $$
  select (extract(hour from t) * 60 + extract(minute from t))::int
$$;

create function public.minuten_naar_tijd(m int) returns time
language sql immutable as $$
  select time '00:00' + (m * interval '1 minute')
$$;

-- Schuift de aansluitende activiteiten na een bepaalde volgorde op (of terug) en geeft het aantal verschoven regels.
create function public.programma_schuiven(
  p_cluster_id uuid, p_dag date, p_na_volgorde int, p_oud_eind time, p_delta_min int
) returns int
language plpgsql security definer set search_path = public as $$
declare f record; v_vorige_eind time := p_oud_eind; v_n int := 0; v_ns int; v_ne int;
begin
  if p_delta_min = 0 then
    return 0;
  end if;
  for f in
    select * from public.programma_regel
    where cluster_id = p_cluster_id and dag = p_dag and volgorde > p_na_volgorde
    order by volgorde
  loop
    exit when f.starttijd <> v_vorige_eind; -- een gat in het programma: hier stopt het meeschuiven
    v_ns := public.tijd_naar_minuten(f.starttijd) + p_delta_min;
    v_ne := public.tijd_naar_minuten(f.eindtijd) + p_delta_min;
    if v_ns < 0 or v_ne > 1439 then
      raise exception 'Het meeschuiven past niet meer binnen de dag' using errcode = 'P0001';
    end if;
    v_vorige_eind := f.eindtijd;
    update public.programma_regel
    set starttijd = public.minuten_naar_tijd(v_ns),
        eindtijd = public.minuten_naar_tijd(v_ne),
        oorspronkelijke_starttijd = coalesce(oorspronkelijke_starttijd, f.starttijd),
        oorspronkelijke_eindtijd = coalesce(oorspronkelijke_eindtijd, f.eindtijd)
    where id = f.id;
    v_n := v_n + 1;
  end loop;
  -- weer gelijk aan het begin: geen uitroepteken meer
  update public.programma_regel
  set oorspronkelijke_starttijd = null, oorspronkelijke_eindtijd = null
  where cluster_id = p_cluster_id and dag = p_dag
    and oorspronkelijke_starttijd = starttijd and oorspronkelijke_eindtijd = eindtijd;
  return v_n;
end $$;

-- ------------------------------------------------------ wijzigen (vervangt de vorige versie)
drop function public.programma_regel_wijzigen(uuid, text, text, text, date, time, time, int[], int[], timestamptz, text);

create function public.programma_regel_wijzigen(
  p_id uuid, p_titel text, p_omschrijving text, p_locatie text,
  p_dag date, p_start time, p_eind time,
  p_deelnemers int[], p_rocks_rivers int[],
  p_verwacht timestamptz, p_naam text,
  p_schuif boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.programma_regel%rowtype;
  v_oud_start time; v_oud_eind time; v_oud_dag date;
  v_orig_start time; v_orig_eind time; v_n int := 0;
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

  v_oud_start := r.starttijd; v_oud_eind := r.eindtijd; v_oud_dag := r.dag;
  v_orig_start := r.oorspronkelijke_starttijd; v_orig_eind := r.oorspronkelijke_eindtijd;
  if p_start is distinct from v_oud_start or p_eind is distinct from v_oud_eind then
    v_orig_start := coalesce(v_orig_start, v_oud_start);
    v_orig_eind := coalesce(v_orig_eind, v_oud_eind);
  end if;
  if v_orig_start = p_start and v_orig_eind = p_eind and p_dag = v_oud_dag then
    v_orig_start := null; v_orig_eind := null;
  end if;

  begin
    update public.programma_regel
    set titel = btrim(p_titel),
        omschrijving = nullif(btrim(coalesce(p_omschrijving, '')), ''),
        locatie = nullif(btrim(coalesce(p_locatie, '')), ''),
        dag = p_dag, starttijd = p_start, eindtijd = p_eind,
        deelnemers = case when r.soort = 'belevenis' then coalesce(p_deelnemers, '{}') else '{}' end,
        rocks_rivers_groepen = case when r.soort = 'belevenis' then coalesce(p_rocks_rivers, '{}') else '{}' end,
        oorspronkelijke_starttijd = v_orig_start, oorspronkelijke_eindtijd = v_orig_eind,
        bijgewerkt_door_naam = left(p_naam, 60)
    where id = p_id
    returning * into r;

    if p_schuif and p_dag = v_oud_dag and p_eind is distinct from v_oud_eind then
      v_n := public.programma_schuiven(r.cluster_id, r.dag, r.volgorde, v_oud_eind,
                                       public.tijd_naar_minuten(p_eind) - public.tijd_naar_minuten(v_oud_eind));
    end if;
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'reden', 'past_niet');
  end;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('programma_regel', r.id, 'programma_gewijzigd', auth.uid(), left(p_naam, 60), r.cluster_id,
          jsonb_build_object('titel', r.titel, 'dag', r.dag, 'start', r.starttijd, 'eind', r.eindtijd, 'meegeschoven', v_n));
  select updated_at into r.updated_at from public.programma_regel where id = r.id;
  return jsonb_build_object('ok', true, 'updated_at', r.updated_at, 'verschoven', v_n);
end $$;

-- ------------------------------------------------------------ toevoegen
create function public.programma_regel_toevoegen(
  p_na_regel_id uuid, p_titel text, p_omschrijving text, p_locatie text,
  p_start time, p_eind time, p_schuif boolean, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare na public.programma_regel%rowtype; v_id uuid; v_n int := 0;
begin
  select * into na from public.programma_regel where id = p_na_regel_id for update;
  if not found or not public.mag_programma_beheren(na.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  if p_eind <= p_start or nullif(btrim(coalesce(p_titel, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;

  begin
    -- ruimte maken in de volgorde, zonder dat dit als wijziging telt
    perform set_config('app.volgorde_verschuiven', '1', true);
    update public.programma_regel set volgorde = volgorde + 1
    where cluster_id = na.cluster_id and volgorde > na.volgorde;
    perform set_config('app.volgorde_verschuiven', '0', true);

    insert into public.programma_regel (cluster_id, volgorde, dag, starttijd, eindtijd, soort, titel, omschrijving, locatie, bijgewerkt_door_naam)
    values (na.cluster_id, na.volgorde + 1, na.dag, p_start, p_eind, 'vast', btrim(p_titel),
            nullif(btrim(coalesce(p_omschrijving, '')), ''), nullif(btrim(coalesce(p_locatie, '')), ''), left(p_naam, 60))
    returning id into v_id;

    if p_schuif then
      v_n := public.programma_schuiven(na.cluster_id, na.dag, na.volgorde + 1, na.eindtijd,
                                       public.tijd_naar_minuten(p_eind) - public.tijd_naar_minuten(na.eindtijd));
    end if;
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'reden', 'past_niet');
  end;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('programma_regel', v_id, 'programma_toegevoegd', auth.uid(), left(p_naam, 60), na.cluster_id,
          jsonb_build_object('titel', btrim(p_titel), 'dag', na.dag, 'start', p_start, 'eind', p_eind, 'meegeschoven', v_n));
  return jsonb_build_object('ok', true, 'id', v_id, 'verschoven', v_n);
end $$;

-- ------------------------------------------------------------ verwijderen (alleen vaste activiteiten)
create function public.programma_regel_verwijderen(p_id uuid, p_schuif boolean, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.programma_regel%rowtype; v_n int := 0;
begin
  select * into r from public.programma_regel where id = p_id for update;
  if not found or not public.mag_programma_beheren(r.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  if r.soort <> 'vast' then
    return jsonb_build_object('ok', false, 'reden', 'vast_vak');
  end if;

  begin
    delete from public.programma_regel where id = p_id;
    if p_schuif then
      v_n := public.programma_schuiven(r.cluster_id, r.dag, r.volgorde, r.eindtijd,
                                       -(public.tijd_naar_minuten(r.eindtijd) - public.tijd_naar_minuten(r.starttijd)));
    end if;
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'reden', 'past_niet');
  end;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('programma_regel', r.id, 'programma_verwijderd', auth.uid(), left(p_naam, 60), r.cluster_id,
          jsonb_build_object('titel', r.titel, 'dag', r.dag, 'start', r.starttijd, 'eind', r.eindtijd, 'meegeschoven', v_n));
  return jsonb_build_object('ok', true, 'verschoven', v_n);
end $$;

-- ------------------------------------------------------------ wijzigingen bevestigen (uitroeptekens weghalen)
create function public.programma_wijzigingen_bevestigen(p_cluster_id uuid, p_regel_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.mag_programma_beheren(p_cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_naam, '')), '') is null then
    return jsonb_build_object('ok', false, 'reden', 'naam');
  end if;
  update public.programma_regel
  set oorspronkelijke_starttijd = null, oorspronkelijke_eindtijd = null
  where cluster_id = p_cluster_id and (p_regel_id is null or id = p_regel_id)
    and oorspronkelijke_starttijd is not null;
  get diagnostics v_n = row_count;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('programma_regel', p_regel_id, 'programma_bevestigd', auth.uid(), left(p_naam, 60), p_cluster_id,
          jsonb_build_object('aantal', v_n));
  return jsonb_build_object('ok', true, 'aantal', v_n);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'programma_regel_wijzigen(uuid, text, text, text, date, time, time, int[], int[], timestamptz, text, boolean)',
    'programma_regel_toevoegen(uuid, text, text, text, time, time, boolean, text)',
    'programma_regel_verwijderen(uuid, boolean, text)',
    'programma_wijzigingen_bevestigen(uuid, uuid, text)',
    'programma_schuiven(uuid, date, int, time, int)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'programma_regel_wijzigen(uuid, text, text, text, date, time, time, int[], int[], timestamptz, text, boolean)',
    'programma_regel_toevoegen(uuid, text, text, text, time, time, boolean, text)',
    'programma_regel_verwijderen(uuid, boolean, text)',
    'programma_wijzigingen_bevestigen(uuid, uuid, text)']
  loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
