-- Een lege tekst is geen verschijningsvorm: leeg betekent niets gekozen (null).
update public.avf set verschijningsvorm = null where verschijningsvorm = '';
alter table public.avf drop constraint avf_verschijningsvorm_opties;
alter table public.avf
  add constraint avf_verschijningsvorm_opties check (
    verschijningsvorm is null
    or (verschijningsvorm <> ''
        and string_to_array(verschijningsvorm, ', ') <@ array['Spel', 'Wedstrijd', 'Avontuur', 'Gezondheid', 'Recreatie', 'Show'])
  );
