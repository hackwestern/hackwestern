export const APPLICATION_DEADLINE_ISO = "2026-10-18T23:59:00-04:00";
export const APPLICATION_DEADLINE = new Date("2026-10-18T23:59:00-04:00");
// Each hero sign-up button hides after its form closes. Nov 1 is EST
// (clocks fall back that morning), so -05:00.
export const VOLUNTEER_SIGNUP_DEADLINE = new Date("2026-11-01T23:59:00-05:00");
export const MENTOR_SIGNUP_DEADLINE = new Date("2026-11-01T23:59:00-05:00");

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

// "Friday, November 6 at 11:59 p.m. ET". Formatted on the server and passed
// to pages, so the browser's locale data can't make it differ.
export function formatRsvpDeadline() {
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    RSVP_DEADLINE.toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      ...o,
    });
  return `${fmt({ weekday: "long", month: "long", day: "numeric" })} at ${fmt({ hour: "numeric", minute: "2-digit" })} ET`;
}

export const formatEventTime = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
) => date.toLocaleString("en-US", { timeZone: "America/Toronto", ...options });

// Hackathon start/end come from HACK_START / HACK_END (ISO strings, inlined
// at build time by next.config.js). Defaults: the event weekend, Fri Nov 20 -
// Sun Nov 22 EST.
function parseEnvDate(value: string | undefined, fallback: string) {
  const d = new Date(value?.trim() ? value : fallback);
  return Number.isNaN(d.getTime()) ? new Date(fallback) : d;
}

export const HACKATHON_START = parseEnvDate(
  process.env.NEXT_PUBLIC_HACK_START,
  "2026-11-20T00:00:00-05:00",
);
export const HACKATHON_END = parseEnvDate(
  process.env.NEXT_PUBLIC_HACK_END,
  "2026-11-23T00:00:00-05:00",
);

const WARNING_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

// The internal-tools warning shows from a week before the hackathon starts
// until it ends.
export function isDuringHackathon(now = Date.now()) {
  return (
    now >= HACKATHON_START.getTime() - WARNING_LEAD_MS &&
    now < HACKATHON_END.getTime()
  );
}
