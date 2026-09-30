export const APPLICATION_DEADLINE_ISO = "2026-10-18T23:59:00-04:00";
export const APPLICATION_DEADLINE = new Date("2026-10-18T23:59:00-04:00");

export function isPastDeadline() {
  return Date.now() >= APPLICATION_DEADLINE.getTime();
}
