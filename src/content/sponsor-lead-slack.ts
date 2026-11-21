// Slack DMs to a sponsor's HW lead (Sponsor Day-Of "HW lead"): the change
// feed (src/server/slack/sponsor-lead-feed.ts) and the action-item pings
// before the sponsor's workshop, coffee chats and due steps
// (src/server/slack/sponsor-lead-pings.ts). Sponsor, rep, hacker and room
// names arrive already escaped for Slack mrkdwn.

const plural = (n: number, word: string, many = `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

/** Changes of one kind that collapse into a count past FEED_GROUP_MAX. */
export type FeedGroup =
  | "status"
  | "ccWorkshop"
  | "portalLink"
  | "placed"
  | "moved"
  | "removed"
  | "fix"
  | "autoSchedule"
  | "sent"
  | "booked"
  | "bookingMoved"
  | "bookingRemoved"
  | "accepted"
  | "declined"
  | "cancelled"
  | "roomMoved"
  | "replaced"
  | "putFirst"
  | "repAdded";

/** The coffee board's suggested fix kinds, in words. */
const fixKinds: Record<string, string> = {
  fewer: "fewer chats for a rep",
  extra: "one more session for a rep",
  move: "a chat moved or removed",
  ivey: "chats moved to Ivey",
  session: "a chat placed in a free session",
};

export const sponsorLeadSlackCopy = {
  feed: {
    /** "📣 Canada Life: Status → Booth set up (by Caroline)" */
    line: (sponsor: string, parts: readonly string[], by: string | null) =>
      `📣 ${sponsor}: ${parts.join("; ")}${by ? ` (by ${by})` : ""}`,
    /** The organizer when HW Contacts and the account have no name. */
    someone: "an organizer",
    status: (status: string) => `Status → ${status}`,
    ccWorkshop: (attended: boolean) =>
      attended ? "At CC workshop ✓" : "At CC workshop unticked",
    portalLink: (given: boolean) =>
      given ? "Portal link handed over" : "Portal link marked not given",
    placed: (rep: string, time: string, room: string) =>
      `${rep}'s draft chat placed at ${time}, Rm ${room}`,
    moved: (rep: string, time: string, room: string) =>
      `${rep}'s draft chat moved to ${time}, Rm ${room}`,
    removed: (rep: string, time: string, room: string) =>
      `${rep}'s ${time} draft chat in Rm ${room} removed`,
    fix: (kind: string) =>
      `Coffee board fix applied: ${fixKinds[kind] ?? kind}`,
    autoSchedule: (sessions: number) =>
      `Auto-schedule redid their draft chats: ${plural(sessions, "session")} now`,
    sent: (sessions: number, invites: number) =>
      `Coffee chats sent: ${plural(sessions, "session")}, ${plural(invites, "hacker")} invited`,
    booked: (what: string, time: string, room: string, hackers: number) =>
      `Event booked: "${what}", ${time}, Rm ${room}${hackers ? `, ${plural(hackers, "hacker")} invited` : ""}`,
    bookingMoved: (what: string, time: string, room: string) =>
      `Booking "${what}" moved to ${time}, Rm ${room}`,
    bookingRemoved: (what: string, cancelled: number) =>
      `Booking "${what}" removed${cancelled ? `, ${plural(cancelled, "hacker invite")} cancelled` : ""}`,
    /** A hacker answered a chat invite (they made the change, no "by"). */
    accepted: (hacker: string, rep: string | null, time: string) =>
      `${hacker} accepted ${rep ? `${rep}'s ` : "the "}${time} chat`,
    declined: (hacker: string, rep: string | null, time: string) =>
      `${hacker} declined ${rep ? `${rep}'s ` : "the "}${time} chat`,
    cancelled: (hacker: string, time: string) =>
      `${hacker}'s ${time} chat cancelled`,
    roomMoved: (chats: number, room: string) =>
      `${plural(chats, "chat")} moved to Rm ${room}`,
    replaced: (removed: string, invited: string | null) =>
      invited
        ? `${removed} taken off a chat, ${invited} invited instead`
        : `${removed} taken off a chat`,
    putFirst: (hacker: string) => `${hacker} put first in line for chats`,
    repAdded: (rep: string) => `Rep added: ${rep}`,
    /** A burst of one kind of change, past FEED_GROUP_MAX lines. */
    many: {
      status: (n: number) => `Status changed ${plural(n, "time")}`,
      ccWorkshop: (n: number) => `At CC workshop changed ${plural(n, "time")}`,
      portalLink: (n: number) => `Portal link changed ${plural(n, "time")}`,
      placed: (n: number) => `${plural(n, "draft chat")} placed`,
      moved: (n: number) => `${plural(n, "draft chat")} moved`,
      removed: (n: number) => `${plural(n, "draft chat")} removed`,
      fix: (n: number) =>
        `${plural(n, "coffee board fix", "coffee board fixes")} applied`,
      autoSchedule: (n: number) => `Auto-schedule ran ${plural(n, "time")}`,
      sent: (n: number) => `Coffee chats sent ${plural(n, "time")}`,
      booked: (n: number) => `${plural(n, "event")} booked`,
      bookingMoved: (n: number) => `${plural(n, "booking")} moved`,
      bookingRemoved: (n: number) => `${plural(n, "booking")} removed`,
      accepted: (n: number) => `${plural(n, "hacker")} accepted a chat`,
      declined: (n: number) => `${plural(n, "hacker")} declined a chat`,
      cancelled: (n: number) => `${plural(n, "chat")} cancelled`,
      roomMoved: (n: number) => `Chats moved rooms ${plural(n, "time")}`,
      replaced: (n: number) => `${plural(n, "hacker")} taken off chats`,
      putFirst: (n: number) => `${plural(n, "hacker")} put first in line`,
      repAdded: (n: number) => `${plural(n, "rep")} added`,
    } satisfies Record<FeedGroup, (n: number) => string>,
  },

  pings: {
    /** Their own workshop: they arrive 15 min before it starts to set up. */
    workshop: (
      sponsor: string,
      minutes: number,
      arrive: string,
      title: string,
      start: string,
      where: string | null,
    ) =>
      `⏰ ${sponsor} sets up their workshop in ${minutes} min: arrive by ${arrive}${where ? `, ${where}` : ""}. "${title}" starts at ${start}.`,
    /** One rep's session of coffee chats. */
    chat: (
      sponsor: string,
      minutes: number,
      rep: string,
      time: string,
      where: string,
    ) =>
      `⏰ ${sponsor}: ${rep}'s coffee chats start in ${minutes} min (${time}, ${where}).`,
    /** A step the sponsor must finish on the portal by a time. */
    due: (sponsor: string, minutes: number, title: string, time: string) =>
      `⏰ ${sponsor}: "${title}" is due in ${minutes} min (${time}) and isn't done yet.`,
    room: (room: string) => `Rm ${room}`,
    iveyRoom: (room: string) => `Ivey Rm ${room}`,
  },
} as const;
