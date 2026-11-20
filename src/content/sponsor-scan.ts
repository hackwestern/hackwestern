// User-facing copy for the sponsor badge scanner (/sponsors/[uuid]/scan).
// Keep wording here, not in components.

export const sponsorScanCopy = {
  seoTitle: "Scan a hacker",
  eyebrow: "Coffee chats",
  title: "Scan a hacker",
  // When opened with ?hacker= (a hacker code or user id).
  offerTitle: "Add a hacker you met",
  offerIntro:
    "Add them to your list and we'll invite them to a coffee chat first.",
  intro:
    "Scan hackers you meet at your booth. They're invited to chat before anyone on your shortlist.",
  /** Once chats are confirmed (mock sponsor-chats-v3). */
  introLive:
    "Scan a hacker you meet and we'll invite them to the next open seat in your chats.",

  camera: {
    heading: "Point at the QR code on their pass",
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
    open: "Enter a hacker code instead",
    heading: "Enter a hacker code",
    useCamera: "Use the camera",
    label: "Hacker code",
    hint: "The three words on their badge or wallet pass, like brave-otter-kite.",
    submit: "Find hacker",
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

  scanNext: "Scan the next hacker",
  notThem: "Not them? Scan again",
  cancel: "Not now",

  hubLink: "Scan a badge",
} as const;
