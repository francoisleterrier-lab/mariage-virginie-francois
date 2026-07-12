-- ============================================================
--  Covoiturage : jour d'arrivée et jour de départ (aller / retour).
--  Colonnes nullables : les annonces existantes restent valides.
-- ============================================================

alter table public.covoiturage add column if not exists arrivee date;
alter table public.covoiturage add column if not exists depart  date;

-- Produit (parité de schéma).
alter table public.fpv_covoit  add column if not exists arrivee date;
alter table public.fpv_covoit  add column if not exists depart  date;
