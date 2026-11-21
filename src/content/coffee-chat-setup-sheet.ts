// Text the app writes into the "Coffee Chat Setup" tab of the Spon Team
// sheet (src/server/api/utils/coffee-chat-setup-sheet-mirror.ts). Column A
// "Sponsor" is the one column organizers type in; the app fills the rest.

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export const coffeeChatSetupSheetCopy = {
  tab: "Coffee Chat Setup",
  headers: [
    "Sponsor",
    "Preferences",
    "Hackers per chat",
    "Chat length",
    "Primary rep",
    "Primary phone",
    "Reps (chats wanted · free sessions)",
    "Chats wanted",
    "Hacker seats",
    "Shortlist",
    "Last saved",
  ],
  preferences: {
    submitted: (when: string) => `Submitted ${when}`,
    draft: "Draft",
    notStarted: "Not started",
  },
  chatLength: (minutes: number) => `${minutes} min`,
  rep: {
    primary: " (primary)",
    chats: (n: number) => (n === 0 ? "not chatting" : plural(n, "chat")),
    noSessions: "no free sessions",
    /** "Alex Kim (primary) · 555-0100 · 6 chats · 10–11, 1–2" */
    line: (parts: string[]) => parts.join(" · "),
  },
  shortlist: {
    submitted: (n: number) => `Submitted · ${plural(n, "hacker")}`,
    draft: (n: number) => `Draft · ${plural(n, "hacker")}`,
    none: "None",
  },
} as const;
