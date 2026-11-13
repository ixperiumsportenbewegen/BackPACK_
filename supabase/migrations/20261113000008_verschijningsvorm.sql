-- Opdracht 3 (aanpassing): de verschijningsvorm is een keuze uit zes opties, waarvan er meerdere
-- gekozen mogen worden. Opslag blijft één tekstveld: de gekozen opties gescheiden door ", ".
alter table public.avf drop constraint if exists avf_verschijningsvorm_check;

-- Oude waarden die niet meer bestaan (zoals "Tocht", "Workshop" en "Anders") worden geleegd;
-- de projectgroep kiest dan opnieuw uit de nieuwe opties.
update public.avf
set verschijningsvorm = null
where verschijningsvorm is not null
  and not (string_to_array(verschijningsvorm, ', ') <@ array['Spel', 'Wedstrijd', 'Avontuur', 'Gezondheid', 'Recreatie', 'Show']);
alter table public.avf
  add constraint avf_verschijningsvorm_opties check (
    verschijningsvorm is null
    or string_to_array(verschijningsvorm, ', ') <@ array['Spel', 'Wedstrijd', 'Avontuur', 'Gezondheid', 'Recreatie', 'Show']
  );
