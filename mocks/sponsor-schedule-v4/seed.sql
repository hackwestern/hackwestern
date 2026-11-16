-- Local-only seed for the T46 screenshots (DB hackwestern_sd_sched2).
INSERT INTO sponsor_judging_sponsor (id, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'Scotiabank')
ON CONFLICT DO NOTHING;
INSERT INTO "user" (id, name, email, type)
VALUES ('org-shot-1', 'Jazz Organizer', 'organizer@example.com', 'organizer')
ON CONFLICT DO NOTHING;
