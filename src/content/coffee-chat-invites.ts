// Copy for coffee chat session invites (track B): the hacker's Slack DM and
// email (session model: time, sponsor, rep, room and building, answer-by),
// and the organizer invite status view. Keep wording here, not in code.
// The Accept / Decline buttons and their results are shared with the old
// per-slot flow (src/content/coffee-chat-notify.ts).

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
    text: (sponsor: string) =>
      `You're invited to a coffee chat with ${sponsor}`,
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
    }) =>
      [
        p.rep
          ? `*${p.sponsor}* invited you to a coffee chat with ${p.rep}.`
          : `*${p.sponsor}* invited you to a coffee chat.`,
        `*When:* ${p.when}`,
        `*Where:* ${p.where}`,
        `*Answer by:* ${p.answerBy}. If you don't, your seat goes to someone else.`,
      ].join("\n"),
  },

  email: {
    subject: (sponsor: string) =>
      `You're invited to a coffee chat with ${sponsor}`,
    reconfirmSubject: (sponsor: string) =>
      `Your coffee chat with ${sponsor} changed: please confirm again`,
    reconfirm:
      "Your coffee chat changed. Please accept again to keep your seat.",
    answerByLabel: "Answer by",
    intro: (sponsor: string, rep: string | null) =>
      rep
        ? `${sponsor} invited you to a coffee chat with ${rep} at Hack Western.`
        : `${sponsor} invited you to a coffee chat at Hack Western.`,
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
    } as Record<string, string>,
    round: (n: number) => (n <= 1 ? "Round 1 (Fri)" : `Round ${n}`),
  },

  errors: {
    workshopsUnknown:
      "Can't read the run of show, so workshop times are unknown. Invites weren't sent; try again in a minute.",
    unknownSponsor: "That sponsor isn't registered.",
  },
} as const;
