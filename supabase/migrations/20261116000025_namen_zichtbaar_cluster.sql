-- De namen van de projectgroepleden (rolverdeling) zijn zichtbaar voor iedereen in het eigen cluster,
-- ook voor het studentenaccount: de studenten organiseren voor elkaar en moeten elkaar kunnen vinden.
-- Een ander cluster ziet niets. Schrijven blijft zoals het was (alleen de eigen projectgroep en de docent).
-- De namen van de stuurgroepleden (stuurgroeprol.studenten) waren al voor het hele cluster leesbaar.

drop policy projectgroep_rol_lezen on public.projectgroep_rol;

create policy projectgroep_rol_lezen on public.projectgroep_rol
  for select to authenticated
  using (
    public.is_docent()
    or public.projectgroep_cluster(projectgroep_id) = public.mijn_cluster()
  );
