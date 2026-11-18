/**
 * Ops pings: names in the organizer run of show that aren't the person's
 * Slack name. Key: the name as the sheet writes it (any case). Value: the
 * person's full name as on Slack, without the "[ORGANIZER]" tag. Each name is
 * one person, so an alias always points at exactly one organizer.
 *
 * To add one: copy a line, e.g. `Lucus: "Lucas Vanderwielen",`.
 */
export const opsOwnerAliases: Record<string, string> = {
  // Jess is Jessica Xing. Jessica Wang is a different person.
  Jess: "Jessica Xing",
};
