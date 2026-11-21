# Judging room board (organizer)

> **Built 2026-11-19 from mock organizer-judging-board-v2 with Jazz's changes** (docs/decisions.md). Where this spec and the build differ, the build wins: no suggested fixes, Auto-assign or "+ Add a room" (3 rooms + "Other…"); team status is only Invite not sent / Waiting / Accepted (one member confirming on Slack or /live accepts for the team); no presenting/presented tracking; remote sponsors' teams don't present; the schedule rebuilds itself on every shortlist send and room change and never moves a time already given. Code: `src/components/sponsors/organizer/judging-board/`, `src/lib/judging-board.ts`, `src/server/api/utils/judging-board-data.ts`, `presentation-schedule.ts`, `presentation-confirm.ts`.

Jazz, 2026-11-19. The organizer Judging tab works like the coffee chat board: see each prize-track sponsor's details, a room calendar, suggested fixes, and assign sponsors to rooms. Round 1 presentations run Sunday 10:00–11:30.

## What sponsors do (no change to timing)
- Sponsors don't pick times. Every presentation happens 10:00–11:30, and the app slots their teams in 6-minute slots (3 min pitch, 2 min Q&A, 1 min switch).
- They pick as many teams as they want to see in person, up to 15. Their flow says: "Pick as many as you like. You don't have to fill all 15."
- After presentations, they submit a ranked top 5.

## Organizer board, the same UX as the coffee chat board
1. **Sponsors band:** one row per in-person prize-track sponsor (digital ones like PCBWay are listed separately, for Devpost entry only). Each row shows:
   - shortlist: sent or not, and how many teams
   - judging profiles: how many reps have judged (distinct judge names in sponsor_team_score)
   - room
   - status chip: "Shortlist not sent", "Needs a room", "Room set", "Scheduled", "Judging", "Top 5 in"
   - problem flags shown separately

   Opening a row shows the details: teams with time slots, reps, scores so far.
2. **Room calendar:** rooms down the side, 10:00–11:30 across (6-minute ticks). Each cell shows the sponsor holding that room for the window.
   - Default rooms: Rm 2230, Rm 2235 and Rm 2110.
   - **+ Add a room** adds another for the event (name and optional seats).
3. **Schedule view** (a toggle beside the calendar): per room, the teams in presentation order with time, team ID + Devpost link, and status (invited/notified, presented, scored by N reps).
4. **Suggested fixes**, problem → why → fix → Apply:
   - more sponsors than rooms ("Add a room")
   - sponsor without a room ("Put in Rm 2235")
   - a team on two shortlists with less than 10 min between slots ("Swap slots")
   - shortlist not sent by 9:30 ("Text their lead")
   - sponsor with no reps judging yet
5. **Assign:**
   - Auto-assign fills rooms: one sponsor per room for the whole window, most teams first.
   - Manual moves are pinned and kept on re-run.
   - A room holds one sponsor; a sponsor has one room.
   - Remote sponsors (TinyFish) show "Remote (judges online)" and take no room.
6. **Schedule presentations** stays as the action that slots teams into the assigned rooms; it re-runs when a room changes.

## Data
- Room assignments and added rooms live in the database (new tables, the same pattern as coffee_chat_placement / coffee_chat_room_booking).
- The sheet's Sponsor Day-Of "Judging room" column is mirrored from the app (writes only in production).
- Existing judging rooms already on the sheet seed the first assignment.

## Not doing
Sponsors picking time slots; several sponsors sharing one room in the window.

## Related: the sponsor's Today page (Jazz, 2026-11-19)
- Today shows only today's steps. "Look ahead" opens the next days, and past days sit behind "Earlier".
- Friday starts at the 5:00 workshop; leads meet sponsors in person before they have the dashboard.
- The speaker check-in shows only for companies speaking at the opening ceremony.
- The Saturday booth is optional ("Staff your booth as long as you like").
- Top 5 is due by 12:00 PM Sunday; the round-1 shortlist (up to 15) by 9:30 AM.
