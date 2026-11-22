import { afterEach, describe, expect, test } from "vitest";
import { eq, inArray, like, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import {
  judges,
  judgingAssignments,
  judgingTables,
  teamTracks,
  teams,
  users,
} from "~/server/db/schema";
import { ADJECTIVES, ANIMALS, THINGS } from "~/server/api/utils/hacker-id";
import {
  type HackerAccount,
  type ParsedProject,
  applyImport,
  extractHackerIds,
  loadAccounts,
  mapPrizes,
  parseCsv,
  parseDevpostDate,
  parseDevpostExport,
  parseBuiltWith,
  pickGithubUrl,
  planImport,
} from "~/server/teams/devpost-import";
import { describeFlag, report } from "../../../scripts/import-devpost-teams";

// Valid IDs built from the real word lists.
const hid = (i: number) => `${ADJECTIVES[i]}-${ANIMALS[i]}-${THINGS[i]}`;

/** The Devpost export's columns (from last year's file), plus an ID question. */
const HEADER = [
  "Project Title",
  "Submission Url",
  "Project Status",
  "Judging Status",
  "Highest Step Completed",
  "Project Created At",
  "Project Submitted At",
  "Submission Last Submitted At",
  "About The Project",
  '"Try it out" Links',
  "Video Demo Link",
  "Opt-In Prizes",
  "Built With",
  "Submitter First Name",
  "Submitter Last Name",
  "Submitter Email",
  "Paste Every Teammate's Hacker ID",
  "Additional Team Member Count",
  "Team Member 1 First Name",
  "Team Member 1 Last Name",
  "Team Member 1 Email",
];

interface Row {
  title: string;
  url: string;
  status?: string;
  submittedAt?: string;
  about?: string;
  links?: string;
  prizes?: string;
  builtWith?: string;
  ids?: string;
  /** Devpost names, submitter first. */
  people?: string[];
}

function csvOf(rows: Row[]): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) => {
    const [submitter = "Sub Mitter", ...rest] = r.people ?? [];
    const split = (n: string) => [n.split(" ")[0] ?? "", n.split(" ")[1] ?? ""];
    const cells = [
      r.title,
      r.url,
      r.status ?? "Submitted (Gallery/Visible)",
      "Pending",
      "Submit",
      "11/21/2025 21:23:35",
      r.submittedAt ?? "11/23/2025 04:02:56",
      "",
      r.about ?? "",
      r.links ?? "",
      "",
      r.prizes ?? "",
      r.builtWith ?? "",
      ...split(submitter),
      "sub@example.com",
      r.ids ?? "",
      String(rest.length),
      ...rest.flatMap((n) => [...split(n), "x@example.com"]),
    ];
    return cells.map(q).join(",");
  });
  return [HEADER.map(q).join(","), ...lines].join("\r\n");
}

let urlSeq = 0;
const url = () =>
  `https://hw13.devpost.com/submissions/test-${++urlSeq}-${Date.now()}`;

async function hacker(i: number) {
  const { user } = await mockSession(db);
  await db
    .update(users)
    .set({ hackerId: hid(i) })
    .where(eq(users.id, user.id));
  return user;
}

async function run(rows: Row[]) {
  const parsed = parseDevpostExport(csvOf(rows));
  const plan = planImport(parsed.projects, await loadAccounts(parsed.projects));
  const summary = await applyImport(plan);
  return { parsed, plan, summary };
}

const teamAt = (devpostUrl: string) =>
  db.query.teams.findFirst({ where: eq(teams.devpostUrl, devpostUrl) });

afterEach(async () => {
  await db.delete(judgingAssignments).where(sql`true`);
  await db.delete(judgingTables).where(sql`true`);
  await db
    .update(users)
    .set({ teamId: null, hackerId: null })
    .where(sql`true`);
  await db.delete(teams).where(like(teams.devpostUrl, "%/test-%"));
});

describe("parseCsv", () => {
  test("handles quotes, escaped quotes, commas and line breaks in fields", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
});

describe("extractHackerIds", () => {
  test("finds IDs in any mix of separators and case", () => {
    const text = `${hid(0)}, ${hid(1).toUpperCase()}\n${hid(2).replace(/-/g, " ")} ${hid(3).replace(/-/g, "_")}`;
    expect(extractHackerIds(text).ids).toEqual([
      hid(0),
      hid(1),
      hid(2),
      hid(3),
    ]);
  });

  test("flags near-misses as typos and ignores unrelated text", () => {
    const typo = `${ADJECTIVES[0]}-zzzz-${THINGS[0]}`;
    const { ids, typos } = extractHackerIds(
      `${hid(1)}, ${typo}, N/A, see above`,
    );
    expect(ids).toEqual([hid(1)]);
    expect(typos).toEqual([typo]);
  });

  test("drops repeats", () => {
    expect(extractHackerIds(`${hid(0)} ${hid(0)}`).ids).toEqual([hid(0)]);
  });
});

describe("field helpers", () => {
  test("parseDevpostDate reads Devpost's format as UTC", () => {
    expect(parseDevpostDate("11/23/2025 04:02:56")?.toISOString()).toBe(
      "2025-11-23T04:02:56.000Z",
    );
    expect(parseDevpostDate("")).toBeNull();
  });

  test("pickGithubUrl takes the first github.com link only", () => {
    expect(
      pickGithubUrl(
        "https://demo.app, https://github.com/a/b https://github.com/c/d",
      ),
    ).toBe("https://github.com/a/b");
    expect(
      pickGithubUrl("javascript:alert(1) https://gitlab.com/a/b"),
    ).toBeNull();
  });

  test("mapPrizes matches known names and reports the rest", () => {
    expect(
      mapPrizes("Best Use of Cohere, Best Developer Tool by Warp, Best Domain"),
    ).toEqual({
      tracks: ["Best Use of Cohere", "Best Domain"],
      unknown: ["Best Developer Tool by Warp"],
    });
  });

  test("parseBuiltWith splits on commas and drops repeats", () => {
    expect(parseBuiltWith("React, node.js,, react ,C#")).toEqual([
      "React",
      "node.js",
      "C#",
    ]);
    expect(parseBuiltWith("")).toEqual([]);
  });
});

describe("parseDevpostExport", () => {
  test("skips drafts, rejects bad rows, reads members and IDs", () => {
    const u = url();
    const parsed = parseDevpostExport(
      csvOf([
        {
          title: "Rover",
          url: u,
          about: "Line one,\nline two",
          links: "https://github.com/x/rover",
          prizes: "General",
          builtWith: "react, python",
          ids: `${hid(0)} ${hid(1)}`,
          people: ["Ada Lovelace", "Alan Turing"],
        },
        { title: "Half done", url: url(), status: "Draft" },
        { title: "", url: url() },
        { title: "Copy", url: u },
      ]),
    );
    expect(parsed.drafts).toEqual([{ line: 3, title: "Half done" }]);
    expect(parsed.rejected.map((r) => r.line)).toEqual([4, 5]);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]).toMatchObject({
      title: "Rover",
      devpostUrl: u,
      githubUrl: "https://github.com/x/rover",
      tracks: ["General"],
      techStack: ["react", "python"],
      ids: [hid(0), hid(1)],
      members: ["Ada Lovelace", "Alan Turing"],
    });
  });

  test("refuses a file without the expected columns", () => {
    expect(() => parseDevpostExport("Project Title\nx")).toThrow(
      /missing columns/,
    );
  });
});

describe("planImport", () => {
  const project = (
    title: string,
    ids: string[],
    submittedAt?: Date,
  ): ParsedProject => ({
    line: 2,
    title,
    devpostUrl: `https://d/${title}`,
    submittedAt: submittedAt ?? new Date("2025-11-23T04:00:00Z"),
    githubUrl: null,
    tracks: [],
    unknownPrizes: [],
    techStack: [],
    ids,
    typos: [],
    members: ["Ada Lovelace"],
  });
  const accounts = new Map<string, HackerAccount>(
    [0, 1, 2, 3, 4, 5].map((i) => [
      hid(i),
      { userId: `u${i}`, name: `Hacker ${i}` },
    ]),
  );

  test("links matches, flags not-hacker IDs and incorrect team size", () => {
    const [ok, missing, nobody, blank, big] = planImport(
      [
        project("ok", [hid(0)]),
        project("missing", [hid(1), hid(40)]),
        project("nobody", [hid(41), hid(42)]),
        project("blank", []),
        project("big", [hid(2), hid(3), hid(4), hid(5), hid(6 + 50)]),
      ],
      new Map([...accounts, [hid(56), { userId: "u56", name: null }]]),
    );
    expect(ok).toMatchObject({ linkUserIds: ["u0"], flags: [] });
    expect(missing).toMatchObject({
      linkUserIds: ["u1"],
      flags: [{ reason: "not_hacker", members: [hid(40)] }],
    });
    // One flag per team, every unmatched ID in it.
    expect(nobody?.linkUserIds).toEqual([]);
    expect(nobody?.flags).toEqual([
      { reason: "not_hacker", members: [hid(41), hid(42)] },
    ]);
    // No IDs entered at all: the Devpost names stand in.
    expect(blank?.flags).toEqual([
      { reason: "not_hacker", members: ["Ada Lovelace"] },
    ]);
    expect(big?.linkUserIds).toHaveLength(5);
    expect(big?.flags).toEqual([{ reason: "incorrect_team_size", matched: 5 }]);
  });

  test("a duplicate is linked to the earliest project and flagged on both", () => {
    const [late, early] = planImport(
      [
        project("late", [hid(0)], new Date("2025-11-23T05:00:00Z")),
        project("early", [hid(0)], new Date("2025-11-23T03:00:00Z")),
      ],
      accounts,
    );
    expect(late?.linkUserIds).toEqual([]);
    expect(early?.linkUserIds).toEqual(["u0"]);
    expect(late?.flags).toEqual([
      {
        reason: "duplicate",
        rawId: hid(0),
        name: "Hacker 0",
        otherProjects: ["early"],
        linkedHere: false,
      },
    ]);
    expect(early?.flags[0]).toMatchObject({
      reason: "duplicate",
      linkedHere: true,
    });
  });
});

describe("applyImport", () => {
  test("creates teams, links hackers, writes tracks and flags", async () => {
    const a = await hacker(0);
    const b = await hacker(1);
    const u = url();
    const { summary } = await run([
      {
        title: "Rover",
        url: u,
        prizes: "Best Domain",
        builtWith: "react, python",
        links: "https://github.com/x/rover",
        ids: `${hid(0)}, ${hid(1)}, ${hid(60)}`,
      },
    ]);
    expect(summary).toMatchObject({
      created: 1,
      updated: 0,
      linked: 2,
      flaggedTeams: 1,
    });

    const team = await teamAt(u);
    expect(team).toMatchObject({
      name: "Rover",
      submissionStatus: "submitted",
      githubUrl: "https://github.com/x/rover",
      tracks: ["Best Domain"],
      techStack: ["react", "python"],
      importFlags: [{ reason: "not_hacker", members: [hid(60)] }],
      judgingTableId: null,
    });
    expect(team?.joinCode).toHaveLength(6);
    const linked = await db.query.users.findMany({
      where: inArray(users.id, [a.id, b.id]),
    });
    expect(linked.every((x) => x.teamId === team?.id)).toBe(true);
    const trackRows = await db.query.teamTracks.findMany({
      where: eq(teamTracks.teamId, team!.id),
    });
    expect(trackRows.map((r) => r.track)).toEqual(["Best Domain"]);
  });

  test("re-running updates in place, clears fixed flags and unlinks dropped hackers", async () => {
    const a = await hacker(0);
    const b = await hacker(1);
    const u = url();
    await run([
      { title: "Rover", url: u, ids: `${hid(0)} ${hid(1)} ${hid(60)}` },
    ]);
    const first = await teamAt(u);

    const { summary } = await run([
      { title: "Rover v2", url: `${u}/`, ids: hid(0) },
    ]);
    expect(summary).toMatchObject({ created: 0, updated: 1, unlinked: 1 });
    const second = await teamAt(u);
    expect(second?.id).toBe(first?.id);
    expect(second?.name).toBe("Rover v2");
    expect(second?.importFlags).toBeNull();
    const [ua, ub] = await Promise.all(
      [a.id, b.id].map((id) =>
        db.query.users.findFirst({ where: eq(users.id, id) }),
      ),
    );
    expect(ua?.teamId).toBe(first?.id);
    expect(ub?.teamId).toBeNull();
  });

  test("never deletes a team missing from a later file", async () => {
    const u1 = url();
    const u2 = url();
    await run([
      { title: "One", url: u1 },
      { title: "Two", url: u2 },
    ]);
    await run([{ title: "One", url: u1 }]);
    expect(await teamAt(u2)).toBeDefined();
  });

  test("says seating must be re-run when tables are already seated", async () => {
    const u1 = url();
    await run([{ title: "Seated", url: u1 }]);
    const [table] = await db
      .insert(judgingTables)
      .values({ number: 901, zone: "Main" })
      .returning();
    await db
      .update(teams)
      .set({ judgingTableId: table!.id })
      .where(eq(teams.devpostUrl, u1));

    const { summary } = await run([
      { title: "Seated", url: u1 },
      { title: "Late arrival", url: url() },
    ]);
    expect(summary.reseatNeeded).toBe(true);
  });

  test("refuses once judging has started and writes nothing", async () => {
    const { user } = await mockSession(db);
    await db.insert(judges).values({ id: user.id });
    const [table] = await db
      .insert(judgingTables)
      .values({ number: 902, zone: "Main" })
      .returning();
    await db.insert(judgingAssignments).values({
      judgeId: user.id,
      judgingTableId: table!.id,
      position: 1,
      status: "in_progress",
    });

    const u = url();
    await expect(run([{ title: "Too late", url: u }])).rejects.toThrow(
      /Judging has started/,
    );
    expect(await teamAt(u)).toBeUndefined();
    await db.delete(judges).where(eq(judges.id, user.id));
  });
});

describe("report", () => {
  test("lists flagged teams with readable reasons and unmapped prizes", async () => {
    await hacker(0);
    const parsed = parseDevpostExport(
      csvOf([
        {
          title: "Rover",
          url: url(),
          prizes: "Best Developer Tool by Warp",
          ids: `${hid(0)}, ${ADJECTIVES[0]}-zzzz-${THINGS[0]}`,
        },
      ]),
    );
    const plan = planImport(
      parsed.projects,
      await loadAccounts(parsed.projects),
    );
    const text = report(plan, parsed);
    expect(text).toContain("1 submitted projects");
    expect(text).toContain(`not hacker: ${ADJECTIVES[0]}-zzzz-${THINGS[0]}`);
    expect(text).toContain("Best Developer Tool by Warp");
    expect(text).not.toContain("@example.com");
    expect(
      describeFlag({ reason: "incorrect_team_size", matched: 5 }),
    ).toContain("max 4");
  });
});
