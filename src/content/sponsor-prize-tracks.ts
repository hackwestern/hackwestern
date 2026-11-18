// Sponsors with a prize track (Jazz, 2026-11-18). Only these sponsors take
// part in Sunday judging: the portal's Judging tile, the round 1 shortlist,
// presentations and round 2. Everyone else sees a "No prize track" note.
//
// Edit this list to add or remove a track. Names match registered sponsor
// names loosely (case, spaces and punctuation are ignored, and a registered
// name that contains one of these counts), so "Sun Life" or "Sun Life
// Financial" still match "Sunlife". A name here with no registered sponsor
// yet (PCBWay, for now) is fine: it still shows on the Sponsor Judging tab.

export const SPONSOR_PRIZE_TRACKS = [
  "Scotiabank",
  "Sunlife",
  "Canada Life",
  "QNX",
  "TinyFish",
  "PCBWay",
] as const;
