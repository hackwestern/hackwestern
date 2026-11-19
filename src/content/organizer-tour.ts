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
        title: "Sponsors",
        body: "Each sponsor's status in plain words. Open one to see when each rep is free, how many chats they asked for, and their phone numbers to copy.",
      },
      fixes: {
        title: "Suggested fixes",
        body: "Anything Auto-schedule couldn't place, with why and a fix you can apply. If a fix needs the sponsor's OK, call their primary contact.",
      },
      table: {
        title: "Rooms",
        body: "Rooms down the side, 1-hour sessions across. Tap a chat to move or remove it, or tap an empty cell to book the room.",
      },
      send: {
        title: "Auto-schedule, then send",
        body: "Auto-schedule places everyone. Only Noah can press Send, by 10 PM Friday.",
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
    mine: {
      now: {
        title: "Now and next",
        body: "What's on now and what's next on the run of show, with the team task now and the next one and who owns it.",
      },
      view: {
        title: "Your sponsors or everyone",
        body: "My sponsors shows the sponsors you lead, one tab each. All sponsors shows every sponsor, day by day.",
      },
      people: {
        title: "Who to call",
        body: "Each rep the sponsor gave us, with their phone. The crown is their main contact. Tap the copy icon to copy a number.",
      },
      pills: {
        title: "Tap to update",
        body: "Arrival and Booth move on with one tap. Tap one that's done to undo it.",
      },
    },
  },
} as const;
