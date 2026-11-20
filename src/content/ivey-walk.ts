// The Ivey walk disclaimer: one wording, shown everywhere an Ivey coffee
// chat room appears (rooms whose building is "ivey" in
// src/lib/coffee-chat-sessions.ts), each with a "Check map" link that opens
// the venue map on the Ivey building. Screens show the text next to a
// warning icon; Slack and email lead with the ⚠️ emoji instead.

const hacker =
  "This chat is in a different building (Ivey), a 15-minute walk away.";
const sponsor =
  "This chat is in a different building (Ivey), a 15-minute walk from the Sponsor Bay. Leave early.";
const reminder =
  "This chat is in a different building (Ivey), a 15-minute walk away. Leave now.";

const mapLink = "Check map";

/** Opens the map on the Ivey building (VenueMap's initial floor). */
const MAP_QUERY = "building=ivey";

export const iveyWalkCopy = {
  /** Hackers: /live Coffee chats, the invite DM and email. */
  hacker,
  /** Sponsors: portal Home, agenda, Your chats, schedule. */
  sponsor,
  /** The hacker's Slack reminder before an Ivey chat. */
  reminder,
  /** Short label for an icon's tooltip on the organizer board. */
  board: "Different building (Ivey), a 15-minute walk",
  mapLink,
  /** The hacker map on /live, opened on Ivey. */
  hackerMapPath: `/live?tab=map&${MAP_QUERY}`,
  hackerMapUrl: `https://www.hackwestern.com/live?tab=map&${MAP_QUERY}`,
  /** A sponsor's portal map, opened on Ivey. */
  sponsorMapPath: (uuid: string) => `/sponsors/${uuid}/map?${MAP_QUERY}`,
  /** The ⚠️ line for Slack or plain-text email. */
  withEmoji: (text: string) => `⚠️ ${text}`,
  /** The ⚠️ line plus a Slack mrkdwn link: "⚠️ … <url|Check map>". */
  // Slack wants & escaped in mrkdwn, links included.
  slackLine: (text: string, url: string) =>
    `⚠️ ${text} <${url.replace(/&/g, "&amp;")}|${mapLink}>`,
  /** The value of the ?building= query that opens the map on Ivey. */
  mapBuilding: "ivey",
} as const;
