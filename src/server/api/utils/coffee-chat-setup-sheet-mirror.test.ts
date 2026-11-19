import { describe, expect, test, vi } from "vitest";

import {
  SETUP_HEADERS,
  mirrorCoffeeChatSetup,
  setupSheetRows,
  setupTimestamp,
  writeCoffeeChatSetup,
  type SetupSheet,
  type SetupSponsor,
} from "~/server/api/utils/coffee-chat-setup-sheet-mirror";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";

// Fake sponsors and 555 phones only.
const submitted = new Date("2026-11-21T01:12:00Z"); // Fri 8:12 PM Toronto
const saved = new Date("2026-11-21T01:30:00Z");

const ACME: SetupSponsor = {
  name: "Acme",
  pref: {
    hackersPerChat: 3,
    longerOneOnOne: false,
    submittedAt: submitted,
    shortlistSubmittedAt: submitted,
    updatedAt: saved,
  },
  reps: [
    {
      name: "Alex Kim",
      phone: "555-0100",
      isPrimary: true,
      chatsWanted: 4,
      sessions: ["13", "10"],
    },
    {
      name: "Bo Lee",
      phone: "555-0101",
      isPrimary: false,
      chatsWanted: 0,
      sessions: [],
    },
  ],
  shortlistCount: 12,
};

const GLOBEX: SetupSponsor = {
  name: "Globex",
  pref: null,
  reps: [
    {
      name: "Cy Ng",
      phone: "555-0102",
      isPrimary: true,
      chatsWanted: 1,
      sessions: ["11"],
    },
  ],
  shortlistCount: 2,
};

const QUIET: SetupSponsor = {
  name: "Quiet Co",
  pref: null,
  reps: [],
  shortlistCount: 0,
};

describe("setupSheetRows", () => {
  test("one row per sponsor in the session model", () => {
    const rows = setupSheetRows(["Acme"], [ACME]);
    expect(rows[0]).toEqual([...SETUP_HEADERS]);
    expect(rows[1]).toEqual([
      "Acme",
      `Submitted ${setupTimestamp(submitted)}`,
      "3",
      "30 min",
      "Alex Kim",
      "555-0100",
      "Alex Kim (primary) · 555-0100 · 4 chats · 10–11, 1–2\nBo Lee · 555-0101 · not chatting · no free sessions",
      "4",
      "12",
      "Submitted · 12 hackers",
      setupTimestamp(saved),
    ]);
  });

  test("drafts, not started, and a 15-minute 1-on-1", () => {
    const solo = {
      ...ACME,
      pref: {
        ...ACME.pref!,
        hackersPerChat: 1,
        submittedAt: null,
        shortlistSubmittedAt: null,
      },
    };
    const [, soloRow, globexRow, quietRow] = setupSheetRows(
      ["Acme", "Globex", "Quiet Co"],
      [solo, GLOBEX, QUIET],
    );
    expect(soloRow?.slice(1, 4)).toEqual(["Draft", "1", "15 min"]);
    expect(soloRow?.[9]).toBe("Draft · 12 hackers");
    // Reps saved without preferences: a draft, no seats yet.
    expect(globexRow?.slice(1, 3)).toEqual(["Draft", ""]);
    expect(globexRow?.[8]).toBe("");
    expect(globexRow?.[9]).toBe("Draft · 2 hackers");
    expect(quietRow).toEqual([
      "Quiet Co",
      "Not started",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "None",
      "",
    ]);
  });

  test("keeps the organizers' column A, appends unlisted sponsors with data", () => {
    const rows = setupSheetRows(
      ["Quiet Co", "", "acme", "Quiet Co", "Total", "Not In DB"],
      [ACME, GLOBEX, QUIET],
    );
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      "Quiet Co",
      "acme",
      "Not In DB",
      "Globex",
    ]);
    // Matched case-insensitively, spelled as listed.
    expect(rows[2]?.[1]).toMatch(/^Submitted/);
    expect(rows[3]?.[1]).toBe("Not started");
  });
});

function fakeSheet(listed: string[]) {
  const calls: string[] = [];
  const writes: { range: string; values: string[][] }[] = [];
  const sheet: SetupSheet = {
    read: vi.fn(async (range: string) => {
      calls.push(`read ${range}`);
      return listed.map((name) => [name]);
    }),
    write: vi.fn(async (range: string, values: string[][]) => {
      calls.push(`write ${range}`);
      writes.push({ range, values });
    }),
    clear: vi.fn(async (range: string) => {
      calls.push(`clear ${range}`);
    }),
  };
  return { sheet, calls, writes };
}

describe("writeCoffeeChatSetup", () => {
  test("reads column A, writes from A1, clears the rows below", async () => {
    const { sheet, calls, writes } = fakeSheet(["Acme", "Quiet Co"]);
    const n = await writeCoffeeChatSetup(sheet, async () => [
      ACME,
      GLOBEX,
      QUIET,
    ]);
    expect(n).toBe(3);
    expect(calls).toEqual([
      "read 'Coffee Chat Setup'!A2:A",
      "write 'Coffee Chat Setup'!A1",
      "clear 'Coffee Chat Setup'!A5:Z",
    ]);
    expect(writes[0]?.values.map((r) => r[0])).toEqual([
      "Sponsor",
      "Acme",
      "Quiet Co",
      "Globex",
    ]);
  });

  test("a run that a newer one replaced stops before writing", async () => {
    const { sheet, calls } = fakeSheet(["Acme"]);
    await writeCoffeeChatSetup(
      sheet,
      async () => [ACME],
      () => false,
    );
    expect(calls).toEqual(["read 'Coffee Chat Setup'!A2:A"]);
  });
});

describe("under Vitest", () => {
  test("the mirror writes nothing and says disabled", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sheet = vi.fn();
    await expect(mirrorCoffeeChatSetup({ sheet })).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    expect(sheet).not.toHaveBeenCalled();
  });

  test("prize tracks fall back to the built-in list when the sheet can't be read", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(prizeTrackSponsors()).resolves.toEqual(SPONSOR_PRIZE_TRACKS);
  });
});
