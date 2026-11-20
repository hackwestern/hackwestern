# Sponsor Chats page, with Jazz's review changes (v3)

Version 3 of the sponsor Chats mock for Hack Western 13. It's still one static page, `index.html`, in vanilla HTML, CSS and JS, with no build step.

Open it at http://127.0.0.1:3040/mocks/sponsor-chats-v3/index.html?stage=prefs#home

v2 is unchanged at `mocks/sponsor-chats-v2/`. Its README covers Schedule and Map, and v1's README covers the stages, Scan, the warnings and the mock panel. All of that is the same in v3.

## What changed from v2

1. **The availability grid starts all ticked.** "Fill in a demo team" now gives every rep every open session, the same as adding a rep by hand already did. The two sessions blocked by Sun Life's workshop (2–3 and 3–4) stay unticked and locked. The hint still says "Untick any time a rep isn't free."
   - The stage presets (Preferences sent and later) still load the availability this sponsor already sent, with some times unticked. That's their own answer, and the confirmed Schedule is built from it.
2. **Step 1 is "Send availability" everywhere.** That covers the 2-step line, the Not started card, the flow heading, the step rail ("Send availability parts"; the middle part is now "Availability"), the submit button, the "✓ Availability sent · Change" line, Home's Friday step and the toast. "Next: Chatting preferences" is now "Next: Availability", and the card inside the flow is called "When your team is free". Lines about the chat times we send back ("We'll confirm your chat times by 10 PM") stay as they are, because those are the confirmed times, not step 1.
3. **The shortlist shows all 40 hackers.** 16 more fake hackers were added, with the same fields (first name and last initial, school, program, year, role, skills, interests).
   - The list opens on Everyone, under "40 hackers interested in Sun Life", and shows 10 at a time with Previous / Next ("1–10 of 40").
   - One at a time says "Hacker 1 of 40 · 40 hackers left to look at".
   - People met at the booth are pinned first in both views. In the list they sit in a "Met at your booth" group on page 1. In One at a time their card is first, tagged "Invited first", with a single Next button, since they're already invited and can't be shortlisted.
4. **Profile links are icons.** Each one is a 44 px icon button with an aria-label ("Avery K.'s LinkedIn") and a title tooltip. LinkedIn, GitHub and Devpost use their filled logos in brand colour. Résumé (a document) and Website (a globe) are line icons in the link blue. Not every hacker has every link now, and only the icons a hacker has are shown.
5. **Home's Key rooms follow the stage.** Before Confirmed, the coffee chats row reads "Coffee chats · Rooms assigned Fri 10 PM". From Confirmed it lists the real rooms ("Rm 2242, Rm 2241, Rm 2243 · Ivey Rm 1352, Rm 1354, Rm 1356 (15 min walk)") with a small line under it for each rep ("Dana W.: Rm 2242, Rm 2241").
6. **Contacts card on Home**, right under the greeting and welcome: "Your point of contact: Daniel Wang · 555-0101" and "Emergency contact: Noah Medland · 555-0102", each with Copy and Call (44 px). The numbers are fake.
7. **Welcome message**, two variants in the Mock-only panel:
   - **A (default):** a small warm card under "Hi [Sun Life]" with the horse, "Welcome to Hack Western 13!" and "Thank you so much for being a Gold sponsor." The × closes it, and that's remembered on this device (localStorage, in try/catch). The panel has "Show card again" to bring it back.
   - **B:** one quiet line under the greeting: "Welcome to Hack Western 13 · Thank you for being a Gold sponsor".
   - The panel also has a Tier select (Title / Gold / Silver / Bronze) that changes the thank-you line.
   - URLs work too: `?stage=prefs&welcome=b&tier=Silver#home`.

## Guesses

- The demo team is all ticked, but sent availability isn't. If the presets should be all ticked too, the mock organizer would put every rep in the 10–11 session, so the Schedule would lose its variety.
- Pages of 10 in the list, so the Previous / Next buttons stay close to the cards.
- Welcome A sits above the contacts card, and the contacts card sits above Up next.

## Checks and screenshots

`node mocks/sponsor-chats-v3/capture.mjs` from the repo root runs 294 checks (all pass) and saves 71 screenshots to `screens/`. It runs all of v2's checks (with the renamed copy), plus these, at 390 and 1280:

- `avail-ticked-*`: the grid after "fill in a demo team", 16 of 16 open sessions ticked, 8 locked
- `shortlist-list-40-*`: the list with "40 hackers interested in Sun Life". The check pages through all 4 pages and counts 40 different hackers, then checks a met hacker is pinned first
- `hacker-card-icons-*`: Avery K.'s card with five icon links. The check also confirms a hacker without GitHub gets no GitHub icon
- `home-prefs-*`, `home-conf-*`, `keyrooms-prefs-*`, `keyrooms-conf-*`: Key rooms before and after rooms are assigned
- `contacts-*`: the contacts card, plus checks for the tel: links and Copy
- `welcome-a-*`, `welcome-a-closed-*` (after × and a reload), `welcome-b-*`, plus the Tier select switching to Silver

As in v2, every screenshot also checks for sideways page scroll, clipped text, page errors and tap targets under 44 px.
