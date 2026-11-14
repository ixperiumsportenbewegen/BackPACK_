-- Opdracht 5, deel B: budget. Clusterbudget, financieel plan in het AVF, aanvragen, besluiten en resterende ruimte.
--  * clusterbudget is standaard € 150 (aanpasbaar door stuurgroep en docent);
--  * het financieel plan (regels met bedragen) is een aanvraag van soort 'avf', één per AVF; extra kosten na goedkeuring via een losse aanvraag;
--  * aanvragen lopen alleen via functies; de stuurgroep van het cluster en de docent besluiten;
--  * een projectgroep ziet alleen eigen aanvragen en via budget_resterend de resterende ruimte van het cluster.

alter table public.cluster_budget alter column budget_totaal set default 150.00;
update public.cluster_budget set budget_totaal = 150.00 where budget_totaal = 250.00;

create table public.budgetaanvraag (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  projectgroep_id uuid not null references public.projectgroep (id) on delete cascade,
  avf_id uuid not null references public.avf (id) on delete cascade,
  soort text not null check (soort in ('avf', 'los')),
  omschrijving text check (omschrijving is null or char_length(btrim(omschrijving)) between 1 and 150),
  toelichting text check (toelichting is null or char_length(toelichting) <= 500),
  regels jsonb not null default '[]'::jsonb,
  bedrag_aangevraagd numeric(10, 2) not null default 0 check (bedrag_aangevraagd >= 0),
  status text not null default 'concept' check (status in ('concept', 'aangevraagd', 'toegekend', 'teruggegeven', 'afgewezen')),
  bedrag_toegekend numeric(10, 2) check (bedrag_toegekend is null or bedrag_toegekend >= 0),
  besluit_toelichting text check (besluit_toelichting is null or char_length(besluit_toelichting) <= 500),
  besluit_door_naam text,
  besluit_op timestamptz,
  besteed numeric(10, 2) check (besteed is null or besteed >= 0),
  ingediend_door_naam text,
  ingediend_op timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index budgetaanvraag_een_per_avf on public.budgetaanvraag (avf_id) where soort = 'avf';
create index on public.budgetaanvraag (cluster_id, status);
create index on public.budgetaanvraag (projectgroep_id);
create trigger budgetaanvraag_updated_at before update on public.budgetaanvraag
  for each row execute function public.set_updated_at();

-- cluster en projectgroep volgen altijd het AVF; het bedrag is altijd de som van de regels
create function public.budgetaanvraag_voor_opslaan() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_som numeric := 0; v_bedrag numeric;
begin
  if tg_op = 'INSERT' then
    select cluster_id, projectgroep_id into new.cluster_id, new.projectgroep_id from public.avf where id = new.avf_id;
  end if;
  if jsonb_typeof(new.regels) is distinct from 'array' or jsonb_array_length(new.regels) > 30 then
    raise exception 'Ongeldige regels' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(new.regels) loop
    if jsonb_typeof(r -> 'bedrag') is distinct from 'number' or public.tekst_leeg(r ->> 'omschrijving')
       or char_length(r ->> 'omschrijving') > 100 then
      raise exception 'Ongeldige regel in het financieel plan' using errcode = '22023';
    end if;
    v_bedrag := (r ->> 'bedrag')::numeric;
    if v_bedrag < 0 or v_bedrag > 99999 then
      raise exception 'Ongeldig bedrag' using errcode = '22023';
    end if;
    v_som := v_som + round(v_bedrag, 2);
  end loop;
  new.bedrag_aangevraagd := v_som;
  return new;
end $$;
create trigger budgetaanvraag_voor_opslaan before insert or update of regels on public.budgetaanvraag
  for each row execute function public.budgetaanvraag_voor_opslaan();
revoke all on function public.budgetaanvraag_voor_opslaan() from public, anon, authenticated;

-- elk AVF krijgt automatisch een (nog lege) aanvraag voor het financieel plan
create function public.budgetaanvraag_aanmaken() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.budgetaanvraag (cluster_id, projectgroep_id, avf_id, soort) values (new.cluster_id, new.projectgroep_id, new.id, 'avf');
  return null;
end $$;
create trigger budgetaanvraag_aanmaken after insert on public.avf
  for each row execute function public.budgetaanvraag_aanmaken();
revoke all on function public.budgetaanvraag_aanmaken() from public, anon, authenticated;
insert into public.budgetaanvraag (cluster_id, projectgroep_id, avf_id, soort)
select a.cluster_id, a.projectgroep_id, a.id, 'avf' from public.avf a
where not exists (select 1 from public.budgetaanvraag b where b.avf_id = a.id and b.soort = 'avf');

-- --------------------------------------------------------------- afscherming
alter table public.budgetaanvraag enable row level security;
revoke all on public.budgetaanvraag from anon, authenticated;
grant select on public.budgetaanvraag to authenticated;
create policy budgetaanvraag_lezen on public.budgetaanvraag for select to authenticated
  using (public.is_docent()
         or (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster())
         or (public.mijn_soort() = 'projectgroep' and projectgroep_id = public.mijn_projectgroep()));

-- Resterende ruimte van het cluster: budget min wat is toegekend. Projectgroepen zien alleen dit bedrag.
create or replace function public.budget_resterend(p_cluster_id uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric; t numeric;
begin
  if not (public.is_docent() or p_cluster_id = public.mijn_cluster()) then
    raise exception 'Geen toegang tot dit cluster' using errcode = '42501';
  end if;
  select budget_totaal into v from public.cluster_budget where cluster_id = p_cluster_id;
  select coalesce(sum(bedrag_toegekend), 0) into t from public.budgetaanvraag where cluster_id = p_cluster_id and status = 'toegekend';
  return coalesce(v, 0) - t;
end $$;

-- ----------------------------------------------------------------- functies
-- Het financieel plan (of een losse aanvraag) opslaan. Zolang het AVF niet is goedgekeurd of na "teruggegeven".
create function public.budget_regels_opslaan(
  p_id uuid, p_regels jsonb, p_omschrijving text, p_toelichting text, p_naam text, p_verwacht timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.budgetaanvraag%rowtype; a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into q from public.budgetaanvraag where id = p_id for update;
  if not found or not (public.is_docent() or (public.mijn_soort() = 'projectgroep' and q.projectgroep_id = public.mijn_projectgroep())) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if q.status not in ('concept', 'teruggegeven') then return jsonb_build_object('ok', false, 'reden', 'vergrendeld'); end if;
  select * into a from public.avf where id = q.avf_id;
  if q.soort = 'avf' and a.status = 'goedgekeurd' and q.status <> 'teruggegeven' then
    return jsonb_build_object('ok', false, 'reden', 'vast');
  end if;
  if q.updated_at is distinct from p_verwacht then
    return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', to_jsonb(q));
  end if;
  begin
    update public.budgetaanvraag
    set regels = coalesce(p_regels, '[]'::jsonb),
        omschrijving = case when q.soort = 'los' then nullif(btrim(coalesce(p_omschrijving, '')), '') else omschrijving end,
        toelichting = nullif(btrim(coalesce(p_toelichting, '')), '')
    where id = p_id
    returning * into q;
  exception when sqlstate '22023' then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end;
  return jsonb_build_object('ok', true, 'updated_at', q.updated_at, 'bedrag', q.bedrag_aangevraagd);
end $$;

-- Een losse aanvraag starten: alleen als het AVF is goedgekeurd.
create function public.budget_losse_aanvraag_maken(p_avf_id uuid, p_omschrijving text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_oms text := nullif(btrim(coalesce(p_omschrijving, '')), ''); v_id uuid;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or public.mijn_soort() is distinct from 'projectgroep' or a.projectgroep_id is distinct from public.mijn_projectgroep() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if a.status <> 'goedgekeurd' then return jsonb_build_object('ok', false, 'reden', 'avf_niet_goedgekeurd'); end if;
  if v_oms is null or char_length(v_oms) > 150 then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  insert into public.budgetaanvraag (avf_id, soort, omschrijving) values (a.id, 'los', v_oms) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Een aanvraag indienen: een losse aanvraag (AVF goedgekeurd) of het financieel plan opnieuw na "teruggegeven".
-- De eerste keer gaat het plan mee met avf_indienen.
create function public.budget_aanvraag_indienen(p_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.budgetaanvraag%rowtype; a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into q from public.budgetaanvraag where id = p_id for update;
  if not found or public.mijn_soort() is distinct from 'projectgroep' or q.projectgroep_id is distinct from public.mijn_projectgroep() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  select * into a from public.avf where id = q.avf_id;
  if q.soort = 'los' then
    if q.status not in ('concept', 'teruggegeven') then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
    if a.status <> 'goedgekeurd' then return jsonb_build_object('ok', false, 'reden', 'avf_niet_goedgekeurd'); end if;
    if q.omschrijving is null then return jsonb_build_object('ok', false, 'reden', 'omschrijving'); end if;
  else
    if q.status <> 'teruggegeven' then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  end if;
  if q.bedrag_aangevraagd <= 0 then return jsonb_build_object('ok', false, 'reden', 'leeg'); end if;
  update public.budgetaanvraag
  set status = 'aangevraagd', ingediend_door_naam = v_naam, ingediend_op = now(), besluit_toelichting = null
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('budgetaanvraag', q.id, 'budget_aangevraagd', auth.uid(), v_naam, q.cluster_id, q.projectgroep_id,
          jsonb_build_object('soort', q.soort, 'bedrag', q.bedrag_aangevraagd));
  return jsonb_build_object('ok', true);
end $$;

-- Besluit van de stuurgroep van het cluster (of de docent): toekennen (ook een lager bedrag), teruggeven of afwijzen.
-- Een bedrag boven de resterende ruimte mag; de functie meldt dat alleen terug.
create function public.budget_besluit(p_id uuid, p_besluit text, p_bedrag numeric, p_toelichting text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.budgetaanvraag%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
        v_toel text := nullif(btrim(coalesce(p_toelichting, '')), ''); v_bedrag numeric; v_rest numeric; v_boven boolean := false;
begin
  select * into q from public.budgetaanvraag where id = p_id for update;
  if not found or not public.mag_programma_beheren(q.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_besluit not in ('toegekend', 'teruggegeven', 'afgewezen') then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if q.status <> 'aangevraagd' then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  if p_besluit = 'toegekend' then
    v_bedrag := round(coalesce(p_bedrag, q.bedrag_aangevraagd), 2);
    if v_bedrag <= 0 or v_bedrag > q.bedrag_aangevraagd then return jsonb_build_object('ok', false, 'reden', 'bedrag'); end if;
    if v_bedrag < q.bedrag_aangevraagd and v_toel is null then return jsonb_build_object('ok', false, 'reden', 'toelichting'); end if;
    v_rest := public.budget_resterend(q.cluster_id);
    v_boven := v_bedrag > v_rest;
  elsif v_toel is null then
    return jsonb_build_object('ok', false, 'reden', 'toelichting');
  end if;
  update public.budgetaanvraag
  set status = p_besluit, bedrag_toegekend = case when p_besluit = 'toegekend' then v_bedrag end,
      besluit_toelichting = left(v_toel, 500), besluit_door_naam = v_naam, besluit_op = now()
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('budgetaanvraag', q.id, 'budget_' || p_besluit, auth.uid(), v_naam, q.cluster_id, q.projectgroep_id,
          jsonb_build_object('soort', q.soort, 'aangevraagd', q.bedrag_aangevraagd, 'toegekend', v_bedrag));
  return jsonb_build_object('ok', true, 'boven_resterend', v_boven);
end $$;

-- Het werkelijk bestede bedrag (handmatig, na de aankoop). De app claimt nooit dat iets is betaald.
create function public.budget_besteed_zetten(p_id uuid, p_bedrag numeric, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.budgetaanvraag%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  select * into q from public.budgetaanvraag where id = p_id for update;
  if not found or not public.mag_programma_beheren(q.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if q.status <> 'toegekend' then return jsonb_build_object('ok', false, 'reden', 'status'); end if;
  if p_bedrag is not null and (p_bedrag < 0 or p_bedrag > 99999) then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  update public.budgetaanvraag set besteed = case when p_bedrag is null then null else round(p_bedrag, 2) end where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('budgetaanvraag', q.id, 'budget_besteed', auth.uid(), v_naam, q.cluster_id, q.projectgroep_id, jsonb_build_object('besteed', p_bedrag));
  return jsonb_build_object('ok', true);
end $$;

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

  -- het financieel plan wordt een aanvraag (als er bedragen in staan)
  update public.budgetaanvraag
  set status = 'aangevraagd', ingediend_door_naam = v_naam, ingediend_op = now(), besluit_toelichting = null
  where avf_id = a.id and soort = 'avf' and status in ('concept', 'teruggegeven') and bedrag_aangevraagd > 0;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'avf_ingediend', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('versie', v_versie, 'open_verzoeken', jsonb_array_length(v_open)));
  return jsonb_build_object('ok', true, 'versie', v_versie);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'budget_regels_opslaan(uuid, jsonb, text, text, text, timestamptz)', 'budget_losse_aanvraag_maken(uuid, text, text)',
    'budget_aanvraag_indienen(uuid, text)', 'budget_besluit(uuid, text, numeric, text, text)', 'budget_besteed_zetten(uuid, numeric, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
