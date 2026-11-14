-- Herstel van migratie 21: de controle op spaties in de link moest het patroon \s gebruiken.
create or replace function public.cluster_forms_link_zetten(p_cluster_id uuid, p_link text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if not (public.is_docent()
          or (public.mijn_soort() = 'stuurgroep' and public.mijn_stuurgroeprol_code() = 'communicatie_financien' and p_cluster_id = public.mijn_cluster())) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if v_link is not null and (v_link !~ '^https://' or char_length(v_link) > 1000 or position(' ' in v_link) > 0) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  update public.cluster set forms_link = v_link where id = p_cluster_id;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_cluster_id, 'forms_link_gewijzigd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('ingesteld', v_link is not null));
  return jsonb_build_object('ok', true);
end $$;
