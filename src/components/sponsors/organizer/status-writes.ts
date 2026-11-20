// Status changes on the sponsor board are saved one sponsor at a time: a
// sponsor's row is locked while its write is in flight (the server reads
// then updates-or-appends the sheet row, so two writes for one sponsor
// could append a duplicate), and a failed write rolls back only that
// sponsor, not the others changed meanwhile.

/** Sponsor names compare case-insensitively, as the server does. */
export const sponsorKey = (name: string) => name.trim().toLowerCase();

type WithStatus<S> = { name: string; status: S };

/** The list with one sponsor's status replaced (same list when missing). */
export function withSponsorStatus<T extends WithStatus<S>, S>(
  list: T[] | undefined,
  name: string,
  status: S,
): T[] | undefined {
  if (!list) return list;
  const key = sponsorKey(name);
  return list.map((s) => (sponsorKey(s.name) === key ? { ...s, status } : s));
}

/** A sponsor's status in the list, or undefined when it isn't there. */
export function sponsorStatusIn<S>(
  list: WithStatus<S>[] | undefined,
  name: string,
): S | undefined {
  const key = sponsorKey(name);
  return list?.find((s) => sponsorKey(s.name) === key)?.status;
}

/** In-flight sponsor keys, as a new set (for React state). */
export function addInFlight(set: ReadonlySet<string>, name: string) {
  return new Set(set).add(sponsorKey(name));
}

export function removeInFlight(set: ReadonlySet<string>, name: string) {
  const next = new Set(set);
  next.delete(sponsorKey(name));
  return next;
}
