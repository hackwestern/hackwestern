# Wireframes v1: shared brief (Jazz, 2026-11-18)

Goal: wake up to 10 genuinely different wireframes of every page, flow and key
component of the Hack Western sponsor dashboard, to compare ways to show info.

## Format (every file)
- One self-contained HTML file per page: `mocks/wireframes-v1/<page>.html`.
- 10 variants behind a picker at the top (tabs or a segmented control, plus
  arrow keys ←/→ and number keys 1-0). Each variant has a 1-line name and a
  1-line "why this layout" note shown under the picker.
- Follow the `prototype` skill's divergence rule: 10 different ANSWERS
  (layout, hierarchy, density, navigation, mental model), not 10 tints.
  Mix: list vs grid vs timeline vs board vs map/spatial vs dashboard tiles vs
  conversational/step-by-step vs table vs split-view vs focus/one-thing-at-a-time.
- Each variant works at desktop (1280) AND phone (375): no horizontal page
  scroll; show both via a "Desktop / Phone" toggle that constrains the frame.
- Wireframe fidelity, but real enough to judge: real layout, real copy length,
  real states. Light interactivity with inline vanilla JS (no libraries except
  Google Fonts Figtree). Small "WIREFRAME · dummy data" badge.

## Read before designing (skills on this machine)
- `C:/Users/Jasmine Gu/.claude/skills/prototype/SKILL.md` (divergence, picker)
- `C:/Users/Jasmine Gu/.claude/skills/emil-design-eng/SKILL.md` (craft bar)
- `C:/Users/Jasmine Gu/.claude/skills/apple-design/SKILL.md`
- `C:/Users/Jasmine Gu/.claude/skills/mobile-native/SKILL.md`
- Design system: `src/lib/tokens.ts`, `tailwind.config.ts`, `docs/redesign-brief.md`
  (dashboard-* colours, Figtree, rounded cards, soft shadows). Use these
  colours as CSS variables at the top of each file.
- Real features to cover: `docs/flows/*.md` (sponsor-judging.md,
  sponsor-organizer.md), `C:/Users/Jasmine Gu/hackwestern-sd-room-blocks/docs/flows/coffee-chat-room-blocks.md` (coffee chats v2),
  existing pages under `src/pages/sponsors/[uuid]/` and `src/pages/internal/`,
  components under `src/components/sponsors/`.

## Jazz's taste (from her corrections; follow exactly)
- Small pills, not big buttons. Quiet UI. No legends (labels/cells say what they are).
- Sponsor logos: the real logo, not initials in circles, no circle frames.
  In room grids, the logo only (no name text).
- Info should be specific to the picked day; the schedule opens on today.
- The map is one tap away (high-visibility Map pill).
- Only show the option that applies in a dialog (no irrelevant forms).
- Coffee chats: at most 3 hackers per slot (3 hackers + 3 reps 1-on-1, or
  3 hackers + 1 rep group); counts read "1/3", never "1/6".
- Filters as small segmented pills with counts.
- Plain, friendly copy. No jargon.

## Dummy data (use when real info is missing; clearly fictional people)
- Sponsors (real names/logos ok, logos at `../../public/shared/sponsors/`):
  Accenture (accenture.svg), Canada Life (canadalife.png), Manulife
  (manulife.svg), QNX (no logo: use name), TinyFish (tinyfish.svg),
  StarTech (startech.svg), CSE (cse-trimmed.png), Sun Life (sunlife.png),
  Scotiabank (scotiabank-trimmed.svg), Commure (commure.svg).
- Event: Hack Western 13, Fri Nov 20 - Sun Nov 22, 2026, Eastern time.
  Rooms: Sponsor Bay (SM Atrium, Floor 1), Grand Hall Rm 1110, Rm 2110
  sponsor lounge, Rm 2244 belongings, coffee chat rooms 2241/2242/2243,
  judging rooms Scotiabank Rm 2110, Canada Life Rm 2230, QNX Rm 2235.
- Coffee chats sheet: StarTech 9-1, 2 chatting hours, individual 15 min, 3 reps;
  Sun Life 10-4, 3 h, groups of 3, 30 min; Canada Life 10-12, 3 h, groups of 3.
- Spon team: Noah, Caroline, Daniel, Alice, Aniya. Emergency contact Noah
  (phone: "coming soon").
- Hackers: invent 40 fictional hackers (first name + last initial, school,
  program/year, skills, short interest note). Teams: invent ~20 fictional
  teams with project names and Devpost-style blurbs.
- Sunday judging: 9:00 round 1 shortlist; 10:00-11:30 5-min presentations;
  round 2 top 5; cheat check.

## Rules
- Write ONLY your assigned files in `mocks/wireframes-v1/`. No git commits.
  Don't touch app code.
- Report: file paths, the 10 variant names per file, and 2 lines on what's
  most worth comparing.
