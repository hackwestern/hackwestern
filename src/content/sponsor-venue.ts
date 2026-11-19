// User-facing copy for the sponsor venue map (the Map button on every
// sponsor page) and the "Important things to remember" section on the
// portal home. Keep wording here, not in components.

export const sponsorVenueCopy = {
  mapButton: "Map",
  mapButtonLabel: "Open the venue map",
  map: {
    title: "Venue map",
    description:
      "Floor plans with the rooms sponsors use. Pins are approximate.",
    close: "Close map",
    floors: "Floor",
    floorAlt: (floor: string) => `${floor} floor plan`,
    keyPlaces: "Key places",
  },
  // Rooms highlighted on the map and listed under it. `room` is a pin id in
  // src/lib/sponsor-map-rooms.ts.
  places: [
    { room: "2110", name: "Sponsor lounge", where: "Rm 2110 · Floor 2" },
    {
      room: "2244",
      name: "Belongings overnight",
      where: "Rm 2244 · Floor 2",
    },
    { room: "1235", name: "Sponsor Bay (booths)", where: "Floor 1" },
    {
      room: "2242",
      name: "Coffee chats",
      where: "Rm 2241 to 2243 (Floor 2) and Rm 1348 to 1358 (Floor 1)",
    },
  ],
  important: {
    heading: "Important things to remember",
    lounge: {
      label: "Sponsor lounge",
      value: "Rm 2110",
      hint: "A space for sponsors all weekend",
    },
    belongings: {
      label: "Leave your things overnight",
      value: "Rm 2244",
      hint: "Store your belongings here between days",
    },
    emergency: {
      label: "Emergency contact",
      // The name and number come from the HW Contacts sheet at runtime
      // (sponsorHelp.contacts); no phone number lives in the repo.
      phonePlaceholder: "Ask at the sponsor lounge (Rm 2110)",
    },
    openMap: "See it on the map",
  },
  booths: {
    heading: "Sponsor Bay layout",
    screen: "Projector screen",
    label: "Sponsor Bay booth layout around the projector screen",
    labelMine: (sponsor: string) =>
      `Sponsor Bay booth layout around the projector screen. Your booth, ${sponsor}, is highlighted.`,
    yours: (sponsor: string) => `Your booth is highlighted: ${sponsor}.`,
  },
  judgingLocked: {
    badge: "Opens Sunday 9:00 AM",
    /** Beside Judging in the side nav. */
    short: "Sun 9 AM",
    message:
      "This will be unlocked on Sunday at 9:00 AM. Please come to the sponsor judging debrief at 8:30 AM. There will be coffee!",
  },
} as const;
