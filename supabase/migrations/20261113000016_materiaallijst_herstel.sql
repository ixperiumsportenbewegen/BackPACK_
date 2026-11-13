-- Herstel van migratie 15: Supabase eist een WHERE bij elke UPDATE (ook op de tabel met één rij).
create or replace function public.materiaallijst_definitief_maken(p_naam text) returns jsonb
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

create or replace function public.materiaallijst_terugzetten(p_naam text) returns jsonb
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
