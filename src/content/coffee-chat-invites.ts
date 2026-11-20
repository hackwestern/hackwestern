// Copy for coffee chat session invites (track B): the hacker's Slack DM and
// email (session model: time, sponsor, rep, room and building, answer-by),
// and the organizer invite status view. Keep wording here, not in code.
// The Accept / Decline buttons and their results are shared with the old
// per-slot flow (src/content/coffee-chat-notify.ts).

/**
 * What a chat is called: "Group Coffee Chat" (more than one hacker per
 * chat) or "1-on-1 Coffee Chat"; "coffee chat" when unknown (null).
 */
export const coffeeChatName = (group: boolean | null | undefined) =>
  group == null
    ? "coffee chat"
    : group
      ? "Group Coffee Chat"
      : "1-on-1 Coffee Chat";

export const coffeeChatInvitesCopy = {
  /** "Rm 2241 (near the Sponsor Bay)" / "Rm 1348, Ivey building (15-min walk)" */
  where: (room: string | null, building: "near" | "ivey" | null) => {
    if (!room) return "room TBA";
    if (building === "ivey") return `${room}, Ivey building (15-min walk)`;
    if (building === "near") return `${room} (near the Sponsor Bay)`;
    return room;
  },
  /** "Sat 10:00 AM" */
  answerBy: (time: string) => `Sat ${time}`,

  slack: {
    /** Notification preview text. */
    text: (sponsor: string, group?: boolean | null) =>
      `You're invited to a ${coffeeChatName(group)} with ${sponsor}`,
    reconfirmText: (sponsor: string) =>
      `Your coffee chat with ${sponsor} changed. Please confirm again`,
    reconfirm:
      "*Your coffee chat changed.* Please accept again to keep your seat.",
    body: (p: {
      sponsor: string;
      rep: string | null;
      when: string;
      where: string;
      answerBy: string;
      group?: boolean | null;
    }) =>
      [
        p.rep
          ? `*${p.sponsor}* invited you to a ${coffeeChatName(p.group)} with ${p.rep}.`
          : `*${p.sponsor}* invited you to a ${coffeeChatName(p.group)}.`,
        `*When:* ${p.when}`,
        `*Where:* ${p.where}`,
        `*Answer by:* ${p.answerBy}. If you don't, your seat goes to someone else.`,
      ].join("\n"),
  },

  email: {
    subject: (sponsor: string, group?: boolean | null) =>
      `You're invited to a ${coffeeChatName(group)} with ${sponsor}`,
    reconfirmSubject: (sponsor: string) =>
      `Your coffee chat with ${sponsor} changed: please confirm again`,
    reconfirm:
      "Your coffee chat changed. Please accept again to keep your seat.",
    answerByLabel: "Answer by",
    intro: (sponsor: string, rep: string | null, group?: boolean | null) =>
      rep
        ? `${sponsor} invited you to a ${coffeeChatName(group)} with ${rep} at Hack Western.`
        : `${sponsor} invited you to a ${coffeeChatName(group)} at Hack Western.`,
    repLabel: "With",
    deadline: (answerBy: string) =>
      `Please accept or decline by ${answerBy}. If you don't answer, your seat goes to someone else.`,
  },

  /** Organizer invite status (coffeeChatInvites router). */
  status: {
    source: {
      scanned: "Met at their booth",
      shortlist: "Shortlist",
      interested: "Interested",
      anyone: "From the interest list",
    } as Record<string, string>,
    round: (n: number) => (n <= 1 ? "Round 1 (Fri)" : `Round ${n}`),
  },

  /** The app-written, locked "Coffee Chat Invites" tab (one-way mirror). */
  sheet: {
    tab: "Coffee Chat Invites",
    note: "Read-only. The app writes this tab. To change an invite, use the coffee chat board (Remove · Put first in line).",
    updated: (when: string) => `Last updated ${when} ET`,
    headers: [
      "Sponsor",
      "Rep",
      "Session",
      "Chat time",
      "Room",
      "Hacker",
      "Hacker ID",
      "Source",
      "Status",
      "Answer by",
    ],
    source: {
      scanned: "Met at your booth",
      shortlist: "Shortlist",
      interested: "Interested",
      anyone: "From the interest list",
      organizer: "Added by organizer",
    } as Record<string, string>,
    status: { accepted: "Accepted", pending: "Waiting" },
    /** The protected range's description in Sheets. */
    protection: "App-written: change invites on the coffee chat board",
  },

  errors: {
    workshopsUnknown:
      "Can't read the run of show, so workshop times are unknown. Invites weren't sent; try again in a minute.",
    unknownSponsor: "That sponsor isn't registered.",
  },

  /**
   * Organizer edits to a sponsor's hackers on the coffee board (remove a
   * hacker and fill the seat, put someone first in line). Server errors,
   * shown as toasts or under the hacker ID field.
   */
  line: {
    unknown: (code: string) => `No hacker with ID ${code}.`,
    taken: (name: string) => `${name} is already invited or in line.`,
    blocked: (name: string) =>
      `${name} said no to this sponsor or was removed, so they aren't offered it again.`,
    noShare: (name: string) =>
      `${name} didn't agree to share with sponsors, so they can't be invited.`,
    busy: (name: string) => `${name} already has a chat then.`,
    full: (name: string) => `${name} already has 2 chats.`,
    nobody: "Nobody in line can take this seat.",
    inviteGone: "That invite is gone. The board changed.",
    tooLate: "It's too close to this chat to invite anyone.",
    invitesOff:
      "Invites are switched off on this server, so nobody can be invited.",
  },
} as const;
