export const APPLICATION_DEADLINE_ISO = "2026-10-18T23:59:00-04:00";
export const APPLICATION_DEADLINE = new Date("2026-10-18T23:59:00-04:00");

export function isPastDeadline() {
  return Date.now() >= APPLICATION_DEADLINE.getTime();
}

// RSVP closes here. Accepted hackers who haven't confirmed by then lose their
// spot (organizers move them to DECLINED). Confirmed hackers can still cancel
// after it.
export const RSVP_DEADLINE = new Date("2026-11-06T23:59:00-05:00");

export function isPastRsvpDeadline() {
  return Date.now() >= RSVP_DEADLINE.getTime();
}
