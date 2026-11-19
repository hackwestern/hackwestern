# Decisions log (ship run, 2026-11-19)

Calls made during the unattended build, and anything blocked or left for Jazz. Product decisions are also copied into `docs/decisions.md`.

## Calls made

- **Logged decisions win over the ship brief's feature list.** The brief asks for optional 30-min 1-on-1s, hours per rep, tracked help requests and overdue-task pings; `docs/decisions.md` (2026-11-19) removed all four. The brief's own "when not sure" order puts project decisions first.
- **Ship-run docs live in `docs/ship/`**, not the repo root, to keep the root clean.
- **One person shortlists** (Jazz, mid-build): no rep picker, no picked-by column.
- **Invites can't fire by accident:** nothing is sent until an organizer presses Send for that sponsor, plus a `COFFEE_INVITES_ENABLED` kill switch that defaults to off outside production.
- **Live sheet:** edited directly only to simplify it. A full Drive copy is made first, retired tabs are hidden with an "(old)" prefix rather than deleted, sharing is unchanged, and the Rationale + Decisions tab is kept in sync.

## Blocked / for Jazz

_(filled in as the run goes)_
