// User-facing copy for the sponsor badge scanner (/sponsors/[uuid]/scan).
// Keep wording here, not in components.

export const sponsorScanCopy = {
  seoTitle: "Scan a badge",
  eyebrow: "Coffee chats",
  title: "Scan a hacker's badge",
  // When opened with ?hacker= (a hacker code or user id).
  offerTitle: "Add a hacker you met",
  offerIntro: "Add them to your list and we'll invite them to a coffee chat first.",
  intro:
    "Point your camera at the QR code on a hacker's badge or their live site. Add them to your list and we'll invite them to a coffee chat first.",

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
      body: "Type their hacker code below, or open this page on your phone to scan.",
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

  /** The hacker card: one job, add them to "Met at your booth". */
  card: {
    eyebrow: "Met at your booth",
    lookupError: "Couldn't look them up. Try again.",
  },

  scanNext: "Scan next",
  cancel: "Not now",

  hubLink: "Scan a badge",
} as const;
