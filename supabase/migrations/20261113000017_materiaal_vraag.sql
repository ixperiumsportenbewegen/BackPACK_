-- Opdracht 5, deel A (3): hoeveel een belevenis van een materiaal tegelijk nodig heeft.
-- De fasen kop, romp en staart volgen op elkaar, dus de behoefte op één moment is het grootste aantal van de drie fasen,
-- plus wat voor de hele belevenis is gekozen. Een correctie van de stuurgroep telt mee.

create function public.avf_materiaal_vraag(p_avf_id uuid, p_materiaal_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce(sum(case when f.fase is null then f.s end), 0)
          + coalesce(max(case when f.fase is not null then f.s end), 0))::int
  from (
    select x.fase, sum(coalesce(x.aantal_gecorrigeerd, x.aantal)) as s
    from public.avf_materiaal x
    where x.avf_id = p_avf_id and x.materiaal_id = p_materiaal_id
    group by x.fase
  ) f
$$;
revoke all on function public.avf_materiaal_vraag(uuid, uuid) from public, anon, authenticated;

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
         case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end,
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
         case a.locatie_keuze when 'camping' then m.voorraad_camping else m.voorraad_bivak end,
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
