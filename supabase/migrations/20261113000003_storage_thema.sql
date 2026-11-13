-- Opdracht 2: opslag voor sfeerbeeld en logo van het meerdaagsethema.
-- Pad in de bucket: cluster/<cluster_id>/<bestandsnaam>.
-- Lezen: het hele cluster en de docent. Schrijven: de stuurgroep van het cluster en de docent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thema', 'thema', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy thema_bestanden_lezen on storage.objects
  for select to authenticated
  using (
    bucket_id = 'thema'
    and (
      public.is_docent()
      or ((storage.foldername(name))[1] = 'cluster'
          and (storage.foldername(name))[2] = public.mijn_cluster()::text)
    )
  );

create policy thema_bestanden_toevoegen on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'thema'
    and (
      public.is_docent()
      or (public.mijn_soort() = 'stuurgroep'
          and (storage.foldername(name))[1] = 'cluster'
          and (storage.foldername(name))[2] = public.mijn_cluster()::text)
    )
  );

create policy thema_bestanden_wijzigen on storage.objects
  for update to authenticated
  using (
    bucket_id = 'thema'
    and (
      public.is_docent()
      or (public.mijn_soort() = 'stuurgroep'
          and (storage.foldername(name))[1] = 'cluster'
          and (storage.foldername(name))[2] = public.mijn_cluster()::text)
    )
  )
  with check (
    bucket_id = 'thema'
    and (
      public.is_docent()
      or (public.mijn_soort() = 'stuurgroep'
          and (storage.foldername(name))[1] = 'cluster'
          and (storage.foldername(name))[2] = public.mijn_cluster()::text)
    )
  );

create policy thema_bestanden_verwijderen on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'thema'
    and (
      public.is_docent()
      or (public.mijn_soort() = 'stuurgroep'
          and (storage.foldername(name))[1] = 'cluster'
          and (storage.foldername(name))[2] = public.mijn_cluster()::text)
    )
  );

-- sfeerbeeld_pad is een eigen bestand in de bucket (cluster/...) of een outdoorfoto
-- uit de app zelf (fotos/<naam>); logo_pad alleen een eigen bestand.
alter table public.meerdaagsethema
  add constraint thema_sfeerbeeld_pad check (
    sfeerbeeld_pad is null or sfeerbeeld_pad like 'cluster/%' or sfeerbeeld_pad like 'fotos/%'
  ),
  add constraint thema_logo_pad check (logo_pad is null or logo_pad like 'cluster/%');
