/**
 * Ops pings: who the names in the organizer run of show are. Organizers can
 * edit this file; nothing here is in the matching logic.
 */

/**
 * Names in the sheet that aren't the person's Slack name. Key: the name as
 * the sheet writes it (any case). Value: the person's full name as on Slack,
 * without the "[ORGANIZER]" tag. Each name is one person, so an alias always
 * points at exactly one organizer.
 *
 * To add one: copy a line, e.g. `Lucus: "Lucas Vanderwielen",`.
 */
export const opsOwnerAliases: Record<string, string> = {
  // Jess is Jessica Xing; "Jessica" on its own is Jessica Wang.
  Jess: "Jessica Xing",
  Jessica: "Jessica Wang",
  Lillian: "Lillian Wei",
};

/**
 * Owner words that mean a group rather than one person (any case).
 * - everyone: nobody is DMed (the page says "Everyone, not pinged").
 * - spon: the spon team, read from the sponsor run of show's Team
 *   Assignments tab, each DMed.
 * - teams: a fixed list of people, each DMed. Members are names as on Slack.
 */
export const opsOwnerGroups: {
  everyone: string[];
  spon: string[];
  teams: Record<string, string[]>;
} = {
  everyone: [
    "Everyone",
    "Everybody",
    "All",
    "All hands",
    "All organizers",
    "All organisers",
    "The team",
  ],
  spon: [
    "ALL OF SPON",
    "All spon",
    "Spon",
    "Spon team",
    "Sponsorship",
    "Sponsorship team",
    "All of sponsorship",
  ],
  teams: {
    // The web team: Jasmine and Luka (Lucian Lavric).
    WEB: ["Jasmine Gu", "Lucian Lavric"],
  },
};
