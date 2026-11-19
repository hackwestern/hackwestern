// User-facing copy for the sponsor badge scanner (/sponsors/[uuid]/scan).
// Keep wording here, not in components.

export const sponsorScanCopy = {
  seoTitle: "Scan a badge",
  eyebrow: "Coffee chats",
  title: "Scan a hacker's badge",
  // When opened from a candidate's "Offer coffee chat" (?hacker=).
  offerTitle: "Offer a coffee chat",
  offerIntro:
    "Pick an open time. They'll get your offer on their live site and accept or decline.",
  intro:
    "Point your camera at the QR code on a hacker's badge or their live site. Add them to Met at Hacker Fair and we'll invite them first.",

  camera: {
    heading: "Hold the QR code inside the frame",
    label: "Camera view",
    starting: "Starting camera…",
    scanning: "Looking for a QR code",
    denied: {
      title: "Camera blocked",
      body: "Allow camera access for this site in your browser settings and try again, or type their hacker code below.",
    },
    unavailable: {
      title: "No camera found",
      body: "This device doesn't have a camera we can use. Type their hacker code below, or open this link on your phone.",
    },
    error: {
      title: "Camera didn't start",
      body: "Something went wrong opening the camera. Try again, or type their hacker code below.",
    },
    retry: "Try again",
  },

  manual: {
    label: "Type their hacker code",
    hint: "The three words on their badge or wallet pass, like brave-otter-kite.",
    submit: "Look up",
    empty: "Type a hacker code first.",
  },

  lookingUp: "Checking the badge…",

  notHacker: {
    title: "Not a hacker badge",
    body: "That code isn't a Hack Western hacker's badge. Try scanning again.",
  },

  card: {
    eyebrow: "Offer a coffee chat",
    heading: (firstName: string) => `Chat with ${firstName}?`,
    timesLegend: "Start time",
    timesHint: (minutes: number) => `${minutes}-minute chat`,
    seatsLeft: (n: number) => (n === 1 ? "1 seat left" : `${n} seats left`),
    repLabel: "Your name (optional)",
    repHint: "So the hacker knows who to look for.",
    offer: "Offer chat",
    offering: "Sending…",
    room: (room: string) => room,
    roomTbd: "Room to be assigned",
    noTimes: {
      title: "No open times",
      body: (firstName: string) =>
        `Every remaining start time is full, or ${firstName} is already booked then.`,
    },
    timesError: "Couldn't load your open times. Try again in a minute.",
    offerError: "Couldn't send the offer. Try again.",
    timesRefreshed: "Open times updated.",
  },

  sent: {
    title: "Offer sent",
    body: (firstName: string, time: string, room: string | null) =>
      room
        ? `Offer sent to ${firstName} for ${time}, ${room}.`
        : `Offer sent to ${firstName} for ${time}.`,
    next: "They'll accept or decline on their live site. You'll see it under Your coffee chats.",
    viewChats: "Your coffee chats",
  },

  scanNext: "Scan next",
  cancel: "Cancel",

  hubLink: "Scan a badge",
} as const;
