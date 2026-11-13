-- Opdracht 5, deel A (4): vaste categorielijst en voorraad die Logistiek & Facilitair zelf inschat.
--  * categorieën zijn een vaste lijst (beheerd door Logistiek & Facilitair van VD en de docent); een materiaal kiest er één;
--  * de voorraad per locatie is leeg ("nog niet ingeschat") tot Logistiek & Facilitair hem invult;
--  * de lijst kan pas definitief als bij elk actief materiaal de voorraad op camping en bivak is ingevuld;
--  * de 13 fictieve testmaterialen uit de zaadgegevens verdwijnen (de echte lijst komt uit seed/materialen.json).

create table public.materiaal_categorie (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique check (char_length(btrim(naam)) between 1 and 60),
  volgorde int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger materiaal_categorie_updated_at before update on public.materiaal_categorie
  for each row execute function public.set_updated_at();

insert into public.materiaal_categorie (naam, volgorde) values
  ('Afbakening en markering', 10), ('Teamherkenning', 20), ('Ballen', 30), ('Sport- en spelmateriaal', 40),
  ('Touwen en stokken', 50), ('Archery tag', 60), ('Veiligheid en communicatie', 70),
  ('Organisatie en schrijfmateriaal', 80), ('Opslag', 90), ('Overig', 100);

-- de fictieve testmaterialen weghalen (alleen als niemand ze gebruikt)
delete from public.materiaal m
where lower(btrim(m.naam)) in (
    'touw (10 m)', 'pionierpalen', 'volleybal', 'pionnen', 'hesjes (set van 10)', 'afzetlint (rol)', 'verf (pot, afwasbaar)',
    'muziekbox', 'zaklamp', 'ehbo-koffer', 'dekzeil 4x6 m', 'waterjerrycan 20 l', 'partytent')
  and not exists (select 1 from public.avf_materiaal x where x.materiaal_id = m.id);

-- bestaande materialen met een onbekende categorie komen onder Overig
update public.materiaal set categorie = 'Overig' where categorie is null or categorie not in (select naam from public.materiaal_categorie);
alter table public.materiaal alter column categorie set default 'Overig';
alter table public.materiaal alter column categorie set not null;
alter table public.materiaal add constraint materiaal_categorie_fk
  foreign key (categorie) references public.materiaal_categorie (naam) on update cascade on delete restrict;

-- voorraad: leeg = nog niet ingeschat
alter table public.materiaal alter column voorraad_camping drop not null;
alter table public.materiaal alter column voorraad_camping drop default;
alter table public.materiaal alter column voorraad_bivak drop not null;
alter table public.materiaal alter column voorraad_bivak drop default;

-- Zodra de lijst definitief is, moet de voorraad ingevuld zijn (nieuw of gewijzigd materiaal).
create or replace function public.materiaal_voor_toevoegen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.toegevoegd_door_cluster := public.mijn_cluster();
  if public.materiaallijst_definitief() and (new.voorraad_camping is null or new.voorraad_bivak is null) then
    raise exception 'Vul de voorraad op de camping en het bivak in' using errcode = '23514';
  end if;
  return new;
end $$;

create function public.materiaal_voor_wijzigen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.materiaallijst_definitief() and new.actief and (new.voorraad_camping is null or new.voorraad_bivak is null) then
    raise exception 'Vul de voorraad op de camping en het bivak in' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger materiaal_voor_wijzigen before update on public.materiaal
  for each row execute function public.materiaal_voor_wijzigen();
revoke all on function public.materiaal_voor_wijzigen() from public, anon, authenticated;

-- Definitief maken kan pas als alles is ingeschat.
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
  if v_leeg > 0 then return jsonb_build_object('ok', false, 'reden', 'onvolledig', 'aantal', v_leeg); end if;
  update public.materiaallijst_status
  set status = 'definitief', definitief_op = now(), definitief_door_naam = v_naam,
      definitief_door_cluster = public.mijn_cluster(), updated_at = now()
  where id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('materiaallijst_status', null, 'materiaallijst_definitief', auth.uid(), v_naam, public.mijn_cluster(), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- Afscherming van de categorielijst: lezen zoals de materialenlijst; beheren door de bouwers (niet door VC).
alter table public.materiaal_categorie enable row level security;
revoke all on public.materiaal_categorie from anon, authenticated;
grant select, delete on public.materiaal_categorie to authenticated;
grant insert (naam, volgorde) on public.materiaal_categorie to authenticated;
grant update (naam, volgorde) on public.materiaal_categorie to authenticated;
create policy materiaal_categorie_lezen on public.materiaal_categorie for select to authenticated using (public.mag_materiaal_lezen());
create policy materiaal_categorie_toevoegen on public.materiaal_categorie for insert to authenticated with check (public.mag_materiaal_beheren());
create policy materiaal_categorie_wijzigen on public.materiaal_categorie for update to authenticated
  using (public.mag_materiaal_beheren()) with check (public.mag_materiaal_beheren());
create policy materiaal_categorie_verwijderen on public.materiaal_categorie for delete to authenticated using (public.mag_materiaal_beheren());

-- Beschikbaarheid en context: een nog niet ingeschatte voorraad telt als 0.
create or replace function public.materiaal_beschikbaar(p_avf_id uuid)
returns table (materiaal_id uuid, voorraad int, anderen int)
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
         coalesce(case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end, 0),
         coalesce((
           select sum(public.avf_materiaal_vraag(b.id, m.id))::int
           from public.avf b
           join public.cluster cb on cb.id = b.cluster_id
           join public.programma_regel rb on rb.id = b.programma_regel_id
           where b.id <> a.id and b.locatie_keuze = a.locatie_keuze
             and (cb.code = 'TEST') = v_test
             and ra.id is not null and rb.dag = ra.dag and rb.starttijd < ra.eindtijd and rb.eindtijd > ra.starttijd
         ), 0)
  from public.materiaal m;
end $$;

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
         coalesce(case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end, 0),
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
