-- Opdracht 2: de accentkleur van het meerdaagsethema komt uit de HAN-huisstijl:
-- rood, oranje, groen of blauw (docs/huisstijl.md).
alter table public.meerdaagsethema
  add constraint thema_accentkleur_han check (
    accentkleur is null or upper(accentkleur) in ('#E50056', '#F5A846', '#7AC48E', '#6AC3ED')
  );
