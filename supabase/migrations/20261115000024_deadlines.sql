-- Deadlines: de stuurgroep stelt per cluster een deadline in voor elk deel van het AVF.
--  * 11 onderdelen: AVF-sectie A t/m H, AVF indienen, materiaal kiezen en budgetaanvraag;
--  * een deadline is een afspraak, geen slot: niets in het AVF wordt hierdoor geblokkeerd;
--  * alle accounts van het cluster lezen de deadlines (de docent alle clusters);
--  * instellen en wissen alleen via functies: de stuurgroep van het cluster en de docent, met een regel in het logboek
--    (ook "verschoven van … naar …") en een waarschuwing als iemand anders hetzelfde onderdeel net wijzigde.
-- Alleen toevoegend: er verandert niets aan bestaande tabellen of functies.

create table public.deadline (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.cluster (id) on delete cascade,
  onderdeel text not null check (onderdeel in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'indienen', 'materiaal', 'budget')),
  moment timestamptz not null check (moment >= timestamptz '2026-01-01 00:00+00' and moment < timestamptz '2029-01-01 00:00+00'),
  toelichting text check (toelichting is null or char_length(toelichting) <= 200),
  gezet_door_naam text not null check (char_length(btrim(gezet_door_naam)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cluster_id, onderdeel)
);
create trigger deadline_updated_at before update on public.deadline
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- afscherming
alter table public.deadline enable row level security;
revoke all on public.deadline from anon, authenticated;
grant select on public.deadline to authenticated;
create policy deadline_lezen on public.deadline for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());

-- ----------------------------------------------------------------- functies
-- Zet of verschuift de deadline van een onderdeel. p_verwacht is de updated_at die de gebruiker zag (null als er nog
-- geen deadline was): is die intussen veranderd, dan gebeurt er niets en komt het huidige moment terug.
create function public.deadline_zetten(
  p_cluster_id uuid, p_onderdeel text, p_moment timestamptz, p_toelichting text, p_naam text, p_verwacht timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.deadline%rowtype;
        v_naam text := left(btrim(coalesce(p_naam, '')), 60);
        v_toel text := nullif(btrim(coalesce(p_toelichting, '')), '');
        v_nieuw timestamptz;
        v_verschoven boolean := false;
begin
  if not public.mag_programma_beheren(p_cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if p_onderdeel is null or p_onderdeel not in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'indienen', 'materiaal', 'budget') then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  if p_moment is null or p_moment < timestamptz '2026-01-01 00:00+00' or p_moment >= timestamptz '2029-01-01 00:00+00' then
    return jsonb_build_object('ok', false, 'reden', 'moment');
  end if;
  if v_toel is not null and char_length(v_toel) > 200 then
    return jsonb_build_object('ok', false, 'reden', 'toelichting');
  end if;

  select * into d from public.deadline where cluster_id = p_cluster_id and onderdeel = p_onderdeel for update;
  if found then
    if p_verwacht is null or d.updated_at <> p_verwacht then
      return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig_moment', d.moment, 'huidige_toelichting', d.toelichting,
                                'updated_at', d.updated_at, 'door', d.gezet_door_naam);
    end if;
    if d.moment = p_moment and d.toelichting is not distinct from v_toel then
      return jsonb_build_object('ok', true, 'updated_at', d.updated_at, 'verschoven', false, 'ongewijzigd', true);
    end if;
    v_verschoven := d.moment <> p_moment;
    update public.deadline set moment = p_moment, toelichting = v_toel, gezet_door_naam = v_naam
    where id = d.id returning updated_at into v_nieuw;
    insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
    values ('deadline', d.id, case when v_verschoven then 'deadline_verschoven' else 'deadline_toelichting' end, auth.uid(), v_naam, p_cluster_id,
            jsonb_build_object('onderdeel', p_onderdeel, 'van', d.moment, 'naar', p_moment, 'toelichting', v_toel));
  else
    if p_verwacht is not null then
      -- de deadline is intussen gewist door iemand anders
      return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig_moment', null, 'huidige_toelichting', null, 'updated_at', null, 'door', null);
    end if;
    insert into public.deadline (cluster_id, onderdeel, moment, toelichting, gezet_door_naam)
    values (p_cluster_id, p_onderdeel, p_moment, v_toel, v_naam)
    returning * into d;
    v_nieuw := d.updated_at;
    insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
    values ('deadline', d.id, 'deadline_gezet', auth.uid(), v_naam, p_cluster_id,
            jsonb_build_object('onderdeel', p_onderdeel, 'naar', p_moment, 'toelichting', v_toel));
  end if;
  return jsonb_build_object('ok', true, 'updated_at', v_nieuw, 'verschoven', v_verschoven);
end $$;

create function public.deadline_wissen(p_cluster_id uuid, p_onderdeel text, p_naam text, p_verwacht timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.deadline%rowtype; v_naam text := left(btrim(coalesce(p_naam, '')), 60);
begin
  if not public.mag_programma_beheren(p_cluster_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  select * into d from public.deadline where cluster_id = p_cluster_id and onderdeel = p_onderdeel for update;
  if not found then return jsonb_build_object('ok', true, 'ongewijzigd', true); end if;
  if p_verwacht is null or d.updated_at <> p_verwacht then
    return jsonb_build_object('ok', false, 'reden', 'conflict', 'huidig_moment', d.moment, 'huidige_toelichting', d.toelichting,
                              'updated_at', d.updated_at, 'door', d.gezet_door_naam);
  end if;
  delete from public.deadline where id = d.id;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('deadline', d.id, 'deadline_gewist', auth.uid(), v_naam, p_cluster_id,
          jsonb_build_object('onderdeel', p_onderdeel, 'van', d.moment, 'toelichting', d.toelichting));
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'deadline_zetten(uuid, text, timestamptz, text, text, timestamptz)', 'deadline_wissen(uuid, text, text, timestamptz)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
