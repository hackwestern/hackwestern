# Sponsor dashboard redesign brief (2026-11-17)

Jazz asked: redesign everything built for the sponsor dashboard using Emil Kowalski's skills, in our own design system.

## Read first
- Emil's skills (installed at `C:\Users\Jasmine Gu\.claude\skills\`): `emil-design-eng/SKILL.md` (core), `mobile-native`, `break-ui` (+ CATALOG.md), `animate`, `choreograph`, `review-animations` (+ STANDARDS.md), `remove-animations`, `pick-ui-library`. Use them as the quality bar: press states, hit targets, hover only on hover-capable devices, motion with purpose (short, ease-out, interruptible, `prefers-reduced-motion`), no layout shift, clean empty/loading/error states, worst-case data (long names, zero items, 40 items).
- Our design system wins every conflict: tokens in `src/lib/tokens.ts` via `tailwind.config.ts` (`dashboard-*` colours, radii, type), shared UI in `src/components/ui/*`, existing dashboard look on `/live` and `/dashboard`. No new hex colours or arbitrary sizes. Shared files (`src/lib/tokens.ts`, `tailwind.config.ts`, `src/styles/globals.css`, root layout) are NOT edited in worktrees: if a token is missing, use the closest one and list the need in your report.
- `docs/decisions.md` (recent entries) for product rules. Do not change behaviour, data, privacy rules or tRPC procedures; this is a visual and interaction redesign. Fix real bugs you find, and say so.

## Rules
- Work only in your worktree/branch. Never push. Never read or print `.env` secrets. Never delete files: move to `_to_delete/`.
- User-facing copy stays in `src/content/`.
- Before/after screenshots at 1280 and 390 wide into `mocks/<area>-redesign-v1/` (before = current branch state, taken first). Organizer pages need a login: you may create a local test organizer in the local DB (`hackwestern_spon`): a user `redesign.organizer@test.local` with `type='organizer'`, `"emailVerified"=now()`, plus a next-auth `session` row, and set the session cookie in Playwright. Do not use or reset anyone else's account. Sponsor pages need no login (sponsor ids: `SELECT name,id FROM sponsor_judging_sponsor` via `docker exec hackwestern_db psql -U postgres -d hackwestern_spon`).
- Dev server env: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hackwestern_spon SKIP_ENV_VALIDATION=1 NEXTAUTH_SECRET=local-dev-only-secret NEXTAUTH_URL=http://localhost:<port> R2_PUBLIC_BASE_URL=http://localhost:<port> npx next dev --turbopack -p <port>`. Stop it before you finish. Never run `next build`.
- Checks: `npx tsc --noEmit` (ignore `_to_delete/` noise) and `SKIP_ENV_VALIDATION=1 npx vitest run` (known failure: Apple Wallet only). Update tests only where markup changed on purpose.
- Small commits ending with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01UDpAuwW8xuHdqdWjrFinNz`
- Report under 250 words: what changed and why (which Emil principles), files, screenshots folder, check output, commits, token needs, open questions.
