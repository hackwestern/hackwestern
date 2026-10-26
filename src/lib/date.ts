export const APPLICATION_DEADLINE_ISO = "2026-10-18T23:59:00-04:00";
export const APPLICATION_DEADLINE = new Date("2026-10-18T23:59:00-04:00");
// Each hero sign-up button hides after its form closes. Nov 1 is EST
// (clocks fall back that morning), so -05:00.
export const VOLUNTEER_SIGNUP_DEADLINE = new Date("2026-11-01T23:59:00-05:00");
export const MENTOR_SIGNUP_DEADLINE = new Date("2026-11-01T23:59:00-05:00");

export function isPastDeadline() {
  return Date.now() >= APPLICATION_DEADLINE.getTime();
}
