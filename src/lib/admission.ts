import { RSVP_DEADLINE } from "~/lib/date";

// Who counts as admitted to the event: allowed a hacker pass, scannable at
// the door, and included in the MLH attendee export.
//
// Until RSVP closes, accepted hackers who haven't answered yet still count.
// After it, only hackers who confirmed do; anyone still ACCEPTED let their
// spot lapse.
//
// Pure (no DB), so client components can use it for display. Server checks
// are the ones that matter.
export function admittedStatuses(now: number = Date.now()) {
  return now >= RSVP_DEADLINE.getTime()
    ? (["CONFIRMED"] as const)
    : (["ACCEPTED", "CONFIRMED"] as const);
}

export function isAdmittedStatus(
  status: string | null | undefined,
  now: number = Date.now(),
) {
  return (
    !!status && (admittedStatuses(now) as readonly string[]).includes(status)
  );
}
