export const HACKER_CHECK_TYPES = ["IS_OF_AGE", "IS_REGISTERED"] as const;

export const TEAM_CHECK_TYPES = [
  "COMMIT_WITHIN_ALLOTTED_TIME",
  "ONLY_TEAM_MEMBER_COMMITS",
  "DEVPOST_MEMBERS_REGISTERED",
] as const;

export const TEAM_DISPLAY_CHECK_TYPES = [
  ...HACKER_CHECK_TYPES,
  ...TEAM_CHECK_TYPES,
] as const;

/** Shown when a sweep can't run because CHEAT_SWEEP_SECRET is unset. */
export const SWEEP_NOT_CONFIGURED =
  "The cheat check isn't set up on this site: CHEAT_SWEEP_SECRET is missing.";
