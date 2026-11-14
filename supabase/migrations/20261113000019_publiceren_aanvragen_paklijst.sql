-- Opdracht 5, deel A (5): publiceren, aanpassen door VD en VC, verwijderen, aanvragen van projectgroepen en de paklijst.
--  * "definitief maken" heet in de app "publiceren" (de waarde 'definitief' blijft intern bestaan);
--  * publiceren kan ook met materialen waarvan de voorraad nog niet is ingeschat: die zijn voor groepen nog niet te kiezen;
--  * na publicatie mogen Logistiek & Facilitair van VD én VC de lijst aanpassen en materialen verwijderen (niet als een groep het gekozen heeft);
--  * projectgroepen kunnen een materiaal of extra voorraad aanvragen; de stuurgroep handelt dat af;
--  * de paklijst (meegenomen, op kamp, retour) is voor alle stuurgroepen; wat er echt is telt direct mee in de beschikbaarheid.

-- ------------------------------------------------------------------ rechten
create or replace function public.mag_materiaal_toevoegen() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mag_materiaal_beheren()
         or (public.mijn_soort() = 'stuurgroep' and public.mijn_stuurgroeprol_code() = 'logistiek_facilitair'
             and public.mijn_cluster_code() = 'VC' and public.materiaallijst_definitief())
$$;

-- Aanpassen en verwijderen: de bouwers (VD en docent) altijd, VC zodra de lijst gepubliceerd is.
create function public.mag_materiaal_aanpassen() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mag_materiaal_toevoegen()
$$;
revoke all on function public.mag_materiaal_aanpassen() from public, anon;
grant execute on function public.mag_materiaal_aanpassen() to authenticated;

drop policy materiaal_wijzigen on public.materiaal;
create policy materiaal_wijzigen on public.materiaal for update to authenticated
  using (public.mag_materiaal_aanpassen()) with check (public.mag_materiaal_aanpassen());
grant delete on public.materiaal to authenticated;
create policy materiaal_verwijderen on public.materiaal for delete to authenticated using (public.mag_materiaal_aanpassen());

-- Verwijderen komt in het logboek (naam uit de laatste wijziging). Een materiaal dat een groep heeft gekozen kan niet weg (sleutel zonder cascade).
create function public.materiaal_logboek_verwijderd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaal', old.id, 'materiaal_verwijderd', auth.uid(), old.bijgewerkt_door_naam, public.mijn_cluster(),
          jsonb_build_object('naam', old.naam, 'categorie', old.categorie));
  return old;
end $$;
revoke all on function public.materiaal_logboek_verwijderd() from public, anon, authenticated;
create trigger materiaal_logboek_verwijderd after delete on public.materiaal
  for each row execute function public.materiaal_logboek_verwijderd();

-- ------------------------------------------------- voorraad mag leeg blijven
drop trigger materiaal_voor_wijzigen on public.materiaal;
drop function public.materiaal_voor_wijzigen();
create or replace function public.materiaal_voor_toevoegen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.toegevoegd_door_cluster := public.mijn_cluster();
  return new;
end $$;

-- Publiceren kan ook als nog niet alles is ingeschat.
create or replace function public.materiaallijst_definitief_maken(p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_leeg int;
begin
  if not public.mag_materiaal_beheren() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if public.materiaallijst_definitief() then return jsonb_build_object('ok', false, 'reden', 'al_definitief'); end if;
  if not exists (select 1 from public.materiaal where actief) then return jsonb_build_object('ok', false, 'reden', 'leeg'); end if;
  select count(*) into v_leeg from public.materiaal where actief and (voorraad_camping is null or voorraad_bivak is null);
  update public.materiaallijst_status
  set status = 'definitief', definitief_op = now(), definitief_door_naam = v_naam,
      definitief_door_cluster = public.mijn_cluster(), updated_at = now()
  where id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaallijst_status', null, 'materiaallijst_definitief', auth.uid(), v_naam, public.mijn_cluster(),
          jsonb_build_object('nog_niet_ingeschat', v_leeg));
  return jsonb_build_object('ok', true, 'nog_niet_ingeschat', v_leeg);
end $$;

-- ------------------------------------------------------------------ paklijst
create table public.materiaal_telling (
  materiaal_id uuid not null references public.materiaal (id) on delete cascade,
  locatie text not null check (locatie in ('camping', 'bivak')),
  meegenomen int check (meegenomen is null or meegenomen between 0 and 99999),
  op_kamp int check (op_kamp is null or op_kamp between 0 and 99999),
  retour int check (retour is null or retour between 0 and 99999),
  opmerking text check (opmerking is null or char_length(opmerking) <= 300),
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (materiaal_id, locatie)
);
create trigger materiaal_telling_updated_at before update on public.materiaal_telling
  for each row execute function public.set_updated_at();

alter table public.materiaal_telling enable row level security;
revoke all on public.materiaal_telling from anon, authenticated;
grant select on public.materiaal_telling to authenticated;
create policy materiaal_telling_lezen on public.materiaal_telling for select to authenticated
  using (public.is_docent() or public.mijn_soort() = 'stuurgroep');

-- Wat er echt is: de laatste telling (op kamp, anders meegenomen), anders de ingeschatte voorraad.
create function public.materiaal_voorraad_nu(p_materiaal_id uuid, p_locatie text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(t.op_kamp, t.meegenomen, case p_locatie when 'camping' then m.voorraad_camping else m.voorraad_bivak end)
  from public.materiaal m
  left join public.materiaal_telling t on t.materiaal_id = m.id and t.locatie = p_locatie
  where m.id = p_materiaal_id
$$;
revoke all on function public.materiaal_voorraad_nu(uuid, text) from public, anon, authenticated;

-- Eén veld van de paklijst bijwerken; alle stuurgroepen en de docent mogen dat. Waarschuwt bij gelijktijdig wijzigen.
create function public.materiaal_telling_zetten(
  p_materiaal_id uuid, p_locatie text, p_veld text, p_waarde int, p_tekst text, p_naam text, p_verwacht timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.materiaal_telling%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_oud text; v_nieuw text;
begin
  if not (public.is_docent() or public.mijn_soort() = 'stuurgroep') then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_locatie not in ('camping', 'bivak') or p_veld not in ('meegenomen', 'op_kamp', 'retour', 'opmerking')
     or not exists (select 1 from public.materiaal where id = p_materiaal_id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_veld <> 'opmerking' and p_waarde is not null and (p_waarde < 0 or p_waarde > 99999) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  select * into t from public.materiaal_telling where materiaal_id = p_materiaal_id and locatie = p_locatie for update;
  if found then
    if t.updated_at is distinct from p_verwacht then
      return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', to_jsonb(t));
    end if;
  else
    if p_verwacht is not null then return jsonb_build_object('ok', false, 'reden', 'gewijzigd', 'huidig', null); end if;
    insert into public.materiaal_telling (materiaal_id, locatie, bijgewerkt_door_naam) values (p_materiaal_id, p_locatie, v_naam) returning * into t;
  end if;
  v_oud := case p_veld when 'meegenomen' then t.meegenomen::text when 'op_kamp' then t.op_kamp::text when 'retour' then t.retour::text else t.opmerking end;
  v_nieuw := case when p_veld = 'opmerking' then nullif(btrim(coalesce(p_tekst, '')), '') else p_waarde::text end;
  update public.materiaal_telling set
    meegenomen = case when p_veld = 'meegenomen' then p_waarde else meegenomen end,
    op_kamp = case when p_veld = 'op_kamp' then p_waarde else op_kamp end,
    retour = case when p_veld = 'retour' then p_waarde else retour end,
    opmerking = case when p_veld = 'opmerking' then left(v_nieuw, 300) else opmerking end,
    bijgewerkt_door_naam = v_naam
  where materiaal_id = p_materiaal_id and locatie = p_locatie
  returning * into t;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaal_telling', p_materiaal_id, 'telling_' || p_veld, auth.uid(), v_naam, public.mijn_cluster(),
          jsonb_build_object('locatie', p_locatie, 'van', v_oud, 'naar', v_nieuw));
  return jsonb_build_object('ok', true, 'updated_at', t.updated_at);
end $$;
revoke all on function public.materiaal_telling_zetten(uuid, text, text, int, text, text, timestamptz) from public, anon;
grant execute on function public.materiaal_telling_zetten(uuid, text, text, int, text, text, timestamptz) to authenticated;

-- ------------------------------------------------- materiaal kiezen: voorraad moet bekend zijn
create or replace function public.avf_materiaal_controle() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; m public.materiaal%rowtype;
begin
  select * into a from public.avf where id = new.avf_id;
  if a.locatie_keuze is null then
    raise exception 'Kies eerst de locatie van de belevenis (camping of bivak)' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.materiaal_id is not null then
    select * into m from public.materiaal where id = new.materiaal_id;
    if not found or not m.actief then
      raise exception 'Dit materiaal is niet beschikbaar' using errcode = '23514';
    end if;
    if public.materiaal_voorraad_nu(m.id, a.locatie_keuze) is null then
      raise exception 'De voorraad van dit materiaal volgt nog' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------- beschikbaarheid met wat er echt is
drop function public.materiaal_beschikbaar(uuid);
create function public.materiaal_beschikbaar(p_avf_id uuid)
returns table (materiaal_id uuid, voorraad int, anderen int, ingeschat boolean)
language plpgsql stable security definer set search_path = public as $$
declare a public.avf%rowtype; ra public.programma_regel%rowtype; v_test boolean;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or not public.mag_avf_lezen(p_avf_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if a.locatie_keuze is null or not (public.materiaallijst_definitief() or public.mag_materiaal_beheren()) then
    return;
  end if;
  select (c.code = 'TEST') into v_test from public.cluster c where c.id = a.cluster_id;
  select * into ra from public.programma_regel where id = a.programma_regel_id;
  return query
  select m.id,
         coalesce(public.materiaal_voorraad_nu(m.id, a.locatie_keuze), 0),
         coalesce((
           select sum(public.avf_materiaal_vraag(b.id, m.id))::int
           from public.avf b
           join public.cluster cb on cb.id = b.cluster_id
           join public.programma_regel rb on rb.id = b.programma_regel_id
           where b.id <> a.id and b.locatie_keuze = a.locatie_keuze
             and (cb.code = 'TEST') = v_test
             and ra.id is not null and rb.dag = ra.dag and rb.starttijd < ra.eindtijd and rb.eindtijd > ra.starttijd
         ), 0),
         public.materiaal_voorraad_nu(m.id, a.locatie_keuze) is not null
  from public.materiaal m;
end $$;
revoke all on function public.materiaal_beschikbaar(uuid) from public, anon;
grant execute on function public.materiaal_beschikbaar(uuid) to authenticated;

create or replace function public.materiaal_context(p_cluster_id uuid)
returns table (avf_id uuid, materiaal_id uuid, locatie text, voorraad int, anderen int)
language plpgsql stable security definer set search_path = public as $$
declare v_test boolean;
begin
  if not public.mag_programma_beheren(p_cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  select (c.code = 'TEST') into v_test from public.cluster c where c.id = p_cluster_id;
  return query
  select a.id, g.materiaal_id, a.locatie_keuze,
         coalesce(public.materiaal_voorraad_nu(g.materiaal_id, a.locatie_keuze), 0),
         coalesce((
           select sum(public.avf_materiaal_vraag(b.id, g.materiaal_id))::int
           from public.avf b
           join public.cluster cb on cb.id = b.cluster_id
           join public.programma_regel rb on rb.id = b.programma_regel_id
           where b.id <> a.id and b.locatie_keuze = a.locatie_keuze
             and (cb.code = 'TEST') = v_test
             and ra.id is not null and rb.dag = ra.dag and rb.starttijd < ra.eindtijd and rb.eindtijd > ra.starttijd
         ), 0)
  from public.avf a
  join (select distinct x.avf_id, x.materiaal_id from public.avf_materiaal x where x.materiaal_id is not null) g on g.avf_id = a.id
  join public.materiaal m on m.id = g.materiaal_id
  left join public.programma_regel ra on ra.id = a.programma_regel_id
  where a.cluster_id = p_cluster_id and a.locatie_keuze is not null;
end $$;

-- ---------------------------------------------------------------- aanvragen
create table public.materiaal_aanvraag (
  id uuid primary key default gen_random_uuid(),
  avf_id uuid not null references public.avf (id) on delete cascade,
  materiaal_id uuid references public.materiaal (id) on delete set null,
  omschrijving text check (omschrijving is null or char_length(btrim(omschrijving)) between 1 and 150),
  aantal int not null check (aantal between 1 and 9999),
  toelichting text check (toelichting is null or char_length(toelichting) <= 500),
  status text not null default 'open' check (status in ('open', 'afgehandeld', 'afgewezen')),
  door_naam text not null,
  uitkomst text check (uitkomst is null or char_length(uitkomst) <= 500),
  afgehandeld_door_naam text,
  afgehandeld_op timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materiaal_aanvraag_wat check (materiaal_id is not null or omschrijving is not null)
);
create index on public.materiaal_aanvraag (avf_id, status);
create trigger materiaal_aanvraag_updated_at before update on public.materiaal_aanvraag
  for each row execute function public.set_updated_at();

alter table public.materiaal_aanvraag enable row level security;
revoke all on public.materiaal_aanvraag from anon, authenticated;
grant select on public.materiaal_aanvraag to authenticated;
create policy materiaal_aanvraag_lezen on public.materiaal_aanvraag for select to authenticated using (public.mag_avf_lezen(avf_id));

create function public.materiaal_aanvraag_plaatsen(
  p_avf_id uuid, p_materiaal_id uuid, p_omschrijving text, p_aantal int, p_toelichting text, p_naam text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_oms text := nullif(btrim(coalesce(p_omschrijving, '')), ''); v_id uuid;
begin
  select * into a from public.avf where id = p_avf_id;
  if not found or public.mijn_soort() is distinct from 'projectgroep' or a.projectgroep_id is distinct from public.mijn_projectgroep() then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if not public.materiaallijst_definitief() then return jsonb_build_object('ok', false, 'reden', 'nog_niet_gepubliceerd'); end if;
  if p_aantal is null or p_aantal < 1 or p_aantal > 9999 or (p_materiaal_id is null and v_oms is null)
     or (p_materiaal_id is not null and not exists (select 1 from public.materiaal where id = p_materiaal_id))
     or char_length(coalesce(p_toelichting, '')) > 500 or char_length(coalesce(v_oms, '')) > 150 then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  insert into public.materiaal_aanvraag (avf_id, materiaal_id, omschrijving, aantal, toelichting, door_naam)
  values (a.id, p_materiaal_id, case when p_materiaal_id is null then v_oms end, p_aantal, nullif(btrim(coalesce(p_toelichting, '')), ''), v_naam)
  returning id into v_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'materiaal_aangevraagd', auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('aanvraag_id', v_id, 'aantal', p_aantal));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create function public.materiaal_aanvraag_afhandelen(p_id uuid, p_status text, p_uitkomst text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.materiaal_aanvraag%rowtype; a public.avf%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
        v_uit text := nullif(btrim(coalesce(p_uitkomst, '')), '');
begin
  select * into q from public.materiaal_aanvraag where id = p_id for update;
  if not found then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into a from public.avf where id = q.avf_id;
  if not public.mag_programma_beheren(a.cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_status not in ('afgehandeld', 'afgewezen') then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if q.status <> 'open' then return jsonb_build_object('ok', false, 'reden', 'al_afgehandeld'); end if;
  if p_status = 'afgewezen' and v_uit is null then return jsonb_build_object('ok', false, 'reden', 'toelichting'); end if;
  update public.materiaal_aanvraag
  set status = p_status, uitkomst = left(v_uit, 500), afgehandeld_door_naam = v_naam, afgehandeld_op = now()
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, projectgroep_id, details)
  values ('avf', a.id, 'materiaal_aanvraag_' || p_status, auth.uid(), v_naam, a.cluster_id, a.projectgroep_id,
          jsonb_build_object('aanvraag_id', p_id));
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'materiaal_aanvraag_plaatsen(uuid, uuid, text, int, text, text)',
    'materiaal_aanvraag_afhandelen(uuid, text, text, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
