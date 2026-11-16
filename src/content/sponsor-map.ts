// Organizer "Where is everyone" map: floor plans with a pin per sponsor
// room, for a chosen day and time.
export const sponsorMapCopy = {
  heading: "Map",
  intro:
    "Which sponsors are in each room at the time you pick. Pins are approximate.",
  time: "Time",
  now: "Now",
  floors: "Floor",
  floorAlt: (floor: string) => `${floor} plan`,
  pin: (room: string, count: number) =>
    count === 0
      ? `${room}, empty`
      : `${room}, ${count} ${count === 1 ? "sponsor" : "sponsors"}`,
  pickPin: "Pick a pin to see who's there.",
  empty: "Nobody here then.",
  roomTitle: (label: string, id: string) =>
    label === id ? `Rm ${id}` : `${label} (Rm ${id})`,
  coffee: "Coffee chats",
  bay: "Sponsor Bay table",
  watcher: (name: string) => `Watched by ${name}`,
  listHeading: "Every room at this time",
  unplaced: "Elsewhere or no room yet",
  noRoom: "No room yet",
  nobody: "No sponsor is anywhere on the run of show at this time.",
} as const;
