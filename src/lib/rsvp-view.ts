import { OWN_TRAVEL, type RsvpTravel } from "~/schemas/rsvp";

// What /rsvp shows for each RSVP status, before and after the deadline.
// Pure, so it's tested without rendering the page.

// NONE: signed in, with nothing to RSVP to (see the page).
type Status = "ACCEPTED" | "CONFIRMED" | "DECLINED" | "NONE";

type RsvpView = {
  title: string;
  body: string;
  /** The deadline line under the copy, if there is one. */
  pill: string | null;
  canEditTravel: boolean;
  /** Show the travel answer on file, since it can't be changed here any more. */
  showSavedTravel: boolean;
};

const copyFor = (
  key: Status | "CLOSED",
  deadlineText: string,
): { title: string; body: string } =>
  ({
    NONE: {
      title: "There’s no RSVP on this account",
      body: "If you got an acceptance email, sign in with the account you applied with.",
    },
    ACCEPTED: {
      title: "You’re invited to Hack Western 13!",
      body: "Hack Western runs November 20–22 at Western University. Tell us how you’re getting here and confirm your spot.",
    },
    CLOSED: {
      title: "RSVP is closed",
      body: `The RSVP deadline was ${deadlineText}, so your spot has been released. We hope to see you at a future Hack Western.`,
    },
    CONFIRMED: {
      title: "You’re confirmed. See you there!",
      body: "Hack Western runs November 20–22 at Western University. We’ll email you the schedule and check-in details closer to the event.",
    },
    DECLINED: {
      title: "You’re not attending Hack Western 13",
      body: "Your spot has been released. We hope to see you at a future Hack Western.",
    },
  })[key];

export function rsvpView({
  status,
  closed,
  deadlineText,
}: {
  status: Status;
  closed: boolean;
  deadlineText: string;
}): RsvpView {
  return {
    ...copyFor(
      status === "ACCEPTED" && closed ? "CLOSED" : status,
      deadlineText,
    ),
    pill:
      status === "ACCEPTED" && !closed
        ? `RSVP by ${deadlineText}`
        : status === "CONFIRMED" && !closed
          ? `You can change your travel plans until ${deadlineText}`
          : status === "CONFIRMED"
            ? `Travel plans locked on ${deadlineText}`
            : null,
    canEditTravel: !closed && (status === "ACCEPTED" || status === "CONFIRMED"),
    showSavedTravel: status === "CONFIRMED" && closed,
  };
}

// The travel answer on file as one line, or null when there isn't one.
export function describeTravel(travel: RsvpTravel): string | null {
  const method = travel.transportationMethod;
  if (!method) return null;
  if (method !== OWN_TRAVEL) return `Hack Western bus from ${method}`;
  if (!travel.travelReimbursement) return "On your own";
  // Autosave can store a request before its city is filled in.
  return travel.travelFrom
    ? `On your own, with a ticket reimbursement request from ${travel.travelFrom}`
    : "On your own, with a ticket reimbursement request";
}
