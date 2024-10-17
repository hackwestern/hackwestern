export const APPLICATION_DEADLINE = new Date("2024-10-17T00:15:00-05:00");

export function isPastDeadline() {
  return Date.now().valueOf() >= APPLICATION_DEADLINE.valueOf();
}
