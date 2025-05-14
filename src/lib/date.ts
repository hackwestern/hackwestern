export const APPLICATION_DEADLINE = new Date("2024-10-17T00:20:00-04:00");

export function isPastDeadline() {
  return Date.now() >= APPLICATION_DEADLINE.getTime();
}
