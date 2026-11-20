import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { readCsv } from "./csv";
import {
  planOrganizerReminders,
  planTeamPosts,
  readContacts,
  readRoster,
  readRunOfShow,
} from "./organizer-schedule";

const header = ["Time", "Big Event", "Workshop 1", "Ops", "", "Free", "Noted"];
/** A tiny Schedule View: Friday rows, then Saturday after a time jump. */
const grid = [
  ["", "Hack Western 13: Run of Show"],
  header,
  ["FRIDAY"],
  ["12:00 PM", "", "", "", "", "Ann, Bob, Cat, Dan, Eve, Jo"],
  [
    "4:45 PM",
    "Registration desk\nOwner: Ann, Bobby Smith\nStarts: 5:00 PM\nLocation: Rm 1110",
    "Sponsor intro\nOwner: Spon, Cat (Spon lead)\nLocation: 2110",
    "",
  ],
  ["5:00 PM", "Registration desk\nOwner: Ann\nLocation: Rm 1110"],
  ["6:00 PM", "HACKING STARTS", "Mystery task\nOwner: Sponsorship"],
  ["7:00 PM", "ALL ORGANIZERS ARRIVE\nOwner: Everyone"],
  [
    "Friday night to Saturday morning | Overnight coverage\n12:00–5:00 AM: Dan is captain, then Eve takes over from 4:00 to 5:00 AM.",
  ],
  ["9:00 AM", "", "", "Judging\nOwner: Brittany\nJo: run the timer"],
  ["10:00 AM", "Untitled\nNotes: nobody"],
];
const contactsGrid = [
  ["Name", "Position", "Email"],
  ["Ann Lee", "Events Lead", "ann@example.com"],
  ["Bobby Smith", "Web", "bob@example.com"],
  ["Cat Wu", "Sponsorship Lead", "cat@example.com / cat2@example.com"],
  ["Dan Ko", "Sponsorship", "dan@example.com"],
  ["Eve Park", "Design", "eve@example.com"],
  ["Jo One", "Web", "jo1@example.com"],
  ["Jo Two", "Web", "jo2@example.com"],
  ["Zed Out", "Sponsorship", "zed@example.com"],
];

describe("readRunOfShow", () => {
  const roster = readRoster(grid);
  const contacts = readContacts(contactsGrid, roster, { Bob: "Bobby Smith" });
  const { tasks, skipped } = readRunOfShow(grid, contacts.people);
  const find = (title: string) => tasks.filter((t) => t.title === title);

  test("roster from the Free column; shared first names stay unmatched", () => {
    expect(roster).toEqual(["Ann", "Bob", "Cat", "Dan", "Eve", "Jo"]);
    expect(contacts.unmatched).toEqual(["Jo"]);
    expect(contacts.people.find((p) => p.name === "Cat")?.emails).toEqual([
      "cat@example.com",
      "cat2@example.com",
    ]);
    // Not on the run of show, but still on a team.
    expect(contacts.people.some((p) => p.name === "Zed")).toBe(true);
  });

  test("owners by full name, first name, alias, role line and team", () => {
    expect(find("Registration desk")[0]?.owners).toEqual(["Bob", "Ann"]);
    const intro = find("Sponsor intro")[0];
    expect(intro?.owners).toEqual(
      expect.arrayContaining(["Cat", "Dan", "Zed"]),
    );
    expect(intro?.teams).toEqual(["Sponsorship"]);
    // No SATURDAY header: the jump from 7:00 PM back to 9:00 AM is a new day.
    expect(find("Judging")[0]?.at).toEqual(new Date("2026-11-21T14:00:00Z"));
  });

  test("a bracketed team word isn't a team owner", () => {
    const cells = readRunOfShow(
      [
        header,
        ["FRIDAY"],
        ["12:00 PM", "Debrief\nOwner: Ann (Spon winners)", "", "", "", "Ann"],
      ],
      contacts.people,
    );
    expect(cells.tasks[0]).toMatchObject({ owners: ["Ann"], teams: [] });
  });

  test("Everyone means the roster, not every contact", () => {
    const all = find("ALL ORGANIZERS ARRIVE")[0];
    expect(all?.everyone).toBe(true);
    expect(all?.owners.sort()).toEqual(roster);
  });

  test("overnight notes: a 'from 4:00' clause starts later", () => {
    expect(
      find("Overnight coverage").map((t) => [t.at.toISOString(), t.owners]),
    ).toEqual([
      ["2026-11-21T09:00:00.000Z", ["Eve"]],
      ["2026-11-21T05:00:00.000Z", ["Dan"]],
    ]);
  });

  test("skips banners quietly and reports owners it can't place", () => {
    expect(skipped.map((s) => [s.title, s.reason])).toEqual([
      ["Untitled", "no owner listed"],
    ]);
    // "Owner: Sponsorship" alone is the team.
    expect(find("Mystery task")[0]?.teams).toEqual(["Sponsorship"]);
  });
});

describe("planOrganizerReminders", () => {
  const roster = readRoster(grid);
  const { people } = readContacts(contactsGrid, roster, { Bob: "Bobby Smith" });
  const { tasks } = readRunOfShow(grid, people);
  const plan = planOrganizerReminders(tasks);

  test("posts 15 minutes before the row time, one DM per person and time", () => {
    const ann = plan.filter((r) => r.recipientName === "Ann");
    expect(ann[0]).toMatchObject({
      reminderKey: "organizer:Ann:2026-11-20T21:45:00.000Z",
      postAt: new Date("2026-11-20T21:30:00Z"),
    });
    expect(ann[0]?.text).toContain(
      "⏰ In 15 min (4:45 PM): *Registration desk*",
    );
    expect(ann[0]?.text).toContain("> Location: Rm 1110");
    expect(ann[0]?.text).toContain("👥 With: Bob");
    expect(ann[0]?.text).toContain(
      "➡️ Next for you: 7:00 PM · ALL ORGANIZERS ARRIVE",
    );
  });

  test("a repeated row for the same task is one reminder", () => {
    expect(
      plan.filter(
        (r) =>
          r.recipientName === "Ann" && r.text.includes("Registration desk"),
      ),
    ).toHaveLength(1);
  });

  test("skip list and owner change both change the plan", () => {
    expect(
      planOrganizerReminders(tasks, { skipNames: new Set(["ann"]) }).some(
        (r) => r.recipientName === "Ann",
      ),
    ).toBe(false);
    // Owner changed in the sheet: the DM goes to the new person instead.
    const edited = grid.map((row) =>
      row.map((cell) => cell.replace("Owner: Brittany", "Owner: Eve")),
    );
    const next = planOrganizerReminders(readRunOfShow(edited, people).tasks);
    const judging = (p: typeof plan) =>
      p.filter((r) => r.text.includes("*Judging*")).map((r) => r.recipientName);
    // Brittany isn't on this roster; Jo is named by the role line.
    expect(judging(plan)).toEqual(["Jo"]);
    expect(judging(next).sort()).toEqual(["Eve", "Jo"]);
  });
});

test("the HW13 snapshot parses: every task has an owner and a time", () => {
  const snapshot = readCsv(
    readFileSync("context/HW13_Run_of_Show_snapshot.csv", "utf8"),
  );
  const { roster, tasks, skipped } = readRunOfShow(snapshot);
  expect(roster).toHaveLength(27);
  expect(tasks.length).toBeGreaterThan(90);
  // Without the contacts sheet, team-only owners ("All of Spon") are skipped.
  expect(skipped.map((s) => s.title)).toEqual([
    "Greet Sponsors",
    "Coffee Chats and Interviews",
    "Sponsor Track Shortlisting",
    "Sponsor Judging",
    "Post-Ceremony Gap (3:00-6:00 PM)",
  ]);
  const plan = planOrganizerReminders(tasks);
  expect(plan[0]).toMatchObject({
    postAt: new Date("2026-11-20T17:15:00Z"),
  });
  expect(plan.every((r) => r.reminderKey.length <= 64)).toBe(true);
});

test('"Everyone except Sarina, Daniel" leaves those two out', () => {
  const g = [
    header,
    ["FRIDAY"],
    ["12:00 PM", "", "", "", "", "Ann, Bob, Cat, Dan"],
    [
      "1:00 PM",
      "Demo Fair\nOwner: Everyone except Cat, Dan\nAnn: run the timer",
    ],
  ];
  const [task] = readRunOfShow(g).tasks;
  expect(task?.owners.sort()).toEqual(["Ann", "Bob"]);
  expect(readRunOfShow(g).unrecognized).toEqual([]);
});

test("a team-owned task is posted in that team's channel, once", () => {
  const g = [
    header,
    ["FRIDAY"],
    ["12:00 PM", "", "", "", "", "Ann, Bob"],
    [
      "1:00 PM",
      "",
      "",
      "Cheat Check\nOwner: Ann (lead), WEB\nLocation: Rm 2230",
    ],
    ["2:00 PM", "", "", "Cheat Check\nOwner: Ann (lead), WEB"],
    ["3:00 PM", "Snacks\nOwner: Bob"],
  ];
  const people = readContacts(
    [
      ["Name", "Position", "Email"],
      ["Ann Lee", "Web Lead", "ann@example.com"],
      ["Bob Kim", "Events", "bob@example.com"],
    ],
    ["Ann", "Bob"],
  ).people;
  const posts = planTeamPosts(readRunOfShow(g, people).tasks, {
    channels: { Web: "CWEB", Events: "CEVENTS" },
  });
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    team: "Web",
    channel: "CWEB",
    postAt: new Date("2026-11-20T17:45:00Z"),
  });
  expect(posts[0]?.text).toContain("*Cheat Check*");
  expect(posts[0]?.text).toContain("> Location: Rm 2230");
  expect(posts[0]?.text).toContain("👥 Web team: Ann");
});
