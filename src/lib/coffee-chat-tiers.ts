// Chatting hours: how much coffee chat time a sponsor gets, across every
// rep (decisions 2026-11-20, "Chatting hours: tier default, sheet
// override").
//
// Precedence, highest first (sponsors can't change it, Jazz):
//   1. The sheet: Sponsor Day-Of's "Chatting hours" cell for that sponsor.
//      Today every cell is a formula that looks the hours up from Tier on
//      the Tiers tab; an organizer overrides one sponsor by typing a number
//      over that row's formula.
//   2. The tier default below, used when the sheet cell is blank or not a
//      number (no formula, #N/A for an unknown tier).
// None of them = no limit, so a Google outage never blocks a sponsor.

/** Hours per tier: keep in step with the run of show's Tiers tab. */
export const TIER_CHATTING_HOURS: Readonly<Record<string, number>> = {
  gold: 4,
  silver: 3,
  bronze: 2,
};

/** The tier's default chatting time in minutes; null for an unknown tier. */
export function tierChattingMinutes(tier: string): number | null {
  const hours = TIER_CHATTING_HOURS[tier.trim().toLowerCase()];
  return hours === undefined ? null : hours * 60;
}

/**
 * The chatting time that applies, in minutes: the sheet's, else the
 * tier's; null = no limit.
 */
export function effectiveChatMinutes({
  sheetMinutes,
  tier,
}: {
  sheetMinutes: number | null;
  tier: string;
}): number | null {
  return sheetMinutes ?? tierChattingMinutes(tier);
}
