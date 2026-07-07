-- ============================================================
-- Seed SQL — Quiz des Mariés V&F 2028
-- 12 questions principales (round 'main') + 6 questions Duel des Témoins (round 'witness')
-- Chrono : 39 s par question. 4 choix par question, clé correcte variable.
-- L'ordre des CHOIX est mélangé côté serveur par participant (seed guest_id) :
-- la position de la bonne réponse dans ce fichier n'a donc pas d'importance.
-- ============================================================

-- Pré-requis : la contrainte d'unicité de position doit être PAR MANCHE
-- (l'avenant ajoute la colonne round ; adapter la contrainte d'origine)
alter table public.quiz_questions drop constraint if exists quiz_questions_position_key;
create unique index if not exists uq_questions_round_position
  on public.quiz_questions (round, position);

-- Idempotence : purge des questions existantes avant re-seed
-- (NE PAS exécuter si le quiz est déjà en état 'open' — l'édition est verrouillée)
delete from public.quiz_answers;
delete from public.quiz_attempts;
delete from public.quiz_questions;

-- ============================================================
-- MANCHE PRINCIPALE (round = 'main')
-- ============================================================

insert into public.quiz_questions (position, body, choices, correct_key, time_limit_s, points, round) values

(1, 'Où est né François ?',
 '[{"key":"a","label":"Caen"},{"key":"b","label":"Cherbourg"},{"key":"c","label":"Le Havre"},{"key":"d","label":"Rouen"}]',
 'a', 15, 10, 'main'),

(2, 'Quel est le signe astrologique de Virginie ?',
 '[{"key":"a","label":"Scorpion"},{"key":"b","label":"Sagittaire"},{"key":"c","label":"Capricorne"},{"key":"d","label":"Balance"}]',
 'b', 15, 10, 'main'),

(3, 'Quel style musical Virginie et François adorent-ils tous les deux ?',
 '[{"key":"a","label":"Le rock"},{"key":"b","label":"Le rap"},{"key":"c","label":"L''électro"},{"key":"d","label":"La variété française"}]',
 'c', 15, 10, 'main'),

(4, 'À quel âge se sont-ils rencontrés pour la toute première fois ?',
 '[{"key":"a","label":"15 ans"},{"key":"b","label":"17 ans"},{"key":"c","label":"19 ans"},{"key":"d","label":"21 ans"}]',
 'b', 15, 10, 'main'),

(5, 'À quelle occasion s''étaient-ils vus pour la dernière fois, quand ils étaient plus jeunes ?',
 '[{"key":"a","label":"Un anniversaire"},{"key":"b","label":"Une soirée plage"},{"key":"c","label":"Un concert"},{"key":"d","label":"Une soirée bus"}]',
 'd', 15, 10, 'main'),

(6, 'Qui a recontacté l''autre ?',
 '[{"key":"a","label":"François"},{"key":"b","label":"Virginie"},{"key":"c","label":"Alan & Mélane ont comploté"},{"key":"d","label":"Le hasard des réseaux sociaux"}]',
 'a', 15, 10, 'main'),

(7, 'Quelle était l''excuse (officielle 😏) pour se revoir en 2022 ?',
 '[{"key":"a","label":"Rendre un vieux CD"},{"key":"b","label":"Prêter une voiture"},{"key":"c","label":"Aider pour un déménagement"},{"key":"d","label":"« Juste un café entre amis »"}]',
 'b', 15, 10, 'main'),

(8, 'Où se sont-ils revus ?',
 '[{"key":"a","label":"Dans un bar à Caen"},{"key":"b","label":"Sur un parking de supermarché"},{"key":"c","label":"Chez Alan & Mélane"},{"key":"d","label":"À la plage de Ouistreham"}]',
 'c', 15, 10, 'main'),

(9, 'Qui est venu embrasser l''autre en premier ?',
 '[{"key":"a","label":"François"},{"key":"b","label":"Virginie"},{"key":"c","label":"Les deux en même temps"},{"key":"d","label":"Personne ne s''en souvient 😏"}]',
 'b', 15, 10, 'main'),

(10, 'Où est née Virginie ?',
 '[{"key":"a","label":"Caen"},{"key":"b","label":"Le Havre"},{"key":"c","label":"Bayeux"},{"key":"d","label":"Cherbourg"}]',
 'd', 15, 10, 'main'),

(11, 'Quel est le signe astrologique de François ?',
 '[{"key":"a","label":"Lion"},{"key":"b","label":"Verseau"},{"key":"c","label":"Sagittaire"},{"key":"d","label":"Gémeaux"}]',
 'c', 15, 10, 'main'),

(12, 'Qui a demandé la main de l''autre ?',
 '[{"key":"a","label":"Virginie"},{"key":"b","label":"François"},{"key":"c","label":"Les deux en même temps"},{"key":"d","label":"Eden l''a fait pour eux 💚"}]',
 'b', 15, 10, 'main');

-- ============================================================
-- DUEL DES TÉMOINS (round = 'witness') — Alan vs Mélane
-- ============================================================

insert into public.quiz_questions (position, body, choices, correct_key, time_limit_s, points, round) values

(1, 'À quel événement François s''est-il blessé le bras ?',
 '[{"key":"a","label":"Le mariage de Tito"},{"key":"b","label":"L''enterrement de vie de garçon de Tito"},{"key":"c","label":"Un tournoi de foot entre amis"},{"key":"d","label":"La fameuse soirée bus"}]',
 'a', 15, 10, 'witness'),

(2, 'Où habitait François quand il a reçu Virginie ?',
 '[{"key":"a","label":"Verson"},{"key":"b","label":"Fontaine-Étoupefour"},{"key":"c","label":"Éterville"},{"key":"d","label":"Bretteville-sur-Odon"}]',
 'b', 15, 10, 'witness'),

(3, 'En quelle année Concept Immo Plus a-t-elle été créée ?',
 '[{"key":"a","label":"2019"},{"key":"b","label":"2020"},{"key":"c","label":"2021"},{"key":"d","label":"2022"}]',
 'c', 15, 10, 'witness'),

(4, 'Dans quelle ville se sont-ils revus pour la première fois ?',
 '[{"key":"a","label":"Caen"},{"key":"b","label":"Cabourg"},{"key":"c","label":"Deauville"},{"key":"d","label":"Lisieux"}]',
 'd', 15, 10, 'witness'),

(5, 'Quelle est la marque de voiture préférée de François ?',
 '[{"key":"a","label":"BMW"},{"key":"b","label":"Mercedes"},{"key":"c","label":"Audi"},{"key":"d","label":"Porsche"}]',
 'a', 15, 10, 'witness'),

(6, 'Quelle est la marque de voiture préférée de Virginie ?',
 '[{"key":"a","label":"BMW"},{"key":"b","label":"Volkswagen"},{"key":"c","label":"Mercedes"},{"key":"d","label":"Audi"}]',
 'd', 15, 10, 'witness');

-- ============================================================
-- Vérifications post-seed
-- ============================================================
-- select round, count(*) from public.quiz_questions group by round;
--   Attendu : main = 12, witness = 6
-- select round, position, correct_key from public.quiz_questions order by round, position;
--   Vérifier : aucune clé correcte identique plus de 2 fois d'affilée par manche.

-- Rappel configuration (déjà en place via les briefs, à vérifier) :
-- update public.app_settings set value = '{"text": "Une surprise attend les 3 premiers…"}' where key = 'quiz_prize_teaser';
-- update public.app_settings set value = '{"guest_ids": ["<UUID_ALAN>", "<UUID_MELANE>"]}' where key = 'quiz_witnesses';
--   ⚠️ Remplacer par les vrais guest_id d'Alan et Mélane (récupérables via l'admin ou : select id, first_name from public.guests;)
