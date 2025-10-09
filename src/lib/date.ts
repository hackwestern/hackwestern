export const APPLICATION_DEADLINE_ISO = "2025-10-18T11:59:00-04:00"
export const APPLICATION_DEADLINE = new Date("2025-10-18T11:59:00-04:00");

export function isPastDeadline() {
  return Date.now() >= APPLICATION_DEADLINE.getTime();
}
