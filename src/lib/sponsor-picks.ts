/**
 * Sponsor short-list limits shared by the picks page and the
 * sponsorJudging.setChosenTeams route, so the client hint and the server
 * validation can never drift apart. Dependency-free.
 */
export const MIN_SPONSOR_PICKS = 5;
export const MAX_SPONSOR_PICKS = 10;
