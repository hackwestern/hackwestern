// User-facing copy for the sponsor portal's guided tours: the "?" How to
// menu, the first-visit offer, the callout controls and every step. The
// tour structure (targets, pages, clicks) is in src/lib/sponsor-tours.ts.
// Keep wording here, not in components.

export const sponsorTourCopy = {
  menu: {
    button: "How to",
    label: "How to guides",
    heading: "How to…",
    welcome: "Take the portal tour",
  },
  offer: {
    title: "New here?",
    body: "Take a 1-minute tour of your portal.",
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
  },

  tours: {
    welcome: {
      name: "Portal tour",
      steps: {
        welcome: {
          title: "This is your portal",
          body: "Everything your team needs this weekend lives here. Keep this link handy: no login needed.",
        },
        help: {
          title: "Need help?",
          body: "Tap this any time and we ping the Hack Western sponsor team. You'll see who's on the way.",
        },
        scan: {
          title: "Scan a badge",
          body: "Met a hacker you like? Scan their badge to offer them a coffee chat.",
        },
        chats: {
          title: "Coffee chats",
          body: "Your booked chats and the hackers who want to meet you.",
        },
        schedule: {
          title: "Your schedule",
          body: "Your booth, workshop and judging times, all weekend.",
        },
        judging: {
          title: "Judging",
          body: "Opens Sunday at 9:00 AM. You'll score projects and pick your top teams here.",
        },
        important: {
          title: "Important things to remember",
          body: "Where the sponsor lounge is, where to leave your things overnight, and who to call in an emergency.",
        },
        booths: {
          title: "Sponsor Bay",
          body: "The booth layout around the projector screen. Your booth is highlighted.",
        },
        map: {
          title: "The venue map",
          body: "One tap from every page. Replay this tour or find a quick how-to with the button next to it.",
        },
      },
    },

    coffeeChat: {
      name: "Offer a coffee chat",
      steps: {
        scan: {
          title: "Start with a scan",
          body: "Tap Scan a badge when you're talking to a hacker.",
        },
        camera: {
          title: "Point at their badge",
          body: "Scan the QR code on their badge or their live site. No camera? Type their hacker code instead.",
        },
        offer: {
          title: "Pick a time and send",
          body: "Choose an open start time and send the offer. Nothing is booked until they accept.",
        },
        candidates: {
          title: "Or pick from your candidates",
          body: "Hackers who said they're interested show up on Coffee chats. Offer a chat straight from the list.",
        },
        accept: {
          title: "They accept on their live site",
          body: "The hacker gets your offer on /live and accepts or declines. Accepted chats show up here.",
        },
      },
    },

    help: {
      name: "Ask for help",
      steps: {
        button: {
          title: "Need help?",
          body: "Tap here, pick what you need and add your name and phone number.",
        },
        next: {
          title: "What happens next",
          body: "We ping the sponsor team on Slack. This card shows when someone's on the way, then they come to your booth.",
        },
      },
    },

    map: {
      name: "Find your way",
      steps: {
        open: {
          title: "Open the map",
          body: "Tap Map. It's on every sponsor page.",
        },
        floors: {
          title: "Switch floors",
          body: "Each floor has its own plan. The pins show the rooms sponsors use.",
        },
        lounge: {
          title: "Sponsor lounge",
          body: "Rm 2110, floor 2. A space for sponsors all weekend.",
        },
        belongings: {
          title: "Your belongings",
          body: "Rm 2244, floor 2. Leave your things here overnight.",
        },
      },
    },

    judging: {
      name: "Judging on Sunday",
      steps: {
        tile: {
          title: "Judging opens Sunday",
          body: "This tile unlocks at 9:00 AM on Sunday. Come to the judging debrief at 8:30 AM first.",
        },
        intro: {
          title: "Your judging page",
          body: "Everything for judging happens here. It saves as you go.",
        },
        score: {
          title: "Score each project",
          body: "Give each project a score out of 10, and tap Save to shortlist for the strongest.",
        },
        shortlist: {
          title: "Open your shortlist",
          body: "Tap Your shortlist to see the teams you saved.",
        },
        send: {
          title: "Send your shortlist",
          body: "When you're happy with it, tap Send shortlist. We schedule each team to present in your room from 10:00.",
        },
        presentations: {
          title: "Presentations",
          body: "We schedule the teams you sent and tell them when to come to your room to present.",
        },
        rank: {
          title: (top: number) => `Round 2: your top ${top}`,
          body: (top: number) =>
            `After presentations we open round 2. Rank the teams that presented and submit your top ${top}.`,
        },
      },
    },
  },
} as const;
