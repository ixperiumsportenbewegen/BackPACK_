-- Opdracht 1: Row Level Security volgens docs/rechtenmatrix.md.
-- Uitgangspunt: niets mag, tenzij een regel het toestaat.

-- Anonieme bezoekers (niet ingelogd) krijgen nergens toegang toe.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

alter table public.editie enable row level security;
alter table public.cluster enable row level security;
alter table public.cluster_budget enable row level security;
alter table public.meerdaagsethema enable row level security;
alter table public.stuurgroeprol enable row level security;
alter table public.projectgroep enable row level security;
alter table public.projectgroep_rol enable row level security;
alter table public.account enable row level security;
alter table public.wijziging enable row level security;

-- Rechten op tabelniveau; de regels hieronder bepalen daarbinnen welke rijen.
grant select, insert, update, delete on
  public.editie, public.cluster, public.cluster_budget, public.meerdaagsethema,
  public.stuurgroeprol, public.projectgroep, public.projectgroep_rol
  to authenticated;
-- account en wijziging: alleen lezen. Schrijven gebeurt via beheerfuncties en
-- server-code met de service role.
grant select on public.account, public.wijziging to authenticated;

-- ------------------------------------------------------------ editie
create policy editie_lezen on public.editie
  for select to authenticated using (true);
create policy editie_docent on public.editie
  for all to authenticated using (public.is_docent()) with check (public.is_docent());

-- ----------------------------------------------------------- cluster
create policy cluster_lezen on public.cluster
  for select to authenticated
  using (public.is_docent() or id = public.mijn_cluster());
create policy cluster_docent on public.cluster
  for all to authenticated using (public.is_docent()) with check (public.is_docent());

-- ----------------------------------------------------- cluster_budget
create policy cluster_budget_lezen on public.cluster_budget
  for select to authenticated
  using (public.is_docent()
         or (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster()));
create policy cluster_budget_docent on public.cluster_budget
  for all to authenticated using (public.is_docent()) with check (public.is_docent());
create policy cluster_budget_stuurgroep_wijzigen on public.cluster_budget
  for update to authenticated
  using (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster())
  with check (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster());

-- ------------------------------------------------- meerdaagsethema
create policy thema_lezen on public.meerdaagsethema
  for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());
create policy thema_docent on public.meerdaagsethema
  for all to authenticated using (public.is_docent()) with check (public.is_docent());
create policy thema_stuurgroep_toevoegen on public.meerdaagsethema
  for insert to authenticated
  with check (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster());
create policy thema_stuurgroep_wijzigen on public.meerdaagsethema
  for update to authenticated
  using (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster())
  with check (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster());

-- ---------------------------------------------------- stuurgroeprol
create policy stuurgroeprol_lezen on public.stuurgroeprol
  for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());
create policy stuurgroeprol_docent on public.stuurgroeprol
  for all to authenticated using (public.is_docent()) with check (public.is_docent());
-- Een stuurgroeplid mag alleen de namen van de studenten bij de eigen rol wijzigen.
create policy stuurgroeprol_eigen_wijzigen on public.stuurgroeprol
  for update to authenticated
  using (id = public.mijn_stuurgroeprol())
  with check (id = public.mijn_stuurgroeprol());

create function public.stuurgroeprol_alleen_studenten() returns trigger
language plpgsql as $$
begin
  -- Server-code met de service role (geen ingelogde gebruiker) en de docent mogen alles.
  if auth.uid() is null or public.is_docent() then
    return new;
  end if;
  if new.cluster_id is distinct from old.cluster_id
     or new.code is distinct from old.code
     or new.naam is distinct from old.naam
     or new.focus is distinct from old.focus
     or new.pack is distinct from old.pack then
    raise exception 'Alleen de namen van de studenten mogen worden gewijzigd' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger stuurgroeprol_alleen_studenten
  before update on public.stuurgroeprol
  for each row execute function public.stuurgroeprol_alleen_studenten();

-- -------------------------------------------------------- projectgroep
create policy projectgroep_lezen on public.projectgroep
  for select to authenticated
  using (public.is_docent() or cluster_id = public.mijn_cluster());
create policy projectgroep_docent on public.projectgroep
  for all to authenticated using (public.is_docent()) with check (public.is_docent());

-- ---------------------------------------------------- projectgroep_rol
-- Lezen: docent, stuurgroep en projectgroepen van hetzelfde cluster; studenten niet.
create policy projectgroep_rol_lezen on public.projectgroep_rol
  for select to authenticated
  using (public.is_docent()
         or (public.mijn_soort() in ('stuurgroep', 'projectgroep')
             and public.projectgroep_cluster(projectgroep_id) = public.mijn_cluster()));
create policy projectgroep_rol_docent on public.projectgroep_rol
  for all to authenticated using (public.is_docent()) with check (public.is_docent());
create policy projectgroep_rol_eigen_toevoegen on public.projectgroep_rol
  for insert to authenticated
  with check (public.mijn_soort() = 'projectgroep' and projectgroep_id = public.mijn_projectgroep());
create policy projectgroep_rol_eigen_wijzigen on public.projectgroep_rol
  for update to authenticated
  using (public.mijn_soort() = 'projectgroep' and projectgroep_id = public.mijn_projectgroep())
  with check (public.mijn_soort() = 'projectgroep' and projectgroep_id = public.mijn_projectgroep());

-- ------------------------------------------------------------ account
create policy account_lezen on public.account
  for select to authenticated
  using (public.is_docent() or id = auth.uid());

-- ---------------------------------------------------------- wijziging
create policy wijziging_lezen on public.wijziging
  for select to authenticated
  using (
    public.is_docent()
    or (public.mijn_soort() = 'stuurgroep' and cluster_id = public.mijn_cluster())
    or (public.mijn_soort() = 'projectgroep' and projectgroep_id = public.mijn_projectgroep())
  );

-- Nieuwe tabellen in dit schema geven anon nooit rechten.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
