-- De 10 bergtoppen van de Ardennen: de gedragsafspraken van de meerdaagse, gemaakt door de stuurgroep (Veiligheid & Welzijn voorop).
--   * Precies 10 toppen, elk met een titel en een afspraak, plus onderaan één tekstblok met een toelichting (bijvoorbeeld over "het dal").
--   * Het concept (bergtop_veld) is alleen te lezen en te bewerken door de stuurgroep van het cluster en de docent.
--   * Pas bij "Publiceren" (een bewuste knop, alleen als alles is ingevuld) wordt het concept gekopieerd naar een gepubliceerde versie
--     (bergtop_publicatie, met versienummer); alleen die versie is zichtbaar voor iedereen in het cluster. Opnieuw publiceren
--     maakt een nieuwe versie; intrekken maakt de versie weer onzichtbaar voor iedereen buiten de stuurgroep en de docent.
--   * Ondertekenen gebeurt buiten de app, in het inschrijfformulier: cluster.inschrijf_link is de link ernaartoe. De app slaat geen
--     handtekeningen of namen van studenten op.
--   * De docent kan het concept van het ene cluster naar het andere kopiëren (de gepubliceerde versie blijft ongemoeid).
-- Alleen toevoegend: nieuwe tabellen, een nieuwe kolom en nieuwe functies.

alter table public.cluster add column inschrijf_link text;
alter table public.cluster add constraint cluster_inschrijf_link_https check (
  inschrijf_link is null or (inschrijf_link ~ '^https://' and char_length(inschrijf_link) <= 1000 and position(' ' in inschrijf_link) = 0)
);

create table public.bergtop_veld (
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  sleutel text not null check (sleutel ~ '^(top_([1-9]|10)_(titel|afspraak)|toelichting_titel|toelichting)$'),
  tekst text check (tekst is null or char_length(tekst) <= 3000),
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cluster_id, sleutel)
);

create table public.bergtop_publicatie (
  cluster_id uuid primary key references public.cluster (id) on delete cascade,
  versie int not null check (versie >= 1),
  inhoud jsonb not null,
  zichtbaar boolean not null default true,
  gepubliceerd_op timestamptz not null default now(),
  gepubliceerd_door_naam text not null
);

create trigger bergtop_veld_updated_at before update on public.bergtop_veld
  for each row execute function public.set_updated_at();

alter table public.bergtop_veld enable row level security;
alter table public.bergtop_publicatie enable row level security;
revoke all on public.bergtop_veld, public.bergtop_publicatie from anon, authenticated;
grant select on public.bergtop_veld, public.bergtop_publicatie to authenticated;

-- Het concept: alleen de stuurgroep van het cluster en de docent.
create policy bergtop_veld_lezen on public.bergtop_veld for select to authenticated
  using (public.is_docent() or (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster()));

-- De gepubliceerde versie: iedereen in het cluster zolang hij zichtbaar is; de stuurgroep en de docent altijd.
create policy bergtop_publicatie_lezen on public.bergtop_publicatie for select to authenticated
  using (
    public.is_docent()
    or (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster())
    or (zichtbaar and cluster_id = public.mijn_cluster())
  );

-- ---------------------------------------------------------------- functies
create function public.bergtop_mag_schrijven(p_cluster_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_docent() or (public.mijn_soort() = 'stuurgroep' and p_cluster_id = public.mijn_cluster())
$$;
revoke all on function public.bergtop_mag_schrijven(uuid) from public, anon;

-- Eén veld van het concept opslaan, alleen als het nog de waarde heeft die de gebruiker zag (anders een conflict). Leeg wist het veld.
create function public.bergtop_veld_opslaan(p_cluster_id uuid, p_sleutel text, p_oud text, p_nieuw text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_oud text := nullif(btrim(coalesce(p_oud, '')), '');
  v_nieuw text := nullif(btrim(coalesce(p_nieuw, '')), '');
  v_huidig text;
  v_max int;
begin
  if not public.bergtop_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_sleutel is null or p_sleutel !~ '^(top_([1-9]|10)_(titel|afspraak)|toelichting_titel|toelichting)$'
     or not exists (select 1 from public.cluster where id = p_cluster_id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_sleutel = 'toelichting' then v_max := 3000;
  elsif p_sleutel like '%afspraak' then v_max := 300;
  else v_max := 80;
  end if;
  if char_length(coalesce(v_nieuw, '')) > v_max then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cluster_id::text || ':bergtop:' || p_sleutel, 0));
  select nullif(btrim(coalesce(tekst, '')), '') into v_huidig from public.bergtop_veld where cluster_id = p_cluster_id and sleutel = p_sleutel;
  if v_huidig is distinct from v_oud then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig', v_huidig);
  end if;
  if v_huidig is not distinct from v_nieuw then return jsonb_build_object('ok', true); end if;

  insert into public.bergtop_veld (cluster_id, sleutel, tekst, bijgewerkt_door_naam)
  values (p_cluster_id, p_sleutel, v_nieuw, v_naam)
  on conflict (cluster_id, sleutel) do update set tekst = excluded.tekst, bijgewerkt_door_naam = excluded.bijgewerkt_door_naam;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('bergtop_veld', null, 'bergtop_veld_gewijzigd', auth.uid(), v_naam, p_cluster_id,
          jsonb_build_object('sleutel', p_sleutel, 'oud', v_huidig, 'nieuw', v_nieuw));
  return jsonb_build_object('ok', true);
end $$;

-- Publiceren: alleen als alle 10 toppen (titel en afspraak) en de toelichting zijn ingevuld. Maakt (of vervangt) de gepubliceerde
-- versie met een hoger versienummer en maakt hem zichtbaar voor iedereen in het cluster.
create function public.bergtop_publiceren(p_cluster_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_waarden jsonb;
  v_ontbreekt text[] := '{}';
  v_toppen jsonb;
  v_inhoud jsonb;
  v_versie int;
  n int;
begin
  if not public.bergtop_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if not exists (select 1 from public.cluster where id = p_cluster_id) then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;

  select coalesce(jsonb_object_agg(sleutel, btrim(tekst)), '{}'::jsonb) into v_waarden
  from public.bergtop_veld where cluster_id = p_cluster_id and nullif(btrim(coalesce(tekst, '')), '') is not null;

  for n in 1 .. 10 loop
    if (v_waarden ->> ('top_' || n || '_titel')) is null or (v_waarden ->> ('top_' || n || '_afspraak')) is null then
      v_ontbreekt := v_ontbreekt || ('top ' || n)::text;
    end if;
  end loop;
  if (v_waarden ->> 'toelichting') is null then v_ontbreekt := v_ontbreekt || 'toelichting'::text; end if;
  if array_length(v_ontbreekt, 1) > 0 then
    return jsonb_build_object('ok', false, 'reden', 'onvolledig', 'ontbrekend', to_jsonb(v_ontbreekt));
  end if;

  select jsonb_agg(jsonb_build_object('nummer', g, 'titel', v_waarden ->> ('top_' || g || '_titel'), 'afspraak', v_waarden ->> ('top_' || g || '_afspraak')) order by g)
  into v_toppen from generate_series(1, 10) as g;
  v_inhoud := jsonb_build_object('toppen', v_toppen, 'toelichting_titel', v_waarden ->> 'toelichting_titel', 'toelichting', v_waarden ->> 'toelichting');

  perform pg_advisory_xact_lock(hashtextextended(p_cluster_id::text || ':bergtop_publicatie', 0));
  select coalesce(max(versie), 0) + 1 into v_versie from public.bergtop_publicatie where cluster_id = p_cluster_id;
  insert into public.bergtop_publicatie (cluster_id, versie, inhoud, zichtbaar, gepubliceerd_op, gepubliceerd_door_naam)
  values (p_cluster_id, v_versie, v_inhoud, true, now(), v_naam)
  on conflict (cluster_id) do update
    set versie = excluded.versie, inhoud = excluded.inhoud, zichtbaar = true, gepubliceerd_op = now(), gepubliceerd_door_naam = excluded.gepubliceerd_door_naam;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('bergtop_publicatie', null, 'bergtoppen_gepubliceerd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('versie', v_versie));
  return jsonb_build_object('ok', true, 'versie', v_versie);
end $$;

-- Intrekken: de gepubliceerde versie is niet meer zichtbaar voor studenten en projectgroepen (de stuurgroep en de docent zien hem nog).
create function public.bergtop_intrekken(p_cluster_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_versie int;
begin
  if not public.bergtop_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  update public.bergtop_publicatie set zichtbaar = false where cluster_id = p_cluster_id and zichtbaar returning versie into v_versie;
  if not found then return jsonb_build_object('ok', false, 'reden', 'niet_gepubliceerd'); end if;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('bergtop_publicatie', null, 'bergtoppen_ingetrokken', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('versie', v_versie));
  return jsonb_build_object('ok', true);
end $$;

-- De link naar het inschrijfformulier waarin studenten de bergtoppen ondertekenen (https; leeg haalt hem weg).
create function public.cluster_inschrijf_link_zetten(p_cluster_id uuid, p_link text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if not public.bergtop_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if v_link is not null and (v_link !~ '^https://' or char_length(v_link) > 1000 or position(' ' in v_link) > 0) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  update public.cluster set inschrijf_link = v_link where id = p_cluster_id;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_cluster_id, 'inschrijf_link_gewijzigd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('ingesteld', v_link is not null));
  return jsonb_build_object('ok', true);
end $$;

-- De docent kopieert het concept van het ene cluster naar het andere; het concept in het doelcluster wordt vervangen.
-- De gepubliceerde versie van het doelcluster en de inschrijflink blijven ongemoeid.
create function public.bergtoppen_overnemen(p_van uuid, p_naar uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_velden int;
begin
  if not public.is_docent() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_van is null or p_naar is null or p_van = p_naar
     or not exists (select 1 from public.cluster where id = p_van) or not exists (select 1 from public.cluster where id = p_naar) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  delete from public.bergtop_veld where cluster_id = p_naar;
  insert into public.bergtop_veld (cluster_id, sleutel, tekst, bijgewerkt_door_naam)
  select p_naar, sleutel, tekst, v_naam from public.bergtop_veld where cluster_id = p_van;
  get diagnostics v_velden = row_count;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_naar, 'bergtoppen_overgenomen', auth.uid(), v_naam, p_naar, jsonb_build_object('van', p_van, 'velden', v_velden));
  return jsonb_build_object('ok', true, 'velden', v_velden);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'bergtop_veld_opslaan(uuid, text, text, text, text)', 'bergtop_publiceren(uuid, text)', 'bergtop_intrekken(uuid, text)',
    'cluster_inschrijf_link_zetten(uuid, text, text)', 'bergtoppen_overnemen(uuid, uuid, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
