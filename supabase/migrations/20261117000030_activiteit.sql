-- Activiteit per account, alleen voor de docent: wanneer is er voor het laatst ingelogd en gewerkt.
-- Alleen toevoegend (één nieuwe functie, geen tabel). Geen persoonsgegevens: alleen gedeelde accounts.
--
-- laatst_ingelogd: auth.users.last_sign_in_at (met "ingelogd blijven" verandert dit niet bij elk bezoek).
-- laatst_gewerkt:
--   projectgroep: laatste opgeslagen sectie of indiening van het AVF, en fasen of onderdelen waar iets in staat
--   overig:       laatste actie van dat account in het logboek (wijziging)

create function public.account_activiteit()
returns table (
  account_id uuid,
  gebruikersnaam text,
  soort text,
  cluster_code text,
  label text,
  laatst_ingelogd timestamptz,
  laatst_gewerkt timestamptz,
  avf_status text,
  tussentijds boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not public.is_docent() then
    raise exception 'Alleen de docent mag de activiteit zien.' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.gebruikersnaam,
    a.soort::text,
    c.code,
    case a.soort
      when 'projectgroep' then coalesce(pg.naam, 'Projectgroep')
      when 'stuurgroep' then 'Stuurgroep · ' || coalesce(sr.naam, '')
      else 'Studenten'
    end,
    u.last_sign_in_at,
    case when a.soort = 'projectgroep' then
      (select max(t) from (
        select av.ingediend_op as t
        union all
        select (s.value ->> 'updated_at')::timestamptz from jsonb_each(coalesce(av.sectie_bijgewerkt, '{}'::jsonb)) s
        union all
        select f.updated_at from public.avf_fase f
          where f.avf_id = av.id
            and (coalesce(trim(f.organisatievorm), '') <> '' or coalesce(trim(f.coachen_instructies), '') <> ''
                 or coalesce(trim(f.stemgebruik_houding), '') <> '')
        union all
        select o.updated_at from public.avf_onderdeel o
          where o.avf_id = av.id and (coalesce(trim(o.naam), '') <> '' or coalesce(trim(o.beschrijving), '') <> '')
      ) x)
    else
      (select max(w.created_at) from public.wijziging w where w.account_id = a.id)
    end,
    av.status::text,
    av.tussentijds
  from public.account a
  left join public.cluster c on c.id = a.cluster_id
  left join public.projectgroep pg on pg.id = a.projectgroep_id
  left join public.stuurgroeprol sr on sr.id = a.stuurgroeprol_id
  left join public.avf av on av.projectgroep_id = a.projectgroep_id
  left join auth.users u on u.id = a.id
  where a.soort <> 'docent'
  order by c.code desc, a.gebruikersnaam;
end $$;

revoke all on function public.account_activiteit() from public, anon;
grant execute on function public.account_activiteit() to authenticated, service_role;
