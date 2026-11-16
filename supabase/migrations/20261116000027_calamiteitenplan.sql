-- Calamiteitenplan (incl. EHBO): een algemeen plan per cluster, als sectie in de app (geen pdf).
-- Lezen: iedereen in het eigen cluster (ook het studentenaccount) en de docent.
-- Schrijven: de hele stuurgroep van het cluster en de docent, uitsluitend via functies met rechtencontrole.
--   * calamiteit_veld: losse tekstvelden (sleutel + tekst) per cluster;
--   * calamiteit_item: regels in lijsten (contactpersonen, ziekenhuizen, situaties, ...) met velden in jsonb;
--   * elk veld wordt per stuk opgeslagen en alleen gewijzigd als het nog de waarde heeft die de gebruiker zag;
--   * wie iets wijzigt vult zijn naam in; wijzigingen komen met oude en nieuwe tekst in het logboek (`wijziging`);
--   * cluster.whatsapp_link: de link naar de groepsapp voor noodmeldingen (alleen een link, geen chat in de app);
--   * calamiteitenplan_overnemen: de docent kopieert het plan van het ene cluster naar het andere.
-- Alleen toevoegend: nieuwe tabellen, een nieuwe kolom en nieuwe functies.

alter table public.cluster add column whatsapp_link text;
alter table public.cluster add constraint cluster_whatsapp_link_https check (
  whatsapp_link is null or (whatsapp_link ~ '^https://' and char_length(whatsapp_link) <= 1000 and position(' ' in whatsapp_link) = 0)
);

create table public.calamiteit_veld (
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  sleutel text not null check (sleutel ~ '^[a-z0-9_]{1,50}$'),
  tekst text check (tekst is null or char_length(tekst) <= 4000),
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cluster_id, sleutel)
);

create table public.calamiteit_item (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  lijst text not null check (lijst ~ '^[a-z0-9_]{1,50}$'),
  volgorde int not null,
  velden jsonb not null default '{}'::jsonb check (jsonb_typeof(velden) = 'object'),
  bijgewerkt_door_naam text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.calamiteit_item (cluster_id, lijst, volgorde);

create trigger calamiteit_veld_updated_at before update on public.calamiteit_veld
  for each row execute function public.set_updated_at();
create trigger calamiteit_item_updated_at before update on public.calamiteit_item
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ afscherming
alter table public.calamiteit_veld enable row level security;
alter table public.calamiteit_item enable row level security;
revoke all on public.calamiteit_veld, public.calamiteit_item from anon, authenticated;
grant select on public.calamiteit_veld, public.calamiteit_item to authenticated;

create policy calamiteit_veld_lezen on public.calamiteit_veld for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());
create policy calamiteit_item_lezen on public.calamiteit_item for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());

-- ---------------------------------------------------------------- functies
create function public.calamiteit_mag_schrijven(p_cluster_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_docent() or (public.mijn_soort() = 'stuurgroep' and p_cluster_id = public.mijn_cluster())
$$;
revoke all on function public.calamiteit_mag_schrijven(uuid) from public, anon;

-- Eén tekstveld opslaan. Alleen als het veld nog de waarde heeft die de gebruiker zag (p_oud); anders komt er een
-- conflict met de huidige waarde terug. Een lege waarde wist het veld.
create function public.calamiteit_veld_opslaan(p_cluster_id uuid, p_sleutel text, p_oud text, p_nieuw text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_oud text := nullif(btrim(coalesce(p_oud, '')), '');
  v_nieuw text := nullif(btrim(coalesce(p_nieuw, '')), '');
  v_huidig text;
begin
  if not public.calamiteit_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_sleutel is null or p_sleutel !~ '^[a-z0-9_]{1,50}$' or char_length(coalesce(v_nieuw, '')) > 4000
     or not exists (select 1 from public.cluster where id = p_cluster_id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cluster_id::text || ':' || p_sleutel, 0));
  select nullif(btrim(coalesce(tekst, '')), '') into v_huidig from public.calamiteit_veld where cluster_id = p_cluster_id and sleutel = p_sleutel;
  if v_huidig is distinct from v_oud then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig', v_huidig);
  end if;
  if v_huidig is not distinct from v_nieuw then return jsonb_build_object('ok', true); end if;

  insert into public.calamiteit_veld (cluster_id, sleutel, tekst, bijgewerkt_door_naam)
  values (p_cluster_id, p_sleutel, v_nieuw, v_naam)
  on conflict (cluster_id, sleutel) do update set tekst = excluded.tekst, bijgewerkt_door_naam = excluded.bijgewerkt_door_naam;

  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('calamiteit_veld', null, 'calamiteit_veld_gewijzigd', auth.uid(), v_naam, p_cluster_id,
          jsonb_build_object('sleutel', p_sleutel, 'oud', v_huidig, 'nieuw', v_nieuw));
  return jsonb_build_object('ok', true);
end $$;

-- Een lege regel aan een lijst toevoegen (achteraan).
create function public.calamiteit_item_toevoegen(p_cluster_id uuid, p_lijst text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_id uuid; v_aantal int; v_volgorde int;
begin
  if not public.calamiteit_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_lijst is null or p_lijst !~ '^[a-z0-9_]{1,50}$' or not exists (select 1 from public.cluster where id = p_cluster_id) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_cluster_id::text || ':' || p_lijst, 0));
  select count(*), coalesce(max(volgorde), 0) into v_aantal, v_volgorde from public.calamiteit_item where cluster_id = p_cluster_id and lijst = p_lijst;
  if v_aantal >= 50 then return jsonb_build_object('ok', false, 'reden', 'te_veel'); end if;
  insert into public.calamiteit_item (cluster_id, lijst, volgorde, bijgewerkt_door_naam)
  values (p_cluster_id, p_lijst, v_volgorde + 1, v_naam) returning id into v_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('calamiteit_item', v_id, 'calamiteit_item_toegevoegd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('lijst', p_lijst));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Eén veld van een regel opslaan (zelfde regels als calamiteit_veld_opslaan).
create function public.calamiteit_item_veld_opslaan(p_id uuid, p_veld text, p_oud text, p_nieuw text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_naam text := left(btrim(coalesce(p_naam, '')), 60);
  v_oud text := nullif(btrim(coalesce(p_oud, '')), '');
  v_nieuw text := nullif(btrim(coalesce(p_nieuw, '')), '');
  r public.calamiteit_item%rowtype;
  v_huidig text;
begin
  select * into r from public.calamiteit_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.calamiteit_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_veld is null or p_veld !~ '^[a-z0-9_]{1,50}$' or char_length(coalesce(v_nieuw, '')) > 2000 then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  v_huidig := nullif(btrim(coalesce(r.velden ->> p_veld, '')), '');
  if v_huidig is distinct from v_oud then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig', v_huidig);
  end if;
  if v_huidig is not distinct from v_nieuw then return jsonb_build_object('ok', true); end if;
  update public.calamiteit_item
  set velden = case when v_nieuw is null then velden - p_veld else jsonb_set(velden, array[p_veld], to_jsonb(v_nieuw)) end,
      bijgewerkt_door_naam = v_naam
  where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('calamiteit_item', p_id, 'calamiteit_item_gewijzigd', auth.uid(), v_naam, r.cluster_id,
          jsonb_build_object('lijst', r.lijst, 'veld', p_veld, 'oud', v_huidig, 'nieuw', v_nieuw));
  return jsonb_build_object('ok', true);
end $$;

-- Een regel een plek omhoog of omlaag in dezelfde lijst.
create function public.calamiteit_item_verplaatsen(p_id uuid, p_omhoog boolean, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.calamiteit_item%rowtype; b public.calamiteit_item%rowtype;
begin
  select * into r from public.calamiteit_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.calamiteit_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if coalesce(p_omhoog, true) then
    select * into b from public.calamiteit_item where cluster_id = r.cluster_id and lijst = r.lijst and volgorde < r.volgorde order by volgorde desc limit 1 for update;
  else
    select * into b from public.calamiteit_item where cluster_id = r.cluster_id and lijst = r.lijst and volgorde > r.volgorde order by volgorde asc limit 1 for update;
  end if;
  if not found then return jsonb_build_object('ok', true); end if; -- staat al bovenaan of onderaan
  update public.calamiteit_item set volgorde = b.volgorde, bijgewerkt_door_naam = v_naam where id = r.id;
  update public.calamiteit_item set volgorde = r.volgorde where id = b.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('calamiteit_item', p_id, 'calamiteit_item_verplaatst', auth.uid(), v_naam, r.cluster_id, jsonb_build_object('lijst', r.lijst, 'omhoog', coalesce(p_omhoog, true)));
  return jsonb_build_object('ok', true);
end $$;

-- Een regel verwijderen. De inhoud blijft in het logboek bewaard.
create function public.calamiteit_item_verwijderen(p_id uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); r public.calamiteit_item%rowtype;
begin
  select * into r from public.calamiteit_item where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  if not public.calamiteit_mag_schrijven(r.cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  delete from public.calamiteit_item where id = p_id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('calamiteit_item', p_id, 'calamiteit_item_verwijderd', auth.uid(), v_naam, r.cluster_id, jsonb_build_object('lijst', r.lijst, 'velden', r.velden));
  return jsonb_build_object('ok', true);
end $$;

-- De link naar de groepsapp voor noodmeldingen (alleen een https-link; leeg haalt hem weg).
create function public.cluster_whatsapp_link_zetten(p_cluster_id uuid, p_link text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if not public.calamiteit_mag_schrijven(p_cluster_id) then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if v_link is not null and (v_link !~ '^https://' or char_length(v_link) > 1000 or position(' ' in v_link) > 0) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  update public.cluster set whatsapp_link = v_link where id = p_cluster_id;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_cluster_id, 'whatsapp_link_gewijzigd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('ingesteld', v_link is not null));
  return jsonb_build_object('ok', true);
end $$;

-- De docent kopieert het hele plan van het ene cluster naar het andere. Wat er in het doelcluster stond, wordt vervangen
-- (en blijft niet bewaard, behalve in de export). De groepsapp-link wordt niet meegekopieerd.
create function public.calamiteitenplan_overnemen(p_van uuid, p_naar uuid, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_velden int; v_items int;
begin
  if not public.is_docent() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_van is null or p_naar is null or p_van = p_naar
     or not exists (select 1 from public.cluster where id = p_van) or not exists (select 1 from public.cluster where id = p_naar) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  delete from public.calamiteit_veld where cluster_id = p_naar;
  delete from public.calamiteit_item where cluster_id = p_naar;
  insert into public.calamiteit_veld (cluster_id, sleutel, tekst, bijgewerkt_door_naam)
  select p_naar, sleutel, tekst, v_naam from public.calamiteit_veld where cluster_id = p_van;
  get diagnostics v_velden = row_count;
  insert into public.calamiteit_item (cluster_id, lijst, volgorde, velden, bijgewerkt_door_naam)
  select p_naar, lijst, volgorde, velden, v_naam from public.calamiteit_item where cluster_id = p_van;
  get diagnostics v_items = row_count;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_naar, 'calamiteitenplan_overgenomen', auth.uid(), v_naam, p_naar,
          jsonb_build_object('van', p_van, 'velden', v_velden, 'regels', v_items));
  return jsonb_build_object('ok', true, 'velden', v_velden, 'regels', v_items);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'calamiteit_veld_opslaan(uuid, text, text, text, text)', 'calamiteit_item_toevoegen(uuid, text, text)',
    'calamiteit_item_veld_opslaan(uuid, text, text, text, text)', 'calamiteit_item_verplaatsen(uuid, boolean, text)',
    'calamiteit_item_verwijderen(uuid, text)', 'cluster_whatsapp_link_zetten(uuid, text, text)', 'calamiteitenplan_overnemen(uuid, uuid, text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
