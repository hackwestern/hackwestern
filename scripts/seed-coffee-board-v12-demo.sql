-- LOCAL ONLY. Demo data for the organizer coffee chat board (mock
-- organizer-coffee-v12), so every flow has something to click on a local
-- copy of the data. Never run against production.
--
--   docker exec -i hackwestern_db psql -U postgres -d <local db> < scripts/seed-coffee-board-v12-demo.sql
--
-- Adds, under Sun Life (it must be registered; its workshop comes from the
-- run-of-show sheet, 2:30-3:30, which blocks 2-3 and 3-4 for its reps, so
-- the board needs the sheet credentials in .env to unlock):
-- - Two demo reps: "Demo Ana" (free 10-11, 11-12, 1-2; 4 chats) and
--   "Demo Bo" (free 11-12, 4-5; 2 chats), with phone numbers.
-- - A SENT chat: Ana in Rm 1354 at 10-11 (two group chats, 10:00 and 10:30)
--   with five demo hackers: 3 Accepted, 2 Waiting (answer by tomorrow).
-- - A DRAFT chat: Bo in Ivey Rm 1348 at 11-12. Drag it to a lit cell, to
--   10-11 (Bo isn't free: the two-step check), to 2-3 (the workshop:
--   refused), or onto the Remove zone (Undo).
-- - A FORCED draft: Ana in Rm 1354 at 4-5 (she didn't tick it: "Not free").
-- - A BOOKING: "Demo mentors" in Ivey Rm 1358 at 1-2, with a note.
-- - The line: "Demo Fay" put first in line for Sun Life, then "Demo Gus",
--   so Remove a hacker has a next in line and Put someone first in line
--   can use "demo-cc-hana" (not invited, not in line).
--
-- Demo ids only: reps, placements and the booking start "dddddddd-", users
-- start "demo-cc-". Rerunnable: it deletes all of them first. A cell or rep
-- session that's already taken by real data is skipped, not overwritten.

BEGIN;

-- Clean up the last run.
DELETE FROM coffee_chat WHERE user_id LIKE 'demo-cc-%' OR placement_id::text LIKE 'dddddddd-%';
DELETE FROM coffee_chat_line WHERE user_id LIKE 'demo-cc-%';
DELETE FROM coffee_chat_placement WHERE id::text LIKE 'dddddddd-%' OR rep_id::text LIKE 'dddddddd-%';
DELETE FROM coffee_chat_room_booking WHERE id::text LIKE 'dddddddd-%';
DELETE FROM coffee_chat_rep_session WHERE rep_id::text LIKE 'dddddddd-%';
DELETE FROM coffee_chat_rep WHERE id::text LIKE 'dddddddd-%';
DELETE FROM application WHERE user_id LIKE 'demo-cc-%';
DELETE FROM "user" WHERE id LIKE 'demo-cc-%';

-- Demo hackers: admitted (CONFIRMED) and sharing with sponsors.
INSERT INTO "user" (id, email, name, type, hacker_id)
SELECT 'demo-cc-' || h, 'demo.cc.' || h || '@test.local', 'Demo ' || initcap(h), 'hacker', 'demo-cc-' || h
FROM unnest(ARRAY['ada', 'ben', 'cleo', 'dev', 'eli', 'fay', 'gus', 'hana']) h;

INSERT INTO application (user_id, github_link, linkedin_link, devpost_link, first_name, last_name, status, agree_share_with_sponsors)
SELECT 'demo-cc-' || h, '', '', '', initcap(h), 'Demo', 'CONFIRMED', true
FROM unnest(ARRAY['ada', 'ben', 'cleo', 'dev', 'eli', 'fay', 'gus', 'hana']) h;

-- Sun Life's preferences, if the copy has none yet (groups of 3).
INSERT INTO coffee_chat_pref (sponsor_id, hackers_per_chat, submitted_at)
SELECT s.id, 3, now() FROM sponsor_judging_sponsor s WHERE s.name = 'Sun Life'
ON CONFLICT (sponsor_id) DO NOTHING;

-- Demo reps.
INSERT INTO coffee_chat_rep (id, sponsor_id, name, phone, is_primary, chats_wanted, position)
SELECT v.id::uuid, s.id, v.name, v.phone, false, v.wanted, v.pos
FROM sponsor_judging_sponsor s,
  (VALUES
    ('dddddddd-0000-4000-8000-0000000000a1', 'Demo Ana', '5195550190', 4, 90),
    ('dddddddd-0000-4000-8000-0000000000a2', 'Demo Bo', '5195550191', 2, 91)
  ) v(id, name, phone, wanted, pos)
WHERE s.name = 'Sun Life';

INSERT INTO coffee_chat_rep_session (rep_id, session_id)
SELECT v.rep::uuid, v.s FROM (VALUES
  ('dddddddd-0000-4000-8000-0000000000a1', '10'),
  ('dddddddd-0000-4000-8000-0000000000a1', '11'),
  ('dddddddd-0000-4000-8000-0000000000a1', '13'),
  ('dddddddd-0000-4000-8000-0000000000a2', '11'),
  ('dddddddd-0000-4000-8000-0000000000a2', '16')
) v(rep, s)
WHERE EXISTS (SELECT 1 FROM coffee_chat_rep r WHERE r.id = v.rep::uuid);

-- Chats: sent, draft and forced (each skipped if its cell is taken).
INSERT INTO coffee_chat_placement (id, rep_id, session_id, room, pinned, status, sent_at, forced)
SELECT v.id::uuid, v.rep::uuid, v.s, v.room, v.pinned, v.status::coffee_chat_placement_status,
  CASE WHEN v.status = 'sent' THEN now() END, v.forced
FROM (VALUES
  ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-0000000000a1', '10', '1354', true, 'sent', false),
  ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000a2', '11', '1348', false, 'draft', false),
  ('dddddddd-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-0000000000a1', '16', '1354', true, 'draft', true)
) v(id, rep, s, room, pinned, status, forced)
WHERE EXISTS (SELECT 1 FROM coffee_chat_rep r WHERE r.id = v.rep::uuid)
  AND NOT EXISTS (SELECT 1 FROM coffee_chat_placement p WHERE p.room = v.room AND p.session_id = v.s)
  AND NOT EXISTS (SELECT 1 FROM coffee_chat_room_booking b WHERE b.room = v.room AND b.session_id = v.s);

-- A booking.
INSERT INTO coffee_chat_room_booking (id, session_id, room, label, note, created_by)
SELECT 'dddddddd-0000-4000-8000-0000000000b1'::uuid, '13', '1358', 'Demo mentors', 'Resume reviews, bring a laptop', NULL
WHERE NOT EXISTS (SELECT 1 FROM coffee_chat_placement p WHERE p.room = '1358' AND p.session_id = '13')
  AND NOT EXISTS (SELECT 1 FROM coffee_chat_room_booking b WHERE b.room = '1358' AND b.session_id = '13');

-- The sent chat's hackers: 10:00 Ada (accepted), Ben (accepted), Cleo
-- (waiting); 10:30 Dev (waiting), Eli (accepted).
INSERT INTO coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status, rep_name, placement_id, round, expires_at, source, responded_at)
SELECT r.sponsor_id, 'demo-cc-' || v.h, '1354', v.slot, 30, v.status::coffee_chat_status, 'Demo Ana', p.id, 1,
  now() + interval '1 day', v.source, CASE WHEN v.status = 'accepted' THEN now() END
FROM coffee_chat_placement p
JOIN coffee_chat_rep r ON r.id = p.rep_id,
  (VALUES
    ('ada', '10:00', 'accepted', 'scanned'),
    ('ben', '10:00', 'accepted', 'shortlist'),
    ('cleo', '10:00', 'pending', 'interested'),
    ('dev', '10:30', 'pending', 'shortlist'),
    ('eli', '10:30', 'accepted', 'interested')
  ) v(h, slot, status, source)
WHERE p.id = 'dddddddd-0000-4000-8000-000000000002';

-- Next in line for Sun Life: Fay first (newest), then Gus.
INSERT INTO coffee_chat_line (sponsor_id, user_id, kind, added_by, created_at)
SELECT s.id, v.u, 'front', NULL, now() - v.ago
FROM sponsor_judging_sponsor s,
  (VALUES ('demo-cc-fay', interval '0 minutes'), ('demo-cc-gus', interval '5 minutes')) v(u, ago)
WHERE s.name = 'Sun Life';

COMMIT;
