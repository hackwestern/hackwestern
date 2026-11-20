-- LOCAL ONLY. Demo data for the organizer Judging board (mock
-- organizer-judging-board-v2): QNX and TinyFish sponsors, 30 demo teams
-- with members, shortlists for Scotiabank, Canada Life, QNX and TinyFish
-- (Sun Life hasn't sent), board rooms for the three in-room sponsors, and a
-- few scores. Rerunnable: it deletes the demo rows (ids starting "DEMO")
-- first. Never run against production.
--
--   docker exec -i hackwestern_db psql -U postgres -d <local db> < scripts/seed-judging-board-demo.sql
--
-- Then set any room on the board (or send a shortlist) to build the
-- schedule.

BEGIN;

DELETE FROM sponsor_presentation_confirm WHERE team_id LIKE 'DEMO%';
DELETE FROM sponsor_presentation_notice WHERE team_id LIKE 'DEMO%';
DELETE FROM sponsor_presentation WHERE team_id LIKE 'DEMO%';
DELETE FROM sponsor_team_score WHERE team_id LIKE 'DEMO%';
DELETE FROM application WHERE user_id LIKE 'demo-judge-%';
DELETE FROM day_of_registration WHERE user_id LIKE 'demo-judge-%';
DELETE FROM "user" WHERE id LIKE 'demo-judge-%';
DELETE FROM team WHERE id LIKE 'DEMO%';

INSERT INTO sponsor_judging_sponsor (name)
SELECT n FROM (VALUES ('QNX'), ('TinyFish')) v(n)
WHERE NOT EXISTS (SELECT 1 FROM sponsor_judging_sponsor s WHERE s.name = v.n);

-- 30 teams: DEMO001..DEMO030, with project names from the mock.
INSERT INTO team (id, name, devpost_url, github_url, submission_status, "joinCode")
SELECT 'DEMO' || lpad(i::text, 3, '0'),
       (ARRAY['Budget Buddy','ClaimSnap','Wellness Wallet','PillPal','Policy Pal',
              'Rx Reminder','Life Ledger','SafeRoute','Accessible Transit Route Planner for Low-Vision Riders',
              'Pocket Physio','Lidar Lane Assist','Robo Sorter','Edge Vision Kit','Drive Diag',
              'Habit Hero','Smart Shelf','CoinCompass','Rent Ready','FraudFence','Tap to Save',
              'Credit Coach','Split It','AgentDesk','Scrape Sense','Form Filler','Browser Butler',
              'Price Watch','Job Hunt Bot','Study Sync','Green Commute'])[i],
       'https://devpost.com/software/demo-' || i,
       'https://github.com/demo/project-' || i,
       'submitted',
       'DJ' || lpad(i::text, 4, '0')
FROM generate_series(1, 30) i;

-- 2-4 members each; every third member checked in, team 4 (PillPal) 1 of 4,
-- teams 12 and 27 nobody.
INSERT INTO "user" (id, email, name, type, team_id)
SELECT 'demo-judge-' || t || '-' || m,
       'demo-judge-' || t || '-' || m || '@example.com',
       'Demo ' || t || '-' || m, 'hacker',
       'DEMO' || lpad(t::text, 3, '0')
FROM generate_series(1, 30) t, generate_series(1, 4) m
WHERE m <= 2 + (t % 3);

INSERT INTO application (user_id, status, first_name, last_name, name, major, year_of_study,
                         github_link, linkedin_link, devpost_link, resume_link)
SELECT u.id, 'CONFIRMED',
       (ARRAY['Kira','Rosa','Zoe','Chidi','Liam','Ava','Noah','Mia'])[1 + (abs(hashtext(u.id)) % 8)],
       (ARRAY['Chen','Kim','Singh','Mensah','Patel','Nguyen','Brown','Lopez'])[1 + (abs(hashtext(u.id || 'x')) % 8)],
       (ARRAY['McMaster University','University of Toronto','Western University','York University'])[1 + (abs(hashtext(u.id || 's')) % 4)],
       'Computer Science', '3rd',
       'https://github.com/' || replace(u.id, '-', ''),
       'https://linkedin.com/in/' || replace(u.id, '-', ''),
       'https://devpost.com/' || replace(u.id, '-', ''),
       CASE WHEN abs(hashtext(u.id)) % 2 = 0 THEN 'https://example.com/resume.pdf' END
FROM "user" u WHERE u.id LIKE 'demo-judge-%';

INSERT INTO day_of_registration (user_id, approved, signed_in_at)
SELECT u.id, true, now()
FROM "user" u
WHERE u.id LIKE 'demo-judge-%'
  AND u.team_id NOT IN ('DEMO012', 'DEMO027')
  AND (u.id LIKE 'demo-judge-4-1' OR (u.team_id <> 'DEMO004' AND abs(hashtext(u.id)) % 3 = 0));

-- Shortlists (Sun Life hasn't sent). Teams 4, 3, 8, 9 are on two lists.
DELETE FROM sponsor_shortlist_send
WHERE sponsor_id IN (SELECT id FROM sponsor_judging_sponsor
                     WHERE name IN ('Scotiabank','Canada Life','QNX','TinyFish','Sun Life'));
INSERT INTO sponsor_shortlist_send (sponsor_id, team_ids)
SELECT s.id, v.ids
FROM sponsor_judging_sponsor s
JOIN (VALUES
  ('Scotiabank',  ARRAY['DEMO003','DEMO008','DEMO009','DEMO017','DEMO018','DEMO019','DEMO020','DEMO021','DEMO022']),
  ('Canada Life', ARRAY['DEMO001','DEMO002','DEMO003','DEMO004','DEMO005','DEMO006','DEMO007']),
  ('QNX',         ARRAY['DEMO004','DEMO008','DEMO009','DEMO010','DEMO011','DEMO012','DEMO013','DEMO014','DEMO015','DEMO016']),
  ('TinyFish',    ARRAY['DEMO023','DEMO024','DEMO025','DEMO026','DEMO027','DEMO028'])
) v(name, ids) ON v.name = s.name;

-- Board rooms (the run of show's defaults); Sun Life unset.
DELETE FROM sponsor_judging_room;
INSERT INTO sponsor_judging_room (sponsor_id, room)
SELECT s.id, v.room
FROM sponsor_judging_sponsor s
JOIN (VALUES ('Scotiabank','Rm 2110'), ('Canada Life','Rm 2230'), ('QNX','Rm 2235')) v(name, room)
  ON v.name = s.name;

-- Leads with 555 numbers for QNX and TinyFish.
INSERT INTO coffee_chat_rep (sponsor_id, name, phone, is_primary, position)
SELECT s.id, v.rep, v.phone, true, 0
FROM sponsor_judging_sponsor s
JOIN (VALUES ('QNX','Hana R.','5195550111'), ('TinyFish','Sam K.','5195550112')) v(name, rep, phone)
  ON v.name = s.name
WHERE NOT EXISTS (SELECT 1 FROM coffee_chat_rep r WHERE r.sponsor_id = s.id);

-- A few scores: Scotiabank and QNX have started.
INSERT INTO sponsor_team_score (sponsor_id, team_id, judge_name, score_halves)
SELECT s.id, v.team, v.judge, v.halves
FROM sponsor_judging_sponsor s
JOIN (VALUES ('Scotiabank','DEMO003','Marcus O.',16), ('Scotiabank','DEMO003','Aisha K.',15),
             ('Scotiabank','DEMO008','Marcus O.',14), ('QNX','DEMO004','Hana R.',17))
  v(name, team, judge, halves) ON v.name = s.name;

COMMIT;
