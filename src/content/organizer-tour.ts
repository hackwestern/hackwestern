// User-facing copy for the organizer sponsor dashboard's tours
// (/internal/sponsors): the header Tour button, the once-per-tab offer and
// every step. The callout controls (Step n of N, Back, Next, Skip tour) are
// shared with the sponsor portal in src/content/sponsor-tour.ts. The tour
// structure (targets, placement) is in src/lib/organizer-tours.ts.
// Keep wording here, not in components.

export const organizerTourCopy = {
  button: "Tour",
  buttonLabel: (tab: string) => `Take a tour of ${tab}`,
  offer: {
    title: "New here?",
    body: (tab: string) => `Take a 1-minute tour of ${tab}.`,
    start: "Start",
    dismiss: "No thanks",
  },

  tours: {
    sponsors: {
      days: {
        title: "Pick a day",
        body: "Each day shows what matters then: arrivals on Friday, coffee chats on Saturday, judging on Sunday.",
      },
      stats: {
        title: "The day at a glance",
        body: "Totals for the day. A number in the warning colour needs someone to act.",
      },
      search: {
        title: "Find a sponsor",
        body: "Type a name to narrow the list to one sponsor.",
      },
      row: {
        title: "One row per sponsor",
        body: "Open a row to see their chats, room holds and details, with links to their other tabs.",
      },
      link: {
        title: "Copy their link",
        body: "On Friday, Copy link gets the sponsor's portal link to send them. They don't need a login.",
      },
    },
    schedule: {
      sheet: {
        title: "Edits go in the sheet",
        body: "This page is read-only. Change times and rooms in the run of show sheet, and the page catches up.",
      },
      days: {
        title: "Pick a day",
        body: "The run of show opens on today. Switch days here.",
      },
      toggles: {
        title: "Show more or less",
        body: "Turn organizer availability and the hacker schedule on or off.",
      },
      grid: {
        title: "The day's plan",
        body: "Everything from the sheet, plus team tasks and booked coffee chats. It refreshes on its own.",
      },
    },
    coffee: {
      strip: {
        title: "What each sponsor asked for",
        body: "One card per sponsor. Tap a card to light up their blocks below.",
      },
      table: {
        title: "Rooms by time",
        body: "Rooms run across, times run down. Each coloured block is a room a sponsor holds.",
      },
      block: {
        title: "Open a block",
        body: "See the hackers in each slot, invite or cancel a chat, change the length, or release the room.",
      },
      free: {
        title: "Give a room",
        body: "Tap a free cell to give a sponsor that room, for example a last-minute booking.",
      },
    },
    judging: {
      sent: {
        title: "Who sent a shortlist",
        body: "On Sunday each sponsor sends their shortlist. This shows who has, and when.",
      },
      actions: {
        title: "Schedule, then notify",
        body: "Once shortlists are in, Schedule presentations sets each team's time and room. Notify hackers tells them.",
      },
      round2: {
        title: "Open round 2",
        body: "When presentations are done, open round 2 so sponsors can rank the teams they saw.",
      },
      views: {
        title: "By sponsor or by team",
        body: "See each sponsor's picks, or every team in one list.",
      },
    },
    pings: {
      help: {
        title: "Sponsor help requests",
        body: "When a sponsor taps Need help, it lands here and in Slack. Resolve it once it's handled.",
      },
      next: {
        title: "Up next",
        body: "The task pings Slack sends next. Owners get a DM; tasks with no clear owner go to the team channel.",
      },
      log: {
        title: "Ping log",
        body: "Every ping that went out, so you can check who was told and when.",
      },
    },
  },
} as const;
