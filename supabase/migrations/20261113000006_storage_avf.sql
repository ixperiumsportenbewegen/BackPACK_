-- Opdracht 3: afbeeldingen bij het AVF (organisatietekeningen en afbeeldingen bij onderdelen).
-- Pad: cluster/<cluster_id>/avf/<avf_id>/<bestandsnaam>
-- Zelfde regels als het AVF zelf: lezen = eigen projectgroep, stuurgroep van het cluster en docent;
-- schrijven = eigen projectgroep zolang het AVF niet `ingediend` is, en docent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avf', 'avf', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Geeft het id van het AVF waar dit pad bij hoort, alleen als het pad klopt met cluster en AVF.
create function public.avf_pad_avf_id(p_pad text) returns uuid
language sql stable security definer set search_path = public as $$
  select a.id
  from public.avf a
  where p_pad ~ '^cluster/[0-9a-f-]{36}/avf/[0-9a-f-]{36}/[^/]+$'
    and a.cluster_id::text = split_part(p_pad, '/', 2)
    and a.id::text = split_part(p_pad, '/', 4)
$$;
revoke all on function public.avf_pad_avf_id(text) from public, anon;
grant execute on function public.avf_pad_avf_id(text) to authenticated;

create policy avf_bestanden_lezen on storage.objects
  for select to authenticated
  using (bucket_id = 'avf' and public.mag_avf_lezen(public.avf_pad_avf_id(name)));

create policy avf_bestanden_toevoegen on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avf' and public.mag_avf_schrijven(public.avf_pad_avf_id(name)));

create policy avf_bestanden_wijzigen on storage.objects
  for update to authenticated
  using (bucket_id = 'avf' and public.mag_avf_schrijven(public.avf_pad_avf_id(name)))
  with check (bucket_id = 'avf' and public.mag_avf_schrijven(public.avf_pad_avf_id(name)));

create policy avf_bestanden_verwijderen on storage.objects
  for delete to authenticated
  using (bucket_id = 'avf' and public.mag_avf_schrijven(public.avf_pad_avf_id(name)));
