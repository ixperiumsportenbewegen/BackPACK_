-- Groepsnummers bij een programmaregel moeten altijd tussen 1 en 6 liggen, ook bij een vaste activiteit
-- (waar ze niet worden gebruikt). Zo wordt een ongeldige aanroep nooit stilletjes uitgevoerd.
create or replace function public.programma_regel_wijzigen(
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
  if p_eind <= p_start or nullif(btrim(coalesce(p_titel, '')), '') is null
     or not (coalesce(p_deelnemers, '{}') <@ array[1, 2, 3, 4, 5, 6])
     or not (coalesce(p_rocks_rivers, '{}') <@ array[1, 2, 3, 4, 5, 6]) then
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
