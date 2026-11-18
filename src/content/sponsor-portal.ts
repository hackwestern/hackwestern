// User-facing copy for the sponsor portal home (/sponsors/[uuid]) and the
// shared bits of its sub-pages. Keep wording here, not in components.

export const sponsorPortalCopy = {
  seoTitle: "Sponsor Portal",
  brand: "Hack Western 13",
  invalid: {
    title: "Link not recognised",
    body: "This private link isn't valid. If you believe this is an error, please reach out to your Hack Western organizer contact for assistance.",
  },
  welcome: {
    title: (sponsor: string) => `Welcome, ${sponsor}!`,
    body: "We're thrilled to have you with us this weekend. Use this portal to check your booth and judging details and pick your top projects.",
    fallbackName: "Sponsor",
    logoAlt: (sponsor: string) => `${sponsor} logo`,
  },
  // The action tiles under the welcome card.
  actions: {
    label: "Quick actions",
    scan: { title: "Scan a badge", body: "Offer a hacker a coffee chat" },
    chats: { title: "Coffee chats", body: "Your chats and candidates" },
    schedule: {
      title: "Your schedule",
      body: "Booth, workshop and judging times",
    },
    picks: {
      title: "Judging",
      body: (top: number) => `Score projects and submit your top ${top}`,
      picked: (n: number) => `${n} submitted`,
      pending: "Not submitted",
      /** Sponsors without a prize track (src/content/sponsor-prize-tracks.ts). */
      noTrack: {
        badge: "No prize track",
        body: "Judging is for prize track sponsors",
        message:
          "Your team doesn't have a prize track this year, so there's no judging to do. If that's wrong, tell your Hack Western contact.",
      },
    },
  },
  details: {
    heading: "Event details",
    booth: { label: "Booth", hint: "Your assigned sponsor booth table" },
    judging: {
      label: "Judging room",
      value: (room: string) => `Room ${room}`,
      hint: "Head here when judging deliberations start",
    },
    workshop: { label: "Workshop", location: "Location", time: "Time" },
    contact: {
      label: "Your Hack Western contact",
      fallback: "Hack Western Organizer Team",
      tag: "On-site support",
      call: (phone: string) => `Call ${phone}`,
    },
  },
  footer:
    "Need immediate assistance during the hackathon? Reach out to your HW contact.",
} as const;
