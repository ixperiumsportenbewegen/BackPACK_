-- Persoonlijke paklijst: wat neemt een student mee? Per cluster, gemaakt door de stuurgroep (Logistiek & Facilitair voorop).
-- Niet te verwarren met de materiaalcontrole (materiaal_telling) van de materialen voor de belevenissen.
-- Indeling: blok (per persoon of om te delen met een groepje) > categorie > spul > onderdeel van een spul (één niveau diep).
--   * Lezen: iedereen in het eigen cluster (ook het studentenaccount) en de docent.
--   * Schrijven: de hele stuurgroep van het cluster en de docent, uitsluitend via functies met rechtencontrole.
--   * Per veld opslaan met een waarschuwing bij gelijktijdig wijzigen (waarde die je zag moet nog kloppen); logboek met naam.
--   * Elk cluster krijgt vooraf een aantal categorieën, zonder spullen. De stuurgroep voegt spullen en aantallen toe.
--   * De docent kan de lijst van het ene cluster in het andere overnemen.
-- Alleen toevoegend: nieuwe tabellen en functies.

create table public.paklijst_categorie (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  blok text not null check (blok in ('persoon', 'groepje')),
  naam text not null check (char_length(btrim(naam)) between 1 and 80),
  volgorde int not null,
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.paklijst_categorie (cluster_id, blok, volgorde);

create table public.paklijst_item (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  categorie_id uuid not null references public.paklijst_categorie (id) on delete cascade,
  bovenliggend_id uuid references public.paklijst_item (id) on delete cascade,
  naam text not null default '' check (char_length(naam) <= 150),
  aantal text check (aantal is null or char_length(aantal) <= 40),
  toelichting text check (toelichting is null or char_length(toelichting) <= 500),
  optioneel boolean not null default false,
  volgorde int not null,
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.paklijst_item (cluster_id, categorie_id, bovenliggend_id, volgorde);

create trigger paklijst_categorie_updated_at before update on public.paklijst_categorie
  for each row execute function public.set_updated_at();
create trigger paklijst_item_updated_at before update on public.paklijst_item
  for each row execute function public.set_updated_at();

alter table public.paklijst_categorie enable row level security;
alter table public.paklijst_item enable row level security;
revoke all on public.paklijst_categorie, public.paklijst_item from anon, authenticated;
grant select on public.paklijst_categorie, public.paklijst_item to authenticated;

create policy paklijst_categorie_lezen on public.paklijst_categorie for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());
create policy paklijst_item_lezen on public.paklijst_item for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());

-- ---------------------------------------------------------------- hulpfuncties
create function public.paklijst_mag_schrijven(p_cluster_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_docent() or (public.mijn_soort() = 'stuurgroep' and p_cluster_id = public.mijn_cluster())
$$;
revoke all on function public.paklijst_mag_schrijven(uuid) from public, anon;

-- De vaste categorieën van een cluster zonder spullen (alleen als het cluster nog geen categorieën heeft). Niet voor gebruikers.
create function public.paklijst_standaard_categorieen(p_cluster_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.paklijst_categorie where cluster_id = p_cluster_id) then return; end if;
  insert into public.paklijst_categorie (cluster_id, blok, naam, volgorde)
  select p_cluster_id, c.blok, c.naam, c.volgorde from (values
    ('persoon', 'Documenten en verzekering', 1), ('persoon', 'Rugzak en slapen', 2), ('persoon', 'Kleding', 3),
    ('persoon', 'Schoenen', 4), ('persoon', 'Toilettas en verzorging', 5), ('persoon', 'Eten en drinken', 6),
    ('persoon', 'Verlichting en elektronica', 7), ('persoon', 'Overig', 8),
    ('groepje', 'Koken en eten', 1), ('groepje', 'EHBO en verzorging', 2), ('groepje', 'Overig', 3)
  ) as c(blok, naam, volgorde);
end $$;
revoke all on function public.paklijst_standaard_categorieen(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- categorieën
create function public.paklijst_categorie_toevoegen(p_cluster_id uuid, p_blok text, p_categorie text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_cat text := btrim(coalesce(p_categorie, '')); v_id uuid; v_aantal int; v_volgorde int;
begin
  if not public.paklijst_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_blok not in ('persoon', 'groepje') or char_length(v_cat) not between 1 and 80
     or not exists (select 1 from public.cluster where id = p_cluster_id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_cluster_id::text || ':cat:' || p_blok, 0));
  select count(*), coalesce(max(volgorde), 0) into v_aantal, v_volgorde from public.paklijst_categorie where cluster_id = p_cluster_id and blok = p_blok;
  if v_aantal >= 30 then return jsonb_build_object('ok', false, 'reden', 'te_veel'); end if;
  insert into public.paklijst_categorie (cluster_id, blok, naam, volgorde, bijgewerkt_door_naam)
  values (p_cluster_id, p_blok, v_cat, v_volgorde + 1, v_naam) returning id into v_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_categorie', v_id, 'paklijst_categorie_toegevoegd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('blok', p_blok, 'categorie', v_cat));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create function public.paklijst_categorie_hernoemen(p_id uuid, p_oud text, p_nieuw text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_nieuw text := btrim(coalesce(p_nieuw, '')); r public.paklijst_categorie%rowtype;
begin
  select * into r from public.paklijst_categorie where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if char_length(v_nieuw) not between 1 and 80 then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if btrim(r.naam) is distinct from btrim(coalesce(p_oud, '')) then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig', r.naam);
  end if;
  if btrim(r.naam) = v_nieuw then return jsonb_build_object('ok', true); end if;
  update public.paklijst_categorie set naam = v_nieuw, bijgewerkt_door_naam = v_naam where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_categorie', p_id, 'paklijst_categorie_hernoemd', auth.uid(), v_naam, r.cluster_id, jsonb_build_object('oud', r.naam, 'nieuw', v_nieuw));
  return jsonb_build_object('ok', true);
end $$;

create function public.paklijst_categorie_verplaatsen(p_id uuid, p_omhoog boolean, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.paklijst_categorie%rowtype; b public.paklijst_categorie%rowtype;
begin
  select * into r from public.paklijst_categorie where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if coalesce(p_omhoog, true) then
    select * into b from public.paklijst_categorie where cluster_id = r.cluster_id and blok = r.blok and volgorde < r.volgorde order by volgorde desc limit 1 for update;
  else
    select * into b from public.paklijst_categorie where cluster_id = r.cluster_id and blok = r.blok and volgorde > r.volgorde order by volgorde asc limit 1 for update;
  end if;
  if not found then return jsonb_build_object('ok', true); end if;
  update public.paklijst_categorie set volgorde = b.volgorde, bijgewerkt_door_naam = v_naam where id = r.id;
  update public.paklijst_categorie set volgorde = r.volgorde where id = b.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_categorie', p_id, 'paklijst_categorie_verplaatst', auth.uid(), v_naam, r.cluster_id, jsonb_build_object('categorie', r.naam, 'omhoog', coalesce(p_omhoog, true)));
  return jsonb_build_object('ok', true);
end $$;

-- Een categorie verwijderen, met alle spullen erin. De inhoud blijft in het logboek bewaard.
create function public.paklijst_categorie_verwijderen(p_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.paklijst_categorie%rowtype; v_spullen jsonb; v_aantal int;
begin
  select * into r from public.paklijst_categorie where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  select coalesce(jsonb_agg(naam order by volgorde) filter (where naam <> ''), '[]'::jsonb), count(*) into v_spullen, v_aantal
  from public.paklijst_item where categorie_id = p_id;
  delete from public.paklijst_categorie where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_categorie', p_id, 'paklijst_categorie_verwijderd', auth.uid(), v_naam, r.cluster_id,
          jsonb_build_object('categorie', r.naam, 'blok', r.blok, 'aantal_spullen', v_aantal, 'spullen', v_spullen));
  return jsonb_build_object('ok', true, 'aantal_spullen', v_aantal);
end $$;

-- ---------------------------------------------------------------- spullen
-- Een leeg spul toevoegen achteraan een categorie, of als onderdeel van een ander spul (één niveau diep).
create function public.paklijst_item_toevoegen(p_categorie_id uuid, p_bovenliggend_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); c public.paklijst_categorie%rowtype; p public.paklijst_item%rowtype;
        v_id uuid; v_aantal int; v_volgorde int;
begin
  select * into c from public.paklijst_categorie where id = p_categorie_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(c.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_bovenliggend_id is not null then
    select * into p from public.paklijst_item where id = p_bovenliggend_id;
    if not found or p.categorie_id <> c.id or p.bovenliggend_id is not null then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  end if;
  select count(*), coalesce(max(volgorde), 0) into v_aantal, v_volgorde from public.paklijst_item
  where categorie_id = c.id and bovenliggend_id is not distinct from p_bovenliggend_id;
  if (p_bovenliggend_id is null and v_aantal >= 100) or (p_bovenliggend_id is not null and v_aantal >= 30) then
    return jsonb_build_object('ok', false, 'reden', 'te_veel');
  end if;
  insert into public.paklijst_item (cluster_id, categorie_id, bovenliggend_id, volgorde, bijgewerkt_door_naam)
  values (c.cluster_id, c.id, p_bovenliggend_id, v_volgorde + 1, v_naam) returning id into v_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_item', v_id, 'paklijst_item_toegevoegd', auth.uid(), v_naam, c.cluster_id, jsonb_build_object('categorie', c.naam, 'onderdeel', p_bovenliggend_id is not null));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Eén veld van een spul opslaan: naam, aantal, toelichting of optioneel (ja of leeg). Alleen als het veld nog de waarde
-- heeft die de gebruiker zag; anders een conflict met de huidige waarde.
create function public.paklijst_item_veld_opslaan(p_id uuid, p_veld text, p_oud text, p_nieuw text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_oud text := nullif(btrim(coalesce(p_oud, '')), '');
  v_nieuw text := nullif(btrim(coalesce(p_nieuw, '')), '');
  r public.paklijst_item%rowtype;
  v_huidig text;
begin
  select * into r from public.paklijst_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_veld not in ('naam', 'aantal', 'toelichting', 'optioneel') then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if (p_veld = 'naam' and char_length(coalesce(v_nieuw, '')) > 150) or (p_veld = 'aantal' and char_length(coalesce(v_nieuw, '')) > 40)
     or (p_veld = 'toelichting' and char_length(coalesce(v_nieuw, '')) > 500) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_veld = 'optioneel' then
    v_oud := case when v_oud = 'ja' then 'ja' else null end;
    v_nieuw := case when v_nieuw = 'ja' then 'ja' else null end;
  end if;
  v_huidig := case p_veld
    when 'naam' then nullif(btrim(r.naam), '')
    when 'aantal' then nullif(btrim(coalesce(r.aantal, '')), '')
    when 'toelichting' then nullif(btrim(coalesce(r.toelichting, '')), '')
    else case when r.optioneel then 'ja' else null end end;
  if v_huidig is distinct from v_oud then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig', v_huidig);
  end if;
  if v_huidig is not distinct from v_nieuw then return jsonb_build_object('ok', true); end if;
  update public.paklijst_item set
    naam = case when p_veld = 'naam' then coalesce(v_nieuw, '') else naam end,
    aantal = case when p_veld = 'aantal' then v_nieuw else aantal end,
    toelichting = case when p_veld = 'toelichting' then v_nieuw else toelichting end,
    optioneel = case when p_veld = 'optioneel' then v_nieuw is not null else optioneel end,
    bijgewerkt_door_naam = v_naam
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_item', p_id, 'paklijst_item_gewijzigd', auth.uid(), v_naam, r.cluster_id,
          jsonb_build_object('veld', p_veld, 'oud', v_huidig, 'nieuw', v_nieuw));
  return jsonb_build_object('ok', true);
end $$;

create function public.paklijst_item_verplaatsen(p_id uuid, p_omhoog boolean, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.paklijst_item%rowtype; b public.paklijst_item%rowtype;
begin
  select * into r from public.paklijst_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if coalesce(p_omhoog, true) then
    select * into b from public.paklijst_item where categorie_id = r.categorie_id and bovenliggend_id is not distinct from r.bovenliggend_id and volgorde < r.volgorde order by volgorde desc limit 1 for update;
  else
    select * into b from public.paklijst_item where categorie_id = r.categorie_id and bovenliggend_id is not distinct from r.bovenliggend_id and volgorde > r.volgorde order by volgorde asc limit 1 for update;
  end if;
  if not found then return jsonb_build_object('ok', true); end if;
  update public.paklijst_item set volgorde = b.volgorde, bijgewerkt_door_naam = v_naam where id = r.id;
  update public.paklijst_item set volgorde = r.volgorde where id = b.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_item', p_id, 'paklijst_item_verplaatst', auth.uid(), v_naam, r.cluster_id, jsonb_build_object('spul', r.naam, 'omhoog', coalesce(p_omhoog, true)));
  return jsonb_build_object('ok', true);
end $$;

-- Een spul verwijderen, met zijn onderdelen. De inhoud blijft in het logboek bewaard.
create function public.paklijst_item_verwijderen(p_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.paklijst_item%rowtype; v_onderdelen jsonb;
begin
  select * into r from public.paklijst_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  select coalesce(jsonb_agg(naam order by volgorde) filter (where naam <> ''), '[]'::jsonb) into v_onderdelen from public.paklijst_item where bovenliggend_id = p_id;
  delete from public.paklijst_item where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_item', p_id, 'paklijst_item_verwijderd', auth.uid(), v_naam, r.cluster_id,
          jsonb_build_object('spul', r.naam, 'aantal', r.aantal, 'toelichting', r.toelichting, 'onderdelen', v_onderdelen));
  return jsonb_build_object('ok', true);
end $$;

-- Een lijst plakken: elke regel wordt een spul in de categorie. Een regel die met een streepje (- of *) begint, of die is
-- ingesprongen, wordt een onderdeel van het spul erboven. Met | scheid je naam, aantal en toelichting ("Slaapzak | 1 | warm genoeg").
create function public.paklijst_items_plakken(p_categorie_id uuid, p_tekst text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  c public.paklijst_categorie%rowtype;
  v_regels text[];
  v_regel text; v_tekst text; v_delen text[]; v_sub boolean; v_n text;
  v_lijst jsonb := '[]'::jsonb; v_hoofd int := 0; v_sub_teller int := 0; v_max_sub int := 0;
  v_volgorde int; v_ouder uuid; v_nieuw uuid; v_subvolgorde int; v_i int; v_item jsonb; v_totaal int := 0;
begin
  select * into c from public.paklijst_categorie where id = p_categorie_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.paklijst_mag_schrijven(c.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if char_length(coalesce(p_tekst, '')) > 20000 then return jsonb_build_object('ok', false, 'reden', 'te_veel'); end if;

  v_regels := regexp_split_to_array(replace(coalesce(p_tekst, ''), E'\r', ''), E'\n');
  for v_i in 1 .. coalesce(array_length(v_regels, 1), 0) loop
    v_regel := replace(v_regels[v_i], E'\t', '  ');
    continue when btrim(v_regel) = '';
    v_sub := (v_regel ~ '^\s*[-*•]\s*\S' or v_regel ~ '^\s{2,}\S');
    v_tekst := btrim(regexp_replace(v_regel, '^\s*[-*•]?\s*', ''));
    v_delen := string_to_array(v_tekst, '|');
    v_n := left(btrim(coalesce(v_delen[1], '')), 150);
    continue when v_n = '';
    if v_sub and v_hoofd = 0 then v_sub := false; end if;
    if v_sub then
      v_sub_teller := v_sub_teller + 1;
      v_max_sub := greatest(v_max_sub, v_sub_teller);
    else
      v_hoofd := v_hoofd + 1;
      v_sub_teller := 0;
    end if;
    v_lijst := v_lijst || jsonb_build_array(jsonb_build_object(
      'sub', v_sub, 'naam', v_n,
      'aantal', nullif(left(btrim(coalesce(v_delen[2], '')), 40), ''),
      'toelichting', nullif(left(coalesce((select string_agg(btrim(x), ' | ') from unnest(v_delen[3:]) as x), ''), 500), '')));
    v_totaal := v_totaal + 1;
    if v_totaal > 150 then return jsonb_build_object('ok', false, 'reden', 'te_veel'); end if;
  end loop;
  if v_totaal = 0 then return jsonb_build_object('ok', false, 'reden', 'leeg'); end if;
  if v_max_sub > 30 or (select count(*) from public.paklijst_item where categorie_id = c.id and bovenliggend_id is null) + v_hoofd > 100 then
    return jsonb_build_object('ok', false, 'reden', 'te_veel');
  end if;
  -- ook het aantal onderdelen per spul: controleer per groep
  v_sub_teller := 0;
  for v_item in select * from jsonb_array_elements(v_lijst) loop
    if (v_item ->> 'sub')::boolean then
      v_sub_teller := v_sub_teller + 1;
      if v_sub_teller > 30 then return jsonb_build_object('ok', false, 'reden', 'te_veel'); end if;
    else
      v_sub_teller := 0;
    end if;
  end loop;

  select coalesce(max(volgorde), 0) into v_volgorde from public.paklijst_item where categorie_id = c.id and bovenliggend_id is null;
  v_ouder := null; v_subvolgorde := 0;
  for v_item in select * from jsonb_array_elements(v_lijst) loop
    if (v_item ->> 'sub')::boolean then
      v_subvolgorde := v_subvolgorde + 1;
      insert into public.paklijst_item (cluster_id, categorie_id, bovenliggend_id, naam, aantal, toelichting, volgorde, bijgewerkt_door_naam)
      values (c.cluster_id, c.id, v_ouder, v_item ->> 'naam', v_item ->> 'aantal', v_item ->> 'toelichting', v_subvolgorde, v_naam);
    else
      v_volgorde := v_volgorde + 1;
      insert into public.paklijst_item (cluster_id, categorie_id, bovenliggend_id, naam, aantal, toelichting, volgorde, bijgewerkt_door_naam)
      values (c.cluster_id, c.id, null, v_item ->> 'naam', v_item ->> 'aantal', v_item ->> 'toelichting', v_volgorde, v_naam)
      returning id into v_nieuw;
      v_ouder := v_nieuw; v_subvolgorde := 0;
    end if;
  end loop;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('paklijst_categorie', c.id, 'paklijst_items_geplakt', auth.uid(), v_naam, c.cluster_id, jsonb_build_object('categorie', c.naam, 'aantal', v_totaal));
  return jsonb_build_object('ok', true, 'aantal', v_totaal);
end $$;

-- De docent kopieert de hele paklijst van het ene cluster naar het andere; wat daar stond, wordt vervangen.
create function public.paklijst_overnemen(p_van uuid, p_naar uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_cats int; v_items int;
begin
  if not public.is_docent() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_van is null or p_naar is null or p_van = p_naar
     or not exists (select 1 from public.cluster where id = p_van) or not exists (select 1 from public.cluster where id = p_naar) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  delete from public.paklijst_categorie where cluster_id = p_naar; -- de spullen gaan mee (cascade)

  drop table if exists _pl_cat; drop table if exists _pl_item;
  create temp table _pl_cat on commit drop as select id as oud, gen_random_uuid() as nieuw from public.paklijst_categorie where cluster_id = p_van;
  create temp table _pl_item on commit drop as select id as oud, gen_random_uuid() as nieuw from public.paklijst_item where cluster_id = p_van;

  insert into public.paklijst_categorie (id, cluster_id, blok, naam, volgorde, bijgewerkt_door_naam)
  select m.nieuw, p_naar, c.blok, c.naam, c.volgorde, v_naam from public.paklijst_categorie c join _pl_cat m on m.oud = c.id;
  get diagnostics v_cats = row_count;
  insert into public.paklijst_item (id, cluster_id, categorie_id, bovenliggend_id, naam, aantal, toelichting, optioneel, volgorde, bijgewerkt_door_naam)
  select mi.nieuw, p_naar, mc.nieuw, mb.nieuw, i.naam, i.aantal, i.toelichting, i.optioneel, i.volgorde, v_naam
  from public.paklijst_item i join _pl_item mi on mi.oud = i.id join _pl_cat mc on mc.oud = i.categorie_id left join _pl_item mb on mb.oud = i.bovenliggend_id;
  get diagnostics v_items = row_count;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_naar, 'paklijst_overgenomen', auth.uid(), v_naam, p_naar, jsonb_build_object('van', p_van, 'categorieen', v_cats, 'spullen', v_items));
  return jsonb_build_object('ok', true, 'categorieen', v_cats, 'spullen', v_items);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'paklijst_categorie_toevoegen(uuid, text, text, text)', 'paklijst_categorie_hernoemen(uuid, text, text, text)',
    'paklijst_categorie_verplaatsen(uuid, boolean, text)', 'paklijst_categorie_verwijderen(uuid, text)',
    'paklijst_item_toevoegen(uuid, uuid, text)', 'paklijst_item_veld_opslaan(uuid, text, text, text, text)',
    'paklijst_item_verplaatsen(uuid, boolean, text)', 'paklijst_item_verwijderen(uuid, text)',
    'paklijst_items_plakken(uuid, text, text)', 'paklijst_overnemen(uuid, uuid, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Elk bestaand cluster krijgt de vaste categorieën, zonder spullen.
select public.paklijst_standaard_categorieen(id) from public.cluster;
