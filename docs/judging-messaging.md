# Judging messaging, Sunday Nov 22

How to get the judging rules to hackers and judges with the least new work. Judging runs 11:30 AM to 1:00 PM in the Grand Hall (SEI 1110).

## Easiest way out, in order

1. **Edit the Slack messages that are already scheduled.** The hacker Slack bot already sends #74 (9:00, "Hacking ends + judging info") and #76 (11:20, "Main Judging") from `context/HW13_Notification_Schedule.csv`. Swap in the text below and nothing new has to be set up. Send the rules at 9:00, not only at 11:20. 10 minutes before is too late for teams to find their table and open the page.
2. **Put the briefings on the screens.** At the 8:30 judge workshop show `hackwestern.com/judging-tour/judges`. In the Grand Hall from about 11:00 show `hackwestern.com/judging-tour/hackers` until round 1 starts, then switch to the round clock.
3. **One message to judges** after table assignments are published at 9:00 (the run of show gives judges 20 minutes to flag teams they know). Slack DM or email, same text.
4. **Paper only if you're printing anyway.** The run of show already prints 70 numbered judging pages. If there's time, the table tent mock (v4) can replace them so every table carries the QR code and the rules.

## Hackers: replace #74 (9:00)

> Hacking is over. Nice work this weekend.
>
> Main judging runs 11:30 AM to 1:00 PM in the Grand Hall. Find your table number at hackwestern.com/rounds (log in first). Set up there and stay there.
>
> How it works: about 7 rounds. Each round a judge either comes to your table or you're idle that round. You get 3 minutes to demo and 2 minutes of Q&A, then judges have 1:30 to move. One big clock times everything.
>
> No slides. Show the project working.
>
> Don't leave your table. If a judge comes and nobody is there, your team is disqualified.
>
> What judges mark you on, and the full walkthrough: hackwestern.com/judging-tour/hackers
>
> Sponsor track shortlists are out at 9:45. If you're selected you'll hear on Slack. Link your Slack and email on hackwestern.com/live.

## Hackers: replace #76 (11:20)

> Main judging starts at 11:30 in the Grand Hall. Go to your table now and open hackwestern.com/rounds.
>
> 3 minute demo, 2 minutes of Q&A, 1:30 for judges to move. No slides. Not finished? Demo anyway.
>
> Stay at your table the whole time. An empty table gets disqualified. If your page says a judge is coming and nobody shows up after a minute, press Judge missing.
>
> Entered an MLH track? Someone from MLH will come by to judge it separately.
>
> After the rounds, walk around and see other projects until 1:00.

## Judges: one message after 9:00

> Hi, thanks for judging Hack Western 13.
>
> Before 9:20: make an account at hackwestern.com/register with the email you gave us and verify it. Then open hackwestern.com/judge. You'll see "These are your teams". If you know anyone on one of them, send that team's table number to Luca on Slack and we'll swap it.
>
> Judging runs 11:30 AM to 1:00 PM in the Grand Hall. Each round: 3 minute demo, 2 minutes of Q&A, 1:30 to walk to your next table. Your phone tells you where to go.
>
> Score 5 criteria from 1 to 10. 5 is average, 9 is a project you see winning. Super like the ones that stand out. Don't worry about completeness, the web team marks that.
>
> After your last table, stay for the catch-up round, re-score once, submit, then walk around until 1:00.
>
> Full walkthrough: hackwestern.com/judging-tour/judges

## Emcee, 30 seconds before round 1

> Judging starts now. Stay at your table for every round. If a judge comes and your table is empty, you're disqualified. Each visit is a 3 minute demo and 2 minutes of questions. No slides. Watch the clock on the screen, and open hackwestern.com/rounds to see if a judge is coming to you this round.

## Check before sending

- These links only work once PR #1266 is merged and deployed: `/judging-tour`, `/judging-tour/judges`, `/judging-tour/hackers`, and the login redirect back to `/rounds`.
- Round length in the control room: 390 seconds (6:30).
- Old drafts said judging starts at 11:45. Now it's 11:30 everywhere.
