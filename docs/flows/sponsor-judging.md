# Sponsor judging on Sunday (Jazz, 2026-11-18)

How sponsor track judging should run, and what the site does at each step.

## The day

| Time | What happens |
|---|---|
| 8:30 to 9:00 | Sponsor judging workshop. We show sponsors the portal. |
| 9:00 to 10:00 | Round 1. Sponsors go through the Devposts in their track on the portal and shortlist teams. |
| 10:00 to 11:30 | Presentations. Each sponsor track has a room and shortlisted teams come in to present. |
| After 11:30 | Round 2. Each sponsor picks their top 5 from the teams that presented and sends it to us. |
| Then | The web team runs the cheat check on every top 5 team. |

Sponsor rooms so far: Scotiabank in Rm 2110, Canada Life in Rm 2230, QNX in Rm 2235.

## Who judges: prize track sponsors only

Only sponsors with a prize track judge: Scotiabank, Sunlife, Canada Life, QNX, TinyFish and PCBWay. The list is in `src/content/sponsor-prize-tracks.ts`, so edit it there. Names match loosely (case, spaces and punctuation don't matter, and "Sun Life Financial" counts as Sunlife). A sponsor without a track sees a locked "No prize track" tile instead of Judging on their portal, can't open judging, and is left out of scheduling and the organizer judging lists.

## Round 1: shortlist

Sponsors shortlist up to 15 teams (Jazz, 2026-11-19). Each presentation slot is 6 minutes: a 3 minute pitch, 2 minutes of Q&A and 1 minute to switch teams, so the 10:00 to 11:30 block fits exactly 15 per room. The cap comes from the slot count (`SHORTLIST_MAX` in `src/lib/sponsor-presentations.ts`): sponsors can save more while browsing, but Send shortlist stays off until they're down to 15, and the server refuses more.

When they're done, the sponsor sends us the shortlist. That's all they do. We take it from there.

## Presentations: we build the schedule

Sponsors don't book times. We run the automation:

1. Every shortlisted team gets one 6 minute slot in each sponsor's room that shortlisted them.
2. A team is never double booked. If a team is on 3 sponsors' shortlists, its 3 slots never overlap: each one starts at least 10 minutes after the last one started, so there are at least 4 minutes to walk to the next room.
3. The schedule is rearranged automatically to make that work. Organizers don't move slots by hand.
4. If a team can't fit (too many teams, not enough slots), it's flagged for organizers instead of silently dropped.
5. Hackers get a Slack message with their room and time for each sponsor, and see the same on their dashboard. A hacker who isn't on Slack gets the same times by email.
6. Once scheduled, sponsors see each team's presentation time on their shortlist, with "Each presentation: 3 min pitch · 2 min Q&A".

## Round 2: top 5

From the teams that presented, each sponsor ranks their top 5 and sends it to us. A team that didn't present isn't in the round 2 list. Round 2 opens when an organizer presses "Open round 2" after presentations (it can't open until at least one team has a presentation slot); until then sponsors see their sent shortlist and can't submit a top 5.

A sponsor with no presentation slot can't rank in round 2 (Jazz). Nobody presented to them, so the page says round 2 is locked and to ask us to schedule again, and the server refuses their top 5.

## Cheat check

The web team runs the cheat check on every team in any sponsor's top 5 before winners are announced.

## What the site does

- **Portal (`/sponsors/<id>/picks`, prize track sponsors only):** browse the track's Devposts, score out of 10, shortlist. A "Send shortlist" step ends round 1. Once organizers open round 2, the same page switches to it: rank and submit the top 5, picked only from the teams that presented. Before that it shows the sent shortlist and says round 2 opens after presentations.
- **Organizer, Sponsor judging tab (`?tab=judging`):** who has sent a shortlist, a "Schedule presentations" button, the schedule by room and by team (with any team that couldn't fit), "Notify hackers", "Open round 2" (with a confirm; "Close round 2" undoes it), a By hacker view (every scheduled hacker by team with their slots and how they heard: Slack sent or emailed with the time, not on Slack, failed, not sent yet; filter by room or to Not reached), and Final results (each sponsor's submitted top 5 in rank order with Devpost link, the team's hackers and the submit time, or "Not submitted yet").
- **Scheduler rule:** slots are 6 minutes from 10:00 (15 per room), one room per sponsor. A team's presentations never overlap, and each starts at least 10 minutes after its previous one.
- **Hackers:** each team member gets a Slack DM with their rooms and times when the schedule is sent (or an email if Slack can't find them), and sees them on their dashboard once anyone on their team has been sent those times. Slack looks them up by the email they use on Slack (set in the notification center on /live) first, then the email they applied with; the email always goes to the email they applied with. The times also show in the /live notification center with how they were sent (Slack DM or Email).
- **Notify, per member:** "Notify hackers" only messages members who don't have their current times yet (never sent, failed, or their times changed; someone emailed because they're not on Slack counts as reached), so pressing it twice or retrying never messages anyone twice. "Notify again" resends to everyone after a confirm. The tab lists members neither Slack nor email reached, and why. Scheduling again keeps members notified when their team's times don't change, and the confirm step says how many hackers who already have their times would get new ones.
- **Cheat check:** the top 5 teams go to the existing cheat check.
- **Sponsor Judging tab:** the app writes a "Sponsor Judging" tab in the Spon Team RUN OF SHOW sheet, one way from the database. It's rewritten whenever a shortlist is sent, presentations are scheduled, hackers are notified or a top 5 is submitted, and when an organizer presses "Sync to sheet" on the presentations panel. Edits in the tab are overwritten. It has a note row with the update time, then two tables:
  - **Sponsors:** Sponsor | In person / Digital | Judging room | Round 1 status | Shortlist sent | Shortlist (team IDs) | Round 2 status | Top 5 sent | 1st place … 5th place | Notes (one row per prize track sponsor, including ones not registered yet; places read "team ID · Devpost link").
  - **Presentations:** Sponsor | Team ID | Team | Members | Time | Room | Notified (one row per shortlisted or scheduled team per sponsor; time and room only for a placed slot; Notified is Slack, Email, failed, or a mix).
- **Judging Scores tab (backup):** one block per in-person prize track sponsor (PCBWay is digital, so it has none). Each block is a title row (sponsor, room), a header row (Time | Team ID | Devpost | one column per rep, up to 6 | Average), then one row per presenting team in presentation order. The app fills it as reps score and when presentations are scheduled (`src/server/api/utils/sponsor-judging-scores-mirror.ts`). If the app is down, reps type scores into the same cells and organizers copy them in later, so the app never clobbers them:
  - It reads the tab first and writes only cells it has a value for: a score, a team's time, ID and link, a rep's name over an empty or "Rep N" header, and the Average formula into an empty cell.
  - It never writes an empty value, so it never blanks a cell. A score a rep clears in the app stays in the sheet.
  - It never touches columns right of Average, or rows outside its blocks. A block is found by the sponsor's name in column A, a team by its ID in column B, a rep by their name in the header.

  Blank cells mean the app doesn't have that data yet. The run-of-show service account needs Editor on the sheet; until then writes fail quietly (logged once) and judging still works. Only production writes to the sheet (or a dev server started with `SHEET_WRITES=1`); tests never do.
