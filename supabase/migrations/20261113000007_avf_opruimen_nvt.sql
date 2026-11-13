-- Opdracht 3: twee kleine functies voor sectie D.
--  * avf_fase_opruimen_opslaan: één W-veld van "opruimen" bijwerken zonder de andere velden te overschrijven;
--  * avf_onderdeel_nvt_zetten: een veld van een onderdeel als "niet van toepassing" markeren of weer vrijgeven.

create function public.avf_fase_opruimen_opslaan(
  p_avf_id uuid, p_fase public.fase, p_sleutel text, p_oud text, p_nieuw text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_opr jsonb; v_huidig text; v_n int;
begin
  if p_sleutel not in ('wie', 'wat', 'waar', 'wanneer', 'hoe', 'wat_erna') then
    raise exception 'Onbekend veld' using errcode = '22023';
  end if;
  select opruimen into v_opr from public.avf_fase where avf_id = p_avf_id and fase = p_fase for update;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  v_huidig := v_opr ->> p_sleutel;
  if v_huidig is distinct from p_oud then
    return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', to_jsonb(v_huidig));
  end if;
  update public.avf_fase
  set opruimen = jsonb_set(coalesce(v_opr, '{}'::jsonb), array[p_sleutel], coalesce(to_jsonb(p_nieuw), 'null'::jsonb), true)
  where avf_id = p_avf_id and fase = p_fase;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reden', 'geen_toegang');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.avf_onderdeel_nvt_zetten(p_onderdeel_id uuid, p_veld text, p_aan boolean) returns boolean
language plpgsql security invoker set search_path = public as $$
declare v_n int;
begin
  if p_veld not in ('sociale_veiligheid', 'individu_moeilijker', 'individu_makkelijker', 'groep_moeilijker',
                    'groep_makkelijker', 'usv_uitdagend', 'usv_speelbaar', 'usv_veilig_aanvulling') then
    raise exception 'Dit veld kan niet als niet van toepassing worden gemarkeerd' using errcode = '22023';
  end if;
  update public.avf_onderdeel
  set niet_van_toepassing = case
    when p_aan then array(select distinct unnest(niet_van_toepassing || p_veld))
    else array_remove(niet_van_toepassing, p_veld)
  end
  where id = p_onderdeel_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'avf_fase_opruimen_opslaan(uuid, public.fase, text, text, text)',
    'avf_onderdeel_nvt_zetten(uuid, text, boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
