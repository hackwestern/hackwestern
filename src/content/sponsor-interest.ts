// User-facing copy for the hacker "Sponsors you'd like to meet" form on the
// /live Sponsors tab. Keep wording here, not in components.

export const sponsorInterestCopy = {
  eyebrow: "Coffee chats",
  title: "Sponsors you'd like to meet",
  intro:
    "Add the sponsors you're most interested in and put them in order, top pick first. Sponsors see who picked them, so they know who to look out for at their booth.",
  rankedHeading: "Your ranking",
  rankedEmpty: "No sponsors yet. Add them from the list below.",
  othersHeading: "Other sponsors",
  othersEmpty: "You've added every sponsor.",
  rank: (n: number) => `${n}.`,
  add: "Add",
  addLabel: (name: string) => `Add ${name} to your ranking`,
  moveUpLabel: (name: string) => `Move ${name} up`,
  moveDownLabel: (name: string) => `Move ${name} down`,
  removeLabel: (name: string) => `Remove ${name} from your ranking`,
  save: "Save ranking",
  saving: "Saving...",
  saved: "Saved. Sponsors you picked can see your profile.",
  savedNotShared: "Saved.",
  unsaved: "You have unsaved changes.",
  saveError: "We couldn't save your ranking. Try again in a minute.",
  loadError: "We couldn't load the sponsor list right now.",
  notShared:
    "You didn't agree to share your profile with sponsors on your application, so sponsors won't see your name or links. Your ranking is still saved.",
  noSponsors: "The sponsor list isn't ready yet. Check back soon.",
  loading: "Loading",
  movedAnnouncement: (name: string, position: number, total: number) =>
    `${name} moved to position ${position} of ${total}`,
  addedAnnouncement: (name: string, position: number, total: number) =>
    `${name} added at position ${position} of ${total}`,
  removedAnnouncement: (name: string) => `${name} removed from your ranking`,
} as const;
