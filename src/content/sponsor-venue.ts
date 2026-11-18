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
      where: "Rm 2241 to 2243 · Floor 2",
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
      name: "Noah",
      // TODO(Jazz): add Noah's number, e.g. "519-555-0123". The call button
      // shows only once this is set.
      phone: null as string | null,
      call: (phone: string) => `Call Noah at ${phone}`,
    },
    openMap: "See it on the map",
  },
  judgingLocked: {
    badge: "Opens Sunday 9:00 AM",
    message:
      "This will be unlocked on Sunday at 9:00 AM. Please come to the sponsor judging debrief at 8:30 AM. There will be coffee!",
  },
} as const;
