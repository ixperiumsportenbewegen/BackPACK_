-- Tussentijds indienen ter feedback.
-- Een projectgroep mag het AVF indienen terwijl nog niet alles is ingevuld, om feedback van de stuurgroep te krijgen.
-- De stuurgroep plaatst verbeterverzoeken en geeft het AVF terug (status "aanpassing_gevraagd"); daarna werkt de groep
-- verder. Dat kan zo vaak als nodig. Goedkeuren kan pas na een definitieve indiening (alle verplichte velden ingevuld).
--
-- Alleen toevoegend: twee nieuwe kolommen met standaardwaarde false en een nieuwe functie. De bestaande functies
-- avf_indienen, avf_aanpassing_vragen en avf_goedkeuren krijgen een kleine aanvulling en houden dezelfde handtekening.
--   * avf.tussentijds: de laatste indiening was ter feedback (status blijft "ingediend" tot de stuurgroep reageert);
--   * avf_versie.tussentijds: de versie was een indiening ter feedback;
--   * avf_ter_feedback_indienen(): indienen zonder controle op verplichte velden, zonder financieel plan door te zetten;
--   * avf_aanpassing_vragen(): bij een indiening ter feedback mag de stuurgroep teruggeven zonder verbeterverzoek;
--   * avf_goedkeuren(): geweigerd zolang de laatste indiening ter feedback was.

alter table public.avf add column tussentijds boolean not null default false;
alter table public.avf_versie add column tussentijds boolean not null default false;

-- ------------------------------------------------------- indienen ter feedback
create function public.avf_ter_feedback_indienen(
  p_avf_id uuid, p_naam text, p_samenvatting text, p_open_bevestigd boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.avf%rowtype;
  v_versie int;
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
  -- bij elke indiening ter feedback hoort een korte toelichting: wat is er ingevuld of aangepast, waar willen jullie feedback op?
  if v_samen is null then return jsonb_build_object('ok', false, 'reden', 'samenvatting'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'sectie', sectie, 'tekst', tekst) order by created_at), '[]'::jsonb)
  into v_open from public.verbeterverzoek where avf_id = a.id and status = 'open';
  if jsonb_array_length(v_open) > 0 and not coalesce(p_open_bevestigd, false) then
    return jsonb_build_object('ok', false, 'reden', 'open_verzoeken', 'verzoeken', v_open);
  end if;

  v_versie := a.versie + 1;
  insert into public.avf_versie (avf_id, versie, inhoud, ingediend_door_naam, wijzigingssamenvatting, tussentijds)
  values (a.id, v_versie, jsonb_build_object(
    'avf', to_jsonb(a) - 'sectie_bijgewerkt',
    'fasen', coalesce((select jsonb_agg(to_jsonb(f) order by f.fase) from public.avf_fase f where f.avf_id = a.id), '[]'::jsonb),
    'onderdelen', coalesce((select jsonb_agg(to_jsonb(o) order by o.fase, o.volgorde) from public.avf_onderdeel o where o.avf_id = a.id), '[]'::jsonb),
    'rolverdeling', coalesce((select jsonb_agg(jsonb_build_object('rol', r.rol, 'namen', r.namen)) from public.projectgroep_rol r where r.projectgroep_id = a.projectgroep_id), '[]'::jsonb)
  ), v_naam, left(v_samen, 1000), true);

  -- het financieel plan gaat NIET mee: dat wordt pas een aanvraag bij de definitieve indiening
  update public.avf
  set status = 'ingediend', versie = v_versie, ingediend_op = now(), ingediend_door_naam = v_naam,
      opnieuw_te_controleren = false, tussentijds = true
  where id = a.id;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'avf_ter_feedback_ingediend', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('versie', v_versie, 'open_verzoeken', jsonb_array_length(v_open)));
  return jsonb_build_object('ok', true, 'versie', v_versie);
end $$;

revoke all on function public.avf_ter_feedback_indienen(uuid, text, text, boolean) from public, anon;
grant execute on function public.avf_ter_feedback_indienen(uuid, text, text, boolean) to authenticated;

-- ------------------------------------------- definitief indienen: niet meer ter feedback
create or replace function public.avf_indienen(
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

  insert into public.avf_versie (avf_id, versie, inhoud, ingediend_door_naam, wijzigingssamenvatting, tussentijds)
  values (a.id, v_versie, jsonb_build_object(
    'avf', to_jsonb(a) - 'sectie_bijgewerkt',
    'fasen', coalesce((select jsonb_agg(to_jsonb(f) order by f.fase) from public.avf_fase f where f.avf_id = a.id), '[]'::jsonb),
    'onderdelen', coalesce((select jsonb_agg(to_jsonb(o) order by o.fase, o.volgorde) from public.avf_onderdeel o where o.avf_id = a.id), '[]'::jsonb),
    'rolverdeling', coalesce((select jsonb_agg(jsonb_build_object('rol', r.rol, 'namen', r.namen)) from public.projectgroep_rol r where r.projectgroep_id = a.projectgroep_id), '[]'::jsonb)
  ), v_naam, case when v_versie >= 2 then left(v_samen, 1000) else null end, false);

  update public.avf
  set status = 'ingediend', versie = v_versie, ingediend_op = now(), ingediend_door_naam = v_naam,
      opnieuw_te_controleren = false, tussentijds = false
  where id = a.id;

  -- het financieel plan wordt een aanvraag (als er bedragen in staan)
  update public.budgetaanvraag
  set status = 'aangevraagd', ingediend_door_naam = v_naam, ingediend_op = now(), besluit_toelichting = null
  where avf_id = a.id and soort = 'avf' and status in ('concept', 'teruggegeven') and bedrag_aangevraagd > 0;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'avf_ingediend', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('versie', v_versie, 'open_verzoeken', jsonb_array_length(v_open)));
  return jsonb_build_object('ok', true, 'versie', v_versie);
end $$;

-- ------------------------------------------------ teruggeven zonder verbeterverzoek
create or replace function public.avf_aanpassing_vragen(p_avf_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into a from public.avf where id = p_avf_id for update;
  if not found or not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if a.status not in ('ingediend', 'goedgekeurd') then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  -- bij een definitieve indiening moet er minstens één verbeterverzoek zijn; bij een indiening ter feedback mag de
  -- stuurgroep ook zonder verzoek teruggeven ("ziet er goed uit, ga zo door")
  if not (a.status = 'ingediend' and a.tussentijds)
     and not exists (select 1 from public.verbeterverzoek where avf_id = a.id and status = 'open') then
    return jsonb_build_object('ok', false, 'reden', 'geen_open_verzoek');
  end if;
  update public.avf set status = 'aanpassing_gevraagd', opnieuw_te_controleren = false where id = a.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'aanpassing_gevraagd', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('ter_feedback', a.status = 'ingediend' and a.tussentijds));
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------ goedkeuren pas na definitief indienen
create or replace function public.avf_goedkeuren(p_avf_id uuid, p_naam text, p_open_bevestigd boolean default false) returns jsonb
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
  if a.status = 'ingediend' and a.tussentijds then
    return jsonb_build_object('ok', false, 'reden', 'tussentijds');
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
