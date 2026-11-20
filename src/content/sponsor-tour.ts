// User-facing copy for the sponsor portal's guided tour: the entry points
// (Home's "Take the tour", Help's button), the first-visit offer, the
// callout controls and every step. The order follows the organizers'
// "Sponsor Dashboard Workshop" deck: Home, Schedule, Map, Chats, Scan a
// hacker, Judging, Questions. The structure (pages, targets, skips) is in
// src/lib/sponsor-tours.ts. Keep wording here, not in components.

export const sponsorTourCopy = {
  /** Home, under Up next. */
  homeEntry: {
    text: "New to the portal? See how it all works.",
    button: "Take the tour",
  },
  /** Inside the Help dialog. */
  helpEntry: {
    text: "Not sure where something is?",
    button: "Take the tour",
  },
  offer: {
    title: "New here?",
    body: "Take a 2-minute tour of your portal.",
    start: "Take the tour",
    dismiss: "Not now",
  },
  callout: {
    progress: (n: number, total: number) => `Step ${n} of ${total}`,
    back: "Back",
    next: "Next",
    done: "Done",
    skip: "Skip tour",
    close: "Close tour",
    goThere: "Take me there",
    clickHint: "Tap the highlighted spot to continue, or press Next.",
    announce: (n: number, total: number, title: string, body: string) =>
      `Step ${n} of ${total}. ${title}. ${body}`,
    /** Read once when the tour opens, for keyboard users. */
    keys: "Use the arrow keys to move, Escape to skip.",
  },

  tours: {
    welcome: {
      name: "Portal tour",
      steps: {
        // Home
        welcome: {
          title: "Welcome to your portal",
          body: "Everything your team needs this weekend is here. Keep this link handy: no login needed.",
        },
        contacts: {
          title: "Your contacts",
          body: "Your point of contact is your Sponsorship Executive. Reach out to them first. Can't reach them? Call the emergency contact.",
        },
        upNext: {
          title: "Up next",
          body: "Your weekend, step by step. It updates live, and what's happening now is highlighted.",
        },
        upNextButtons: {
          title: "Jump straight there",
          body: "Buttons on a step take you to the right page. Both Scan buttons open the same page.",
        },
        keyRooms: {
          title: "Key rooms",
          body: "The sponsor lounge and overnight belongings rooms stay the same all weekend. Coffee chat rooms are set at 10:00 PM Friday.",
        },
        // Schedule
        scheduleDays: {
          title: "Your personal schedule",
          body: "Everything you need to be at. Pick a day to see it.",
        },
        scheduleHackathon: {
          title: "Hackathon events",
          body: "Tick this to see what else is going on this weekend.",
        },
        scheduleBlocks: {
          title: "Tap a block for details",
          body: "Tap any block on the schedule to see where it is and what it's about.",
        },
        // Map
        booth: {
          title: "Your booth",
          body: "This is where your booth is all weekend.",
        },
        buildings: {
          title: "Building maps",
          body: "Find every other room here: your workshop, coffee chats, the lounge. Tap a map to open it full size.",
        },
        // Chats
        chatsNav: {
          title: "Coffee chats",
          body: "Open Chats from the menu, or with the Chats button in Up next. Both go to the same page.",
        },
        chatsSteps: {
          title: "Two steps",
          body: "First send your availability (required), then pick hackers to meet (optional). You can go back and change both until 10:00 PM Friday.",
        },
        chatsStage: {
          start: {
            title: "Step 1: send availability",
            body: "Tap Start. Add the name and phone number of every rep from your firm, then when each one is free and how many chats they'll take.",
          },
          shortlist: {
            title: "Step 2: pick hackers (optional)",
            body: "We've lined up hackers who'd like to chat with your firm. Shortlist the ones you want to meet.",
          },
          waiting: {
            title: "Check back at 10:00 PM",
            body: "That's when your chat times and rooms show here. After that everything locks, so ask your point of contact for changes.",
          },
          confirmed: {
            title: "Your chats",
            body: "Every rep's chats, rooms and the hackers who confirmed. For changes now, ask your point of contact.",
          },
        },
        // Scan a hacker
        scan: {
          title: "Scan a hacker",
          body: "Met a hacker at your booth who isn't on your shortlist? Scan their badge to add them to your chats.",
        },
        scanManual: {
          title: "No camera? Type it",
          body: "You can also type the hacker code on their badge instead.",
        },
        // Judging and questions
        judging: {
          title: "Judging on Sunday",
          body: "Judging stays locked until the judging workshop on Sunday morning. You'll pick your finalists here.",
        },
        help: {
          title: "Questions?",
          body: "Tap Help any time for your point of contact and the emergency contact. You can replay this tour from there too.",
        },
      },
    },
  },
} as const;
