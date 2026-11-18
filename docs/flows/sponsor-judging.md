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

## Round 1: shortlist

Sponsors shortlist as many teams as they want. A presentation is about 5 minutes, so the 10:00 to 11:30 block fits about 18 teams per room. Around 20 is the realistic top end.

When they're done, the sponsor sends us the shortlist. That's all they do. We take it from there.

## Presentations: we build the schedule

Sponsors don't book times. We run the automation:

1. Every shortlisted team gets one 5 minute slot in each sponsor's room that shortlisted them.
2. A team is never double booked. If a team is on 3 sponsors' shortlists, its 3 slots never overlap: each one starts at least 10 minutes after the last one started, so there's a 5 minute gap to walk to the next room.
3. The schedule is rearranged automatically to make that work. Organizers don't move slots by hand.
4. If a team can't fit (too many teams, not enough slots), it's flagged for organizers instead of silently dropped.
5. Hackers get a Slack message with their room and time for each sponsor, and see the same on their dashboard. A hacker who isn't on Slack gets the same times by email.

## Round 2: top 5

From the teams that presented, each sponsor ranks their top 5 and sends it to us. A team that didn't present isn't in the round 2 list. Round 2 opens when an organizer presses "Open round 2" after presentations; until then sponsors see their sent shortlist and can't submit a top 5.

## Cheat check

The web team runs the cheat check on every team in any sponsor's top 5 before winners are announced.

## What the site does

- **Portal (`/sponsors/<id>/picks`):** browse the track's Devposts, score out of 10, shortlist. A "Send shortlist" step ends round 1. Once organizers open round 2, the same page switches to it: rank and submit the top 5, picked only from the teams that presented. Before that it shows the sent shortlist and says round 2 opens after presentations.
- **Organizer, Sponsor judging tab (`?tab=judging`):** who has sent a shortlist, a "Schedule presentations" button, the schedule by room and by team (with any team that couldn't fit), "Notify hackers", "Open round 2" (with a confirm; "Close round 2" undoes it), a By hacker view (every scheduled hacker by team with their slots and how they heard: Slack sent or emailed with the time, not on Slack, failed, not sent yet; filter by room or to Not reached), and Final results (each sponsor's submitted top 5 in rank order with Devpost link, the team's hackers and the submit time, or "Not submitted yet").
- **Scheduler rule:** slots are 5 minutes from 10:00, one room per sponsor. A team's presentations never overlap, and each starts at least 10 minutes after its previous one.
- **Hackers:** each team member gets a Slack DM with their rooms and times when the schedule is sent (or an email if Slack can't find them), and sees them on their dashboard once anyone on their team has been sent those times.
- **Notify, per member:** "Notify hackers" only messages members who don't have their current times yet (never sent, failed, or their times changed; someone emailed because they're not on Slack counts as reached), so pressing it twice or retrying never messages anyone twice. "Notify again" resends to everyone after a confirm. The tab lists members neither Slack nor email reached, and why. Scheduling again keeps members notified when their team's times don't change, and the confirm step says how many hackers who already have their times would get new ones.
- **Cheat check:** the top 5 teams go to the existing cheat check.
