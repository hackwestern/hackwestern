# PARKED: tracked sponsor help requests (designed 2026-11-19, not built)

Turned off by Jazz on 2026-11-19 ("get rid of that system, but leave the details in case I want to rebuild it"). For the event, sponsors message their HW lead directly, and Noah is the emergency contact (see docs/decisions.md, "Jazz's answers to the full plan").

## The design, if rebuilt
1. Sponsor taps "Get help" in the portal: message + required name + call-back phone (prefilled from their primary rep, editable). Help is a modal; confirmation "Sent. We'll contact you at <phone>." with no internal routing text.
2. The app sends a Slack DM to the sponsor's HW lead (looked up by the lead's login email via users.lookupByEmail; HW Contacts "Login email" column). If the lead is off shift (RUN OF SHOW availability / on-call shifts), it goes to whoever is on call instead.
3. The DM has buttons [I'm on it] [Text them] (Slack interactive buttons, not emoji reactions, so the app records who and when).
4. The organizer dashboard shows it in a "Sponsor requested help" section / at the top of the Now table with a timer ("Sun Life · 2 min ago · waiting"); your own sponsors' requests highlighted, all visible to everyone so anyone can take one.
5. I'm on it (Slack or dashboard) → "Noah is on it" on the dashboard and "Noah is on the way" on the sponsor's portal → Resolved moves it to Done today.
6. No response in 5 minutes → re-post to the spon team Slack channel.
Mocks that show it: mocks/organizer-my-sponsors-v2 and -v3 (Now table help rows, Needs attention), mocks/sponsor-portal-flow-hacker-v4..v6 (Help modal).
Decisions: docs/decisions.md entries "Help = text your lead…", "Sponsor requested help is tracked…", superseded by "Jazz's answers to the full plan" (2026-11-19).
