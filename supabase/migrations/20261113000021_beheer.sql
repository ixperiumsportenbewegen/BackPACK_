-- Opdracht 5, deel C: beheer. Forms-link per cluster door Communicatie & Financiën, blijf-actief, sessies intrekken bij een
-- wachtwoordreset en een markering voor de livegang.

-- Links moeten een https-adres zijn (of leeg)
alter table public.cluster add constraint cluster_teams_link_https check (teams_link is null or (teams_link ~ '^https://' and char_length(teams_link) <= 1000));
alter table public.cluster add constraint cluster_forms_link_https check (forms_link is null or (forms_link ~ '^https://' and char_length(forms_link) <= 1000));

-- De Forms-link stelt de stuurgroeprol Communicatie & Financiën van het eigen cluster in (en de docent).
-- De Teams-link past alleen de docent aan (rechtstreeks op cluster).
create function public.cluster_forms_link_zetten(p_cluster_id uuid, p_link text, p_naam text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_naam text := left(btrim(coalesce(p_naam, '')), 60); v_link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if not (public.is_docent()
          or (public.mijn_soort() = 'stuurgroep' and public.mijn_stuurgroeprol_code() = 'communicatie_financien' and p_cluster_id = public.mijn_cluster())) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_naam = '' then return jsonb_build_object('ok', false, 'reden', 'naam'); end if;
  if v_link is not null and (v_link !~ '^https://' or char_length(v_link) > 1000 or position(' ' in v_link) > 0) then
    return jsonb_build_object('ok', false, 'reden', 'ongeldig');
  end if;
  update public.cluster set forms_link = v_link where id = p_cluster_id;
  if not found then return jsonb_build_object('ok', false, 'reden', 'ongeldig'); end if;
  insert into public.wijziging (tabel, record_id, actie, account_id, naam, cluster_id, details)
  values ('cluster', p_cluster_id, 'forms_link_gewijzigd', auth.uid(), v_naam, p_cluster_id, jsonb_build_object('ingesteld', v_link is not null));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.cluster_forms_link_zetten(uuid, text, text) from public, anon;
grant execute on function public.cluster_forms_link_zetten(uuid, text, text) to authenticated;

-- Voor /api/blijf-actief: een kleine leesvraag, zonder dat de route een databasesleutel nodig heeft.
create function public.blijf_actief() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.editie
$$;
revoke all on function public.blijf_actief() from public;
grant execute on function public.blijf_actief() to anon, authenticated;

-- Na een wachtwoordreset moet iedereen met dat account opnieuw inloggen: alle sessies van het account verdwijnen.
-- Alleen de server (service role) mag dit aanroepen.
create function public.account_sessies_verwijderen(p_user_id uuid) returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.account_sessies_verwijderen(uuid) from public, anon, authenticated;
grant execute on function public.account_sessies_verwijderen(uuid) to service_role;

-- Markering voor de livegang (en ander beheer dat alleen de server aanraakt). Geen toegang voor clients.
create table public.systeem_instelling (
  sleutel text primary key,
  waarde text,
  updated_at timestamptz not null default now()
);
alter table public.systeem_instelling enable row level security;
revoke all on public.systeem_instelling from anon, authenticated;
