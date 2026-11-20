import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildRoster,
  checkText,
  displayText,
  groupUnits,
  matchScore,
  parseRange,
  parseShiftList,
  planAll,
  planFinal,
  planUnit,
  readMessages,
  readPeople,
  readSchedule,
  readSignups,
  reminderOrdinal,
  renderTemplate,
  resolveEmail,
  type PersonRow,
  type Shift,
  type Unit,
} from "./auto-ping-schedule";
import { readCsv } from "./csv";

const FIXTURES = "src/server/slack/fixtures/auto-ping";
const fixture = (tab: string) =>
  readCsv(readFileSync(`${FIXTURES}/${tab}.csv`, "utf8"));
const iso = (d: Date | undefined) => d?.toISOString();

const HEADER = [
  "Role",
  "Full name",
  "Email",
  "Shift",
  "POC",
  "Personal note",
  "Send?",
  "Check-in message preview",
  "",
  "Check before sending",
  "Email override (use when not in the forms)",
];
/** A People grid from short rows: [role, name, email, shift, send, check, override]. */
function people(rows: string[][]): PersonRow[] {
  return readPeople([
    HEADER,
    ...rows.map(
      ([
        role,
        name,
        email = "",
        shift = "",
        send = "TRUE",
        check = "",
        override = "",
      ]) => [
        role!,
        name!,
        email,
        shift,
        "@Jess Xing",
        "",
        send,
        "",
        "",
        check,
        override,
      ],
    ),
  ]);
}

describe("schedule grid", () => {
  const grid = [
    ["Friday", "Saturday", "", "", "Sunday"],
    ["8pm - 1am", "1am - 9am", "9am - 3pm", "3pm - 8pm", "1am - 9am"],
    [
      "Ann Lee",
      "Bo Chan (2am start)",
      "Cy Diaz (12pm start)",
      "Di Eng (3-7pm)",
      "Ann Lee",
    ],
    ["Ed Fox (8-11pm)", "", "Fay Gil (bring snacks)", "Ann Lee "],
    [],
    ["Mentors per shift"],
    ["2", "1", "2", "2", "1"],
  ];
  const entries = readSchedule(grid, "Mentor", "Mentor schedule");
  const byName = (name: string) => entries.filter((e) => e.name === name);

  test("a block ending after midnight ends the next day", () => {
    const [fri] = byName("Ann Lee");
    expect(fri?.shift?.label).toBe("Fri 8pm-1am");
    expect(iso(fri?.shift?.start)).toBe("2026-11-21T01:00:00.000Z");
    expect(iso(fri?.shift?.end)).toBe("2026-11-21T06:00:00.000Z");
  });

  test('"Sun 1am-9am" is Sunday 1am', () => {
    const sun = byName("Ann Lee").find((e) => e.shift?.day === "Sun");
    expect(iso(sun?.shift?.start)).toBe("2026-11-22T06:00:00.000Z");
  });

  test("(2am start) and (12pm start) keep the block's end", () => {
    expect(byName("Bo Chan")[0]?.shift?.label).toBe("Sat 2am-9am");
    expect(byName("Cy Diaz")[0]?.shift?.label).toBe("Sat 12pm-3pm");
    // Kept so the People tab can flag the moved check-in time.
    expect(byName("Cy Diaz")[0]?.shift?.note).toBe("12pm start");
    expect(byName("Ann Lee")[0]?.shift?.note).toBeUndefined();
  });

  test("(3-7pm) and (8-11pm) replace the block's times", () => {
    expect(byName("Di Eng")[0]?.shift?.label).toBe("Sat 3pm-7pm");
    expect(byName("Ed Fox")[0]?.shift?.label).toBe("Fri 8pm-11pm");
  });

  test("any other note leaves the shift unknown, with the block and note for column D", () => {
    expect(byName("Fay Gil")[0]).toMatchObject({
      shift: null,
      text: "Sat 9am-3pm (bring snacks)",
    });
  });

  test("days fill forward, trailing spaces trimmed, counts table ignored", () => {
    const ann = byName("Ann Lee").sort((x, y) => x.sortAt - y.sortAt);
    expect(ann.map((e) => e.shift?.label)).toEqual([
      "Fri 8pm-1am",
      "Sat 3pm-8pm",
      "Sun 1am-9am",
    ]);
    expect(entries.some((e) => /per shift|^\d+$/.test(e.name))).toBe(false);
  });

  test("the counts table is ignored even without a blank row before it", () => {
    const noGap = [...grid.slice(0, 4), ...grid.slice(5)];
    expect(readSchedule(noGap, "Mentor", "x")).toHaveLength(entries.length);
  });

  test("a broken IMPORTRANGE (#REF!) throws instead of emptying the roster", () => {
    expect(() =>
      readSchedule([["#REF!"]], "Mentor", "Mentor schedule"),
    ).toThrow(/Mentor schedule.*#REF!/);
  });

  test("ranges: start takes the end's am/pm unless that's after the end", () => {
    expect(parseRange("3-7pm")).toEqual({ start: 900, end: 1140 });
    expect(parseRange("11-1pm")).toEqual({ start: 660, end: 780 });
    expect(parseRange("8:30am-1:30pm")).toEqual({ start: 510, end: 810 });
    expect(parseRange("8pm - 1am")).toEqual({ start: 1200, end: 1500 });
    expect(parseRange("soon")).toBeNull();
  });

  test("judges' typed shifts parse, and bad ones are reported", () => {
    const { shifts, bad } = parseShiftList(
      "Sun 8:30am-1:30pm, Sunday noon",
      "Judge",
    );
    expect(shifts.map((s) => s.label)).toEqual(["Sun 8:30am-1:30pm"]);
    expect(bad).toEqual(["Sunday noon"]);
  });
});

describe("names and emails", () => {
  test("loose name scores", () => {
    expect(matchScore("Aiden Alaei", "Aiden (Arman) Alaei")).toBe(3);
    expect(matchScore("jerry  ZHANG ", "Jerry Zhang")).toBe(3);
    expect(matchScore("Batra Saksham", "Saksham Batra")).toBe(2);
    expect(matchScore("Daniel Legada", "Daniel Ely Legada")).toBe(1);
    expect(matchScore("Ali", "Ali Khan")).toBe(0);
  });

  const roster = people([
    ["Mentor", "Kai Ito", "kai@example.com"],
    ["Mentor", "Lu Ma", "Not in sign-ups", "", "TRUE", "", "lu@example.com"],
  ]);
  const signups = readSignups(
    [
      ["Name", "Email"],
      ["Kai Ito", "old-kai@example.com"],
      ["Sahil Bedi", "Sahil@Example.com"],
      ["Rae Oh", "rae1@example.com"],
      ["Rae Oh", "rae2@example.com"],
      ["Volunteer Only", "vo@example.com"],
    ],
    "Mentor",
  );

  test("a People row's email (override first) wins over the contact info tabs", () => {
    expect(resolveEmail("Kai Ito", "Mentor", roster, signups)).toEqual({
      email: "kai@example.com",
      loose: null,
    });
    expect(resolveEmail("Lu Ma", "Mentor", roster, signups)).toMatchObject({
      email: "lu@example.com",
    });
  });

  test("a loose sign-up match gives the email and says it was loose", () => {
    expect(resolveEmail("Bedi Sahil", "Mentor", roster, signups)).toEqual({
      email: "sahil@example.com",
      loose: "Sahil Bedi",
    });
  });

  test("no email, or two different emails, is no answer", () => {
    expect(resolveEmail("Zed Zo", "Mentor", roster, signups)).toEqual({
      email: null,
      reason: "none",
    });
    expect(resolveEmail("Rae Oh", "Mentor", roster, signups)).toEqual({
      email: null,
      reason: "several",
    });
    // Contact info only counts for their own role.
    expect(
      resolveEmail("Volunteer Only", "Volunteer", roster, signups).email,
    ).toBeNull();
  });
});

describe("roster", () => {
  const schedule = readSchedule(
    [
      ["Friday", "Saturday"],
      ["8pm - 1am", "9am - 3pm"],
      ["Kai Ito", "Kai Ito"],
      ["Bedi Sahil", "New Person"],
      ["Rae Oh", "Odd Note (see Jess)"],
    ],
    "Mentor",
    "Mentor schedule",
  );
  const rows = people([
    [
      "Mentor",
      "Kai Ito",
      "kai@example.com",
      "stale",
      "TRUE",
      "Jess: call him\n🤖 old bot line",
    ],
    ["Mentor", "Sahil Bedi", "sahil@example.com"],
    ["Mentor", "Gone Away", "gone@example.com"],
    ["Mentor", "Rae Oh", "Not in sign-ups"],
    ["Mentor", "Odd Note", "odd@example.com"],
    ["Judge", "Kai Ito", "KAI@example.com", "Sun 8:30am-1:30pm"],
  ]);
  const signups = readSignups(
    [
      ["Name", "Email"],
      ["New Person", "new@example.com"],
      ["Rae Oh", "rae1@example.com"],
      ["Rae Oh", "rae2@example.com"],
    ],
    "Mentor",
  );
  const roster = buildRoster(rows, schedule, signups);
  const row = (name: string, role = "Mentor") =>
    roster.find((r) => r.fullName === name && r.role === role)!;
  const flags = (name: string) => row(name).flags.map((f) => f.text);

  test("schedule people get their shift recomputed", () => {
    expect(row("Kai Ito").newShift).toBe("Fri 8pm-1am, Sat 9am-3pm");
  });

  test("matched by email; a loose name lookup is flagged but still sends", () => {
    expect(row("Sahil Bedi").shifts).toHaveLength(1);
    expect(flags("Sahil Bedi")[0]).toMatch(/loose name match.*Bedi Sahil/);
    expect(row("Sahil Bedi").flags[0]?.blocking).toBe(false);
  });

  test("a new schedule person is a new row, Send? off, email in override", () => {
    expect(row("New Person")).toMatchObject({
      isNew: true,
      send: false,
      poc: "@Jess Xing",
      override: "new@example.com",
      newShift: "Sat 9am-3pm",
    });
  });

  test("someone no longer on the schedule is flagged and blocked", () => {
    expect(row("Gone Away").flags).toEqual([
      { text: "Not on the schedule anymore", blocking: true },
    ]);
  });

  test("two different emails for a name: flagged, blocked, not guessed", () => {
    expect(flags("Rae Oh")[0]).toMatch(/more than one email/);
    expect(row("Rae Oh").flags[0]?.blocking).toBe(true);
    expect(roster.filter((r) => r.fullName === "Rae Oh")).toHaveLength(1);
  });

  test("an unknown schedule note blocks timed messages", () => {
    expect(flags("Odd Note")[0]).toMatch(/Odd Note \(see Jess\)/);
    expect(
      planAll(roster, readMessages(fixture("Messages"))),
    ).not.toContainEqual(expect.objectContaining({ name: "Odd Note" }));
  });

  test("column J keeps other people's lines and replaces the bot's", () => {
    expect(
      checkText(row("Kai Ito").check, [{ text: "New", blocking: false }]),
    ).toBe("Jess: call him\n🤖 New");
    expect(checkText("Jess: call him", [])).toBe("Jess: call him");
  });

  test("a mentor who also judges is one person: one check-in, merged shifts", () => {
    const kai = groupUnits(roster).find((u) => u.email === "kai@example.com")!;
    expect(kai.rows).toHaveLength(2);
    expect(kai.role).toBe("Mentor");
    expect(kai.shifts.map((s) => s.label)).toEqual([
      "Fri 8pm-1am",
      "Sat 9am-3pm",
      "Sun 8:30am-1:30pm",
    ]);
    const plan = planUnit(kai, readMessages(fixture("Messages")));
    expect(plan.filter((p) => p.kind === "checkin")).toHaveLength(1);
    expect(plan[0]?.template).toBe("Check-in: Mentor");
  });
});

describe("rendering", () => {
  const values = {
    first_name: { text: "Ann" },
    note: { text: "" },
    channel: { text: "" },
    poc: { text: "<@U0CGMK4KX9A>", raw: true },
  };

  test("a blank {note} drops its line; the message still sends", () => {
    expect(renderTemplate("Hi {first_name}\n{note}\nBye", values)).toEqual({
      text: "Hi Ann\nBye",
    });
  });

  test("any other blank or unknown placeholder holds the message", () => {
    expect(renderTemplate("Hi {first_name}\n💬 {channel}", values)).toEqual({
      missing: "{channel}",
    });
    expect(renderTemplate("📶 Wi-Fi: {wifi}", values)).toEqual({
      missing: "{wifi}",
    });
  });

  test("text is escaped; our own mentions and channel links aren't", () => {
    const messages = readMessages([
      ["Message", "Template"],
      [
        "Check-in: Mentor",
        "Hi {first_name} & co <3, see {poc} in {mentor_channel}",
      ],
      ["{mentor_channel}", "C0CEZUSAVH6"],
    ]);
    const unit: Unit = {
      email: "a@example.com",
      name: "A <B>",
      firstName: "A<B>",
      role: "Mentor",
      rows: [],
      shifts: parseShiftList("Sat 9am-3pm", "Mentor").shifts,
      poc: "@Emily Liu",
      note: "",
    };
    const text = planUnit(unit, messages)[0]?.text;
    expect(text).toBe(
      "Hi A&lt;B&gt; &amp; co &lt;3, see <@U0CHE5NL5H7> in <#C0CEZUSAVH6>",
    );
    expect(displayText(text!)).toBe(
      "Hi A<B> & co <3, see @Emily Liu in #C0CEZUSAVH6",
    );
  });
});

describe("timing plan", () => {
  const messages = readMessages(fixture("Messages"));
  const unit = (shifts: string): Unit => ({
    email: "a@example.com",
    name: "Ann Lee",
    firstName: "Ann",
    role: "Mentor",
    rows: [],
    shifts: parseShiftList(shifts, "Mentor").shifts,
    poc: "@Jess Xing",
    note: "",
  });
  const summary = (shifts: string) =>
    planUnit(unit(shifts), messages).map(
      (p) => `${p.postAt.toISOString().slice(5, 16)} ${p.template}`,
    );

  test("ordinals: last is 'last', 2nd and 3rd by number, a 4th non-last gets none", () => {
    expect(reminderOrdinal(2, 2)).toBe("last");
    expect(reminderOrdinal(2, 3)).toBe("second");
    expect(reminderOrdinal(3, 4)).toBe("third");
    expect(reminderOrdinal(4, 5)).toBeNull();
    expect(reminderOrdinal(5, 5)).toBe("last");
  });

  test("check-in 30 min before, reminders 15 min before, after-shift at the end", () => {
    expect(summary("Fri 8pm-1am, Sat 9am-3pm, Sun 3pm-8pm")).toEqual([
      "11-21T00:30 Check-in: Mentor",
      "11-21T06:00 After a shift",
      "11-21T13:45 Shift reminder: second shift",
      "11-21T20:00 After a shift",
      "11-22T13:00 Last day",
      "11-22T19:45 Shift reminder: last shift",
    ]);
  });

  test("back-to-back shifts are one stretch: no wrap-up or reminder between", () => {
    const plan = planUnit(unit("Sat 9am-3pm, Sat 3pm-8pm"), messages);
    expect(plan.map((p) => p.template)).toEqual(["Check-in: Mentor"]);
    expect(plan[0]?.text).toContain("starts soon: Sat 9am-8pm");
    expect(plan[0]?.text).toContain(
      "All your shifts: Sat 9am-3pm, Sat 3pm-8pm",
    );
  });

  test("last day: Sunday 8 AM, only for a Sunday shift after 8 and a first day before Sunday", () => {
    expect(summary("Sat 9am-3pm, Sun 8am-3pm")).not.toContain(
      "11-22T13:00 Last day",
    );
    expect(
      summary("Sat 9am-3pm, Sun 1am-9am").some((s) => s.includes("Last day")),
    ).toBe(false);
    expect(
      summary("Fri 3pm-8pm, Sat 9am-3pm").some((s) => s.includes("Last day")),
    ).toBe(false);
    expect(summary("Sun 9am-3pm").some((s) => s.includes("Last day"))).toBe(
      false,
    );
  });

  test("a blank fill-in holds that message only", () => {
    const vol = {
      ...unit("Sat 9am-3pm, Sun 3pm-8pm"),
      role: "Volunteer" as const,
    };
    vol.shifts = vol.shifts.map((s): Shift => ({ ...s, role: "Volunteer" }));
    const plan = planUnit(vol, messages);
    expect(plan[0]).toMatchObject({
      template: "Check-in: Volunteer",
      text: null,
      missing: "{volunteer_channel}",
    });
    expect(plan.slice(1).every((p) => p.text)).toBe(true);
  });

  test("final thank you uses the first shift's role and needs {hackers}", () => {
    const final = planFinal(unit("Sat 9am-3pm"), messages, new Date());
    expect(final).toMatchObject({
      template: "Final thank you: Mentor",
      missing: "{hackers}",
    });
  });
});

test("the fixture snapshot plans sensibly", () => {
  const roster = buildRoster(
    readPeople(fixture("People")),
    [
      ...readSchedule(fixture("Mentor schedule"), "Mentor", "Mentor schedule"),
      ...readSchedule(
        fixture("Volunteer schedule"),
        "Volunteer",
        "Volunteer schedule",
      ),
    ],
    [
      ...readSignups(fixture("Mentor contact info"), "Mentor"),
      ...readSignups(fixture("Volunteer contact info"), "Volunteer"),
      ...readSignups(fixture("Judge contact info"), "Judge"),
    ],
  );
  expect(roster.filter((r) => r.isNew)).toEqual([]);
  expect(
    roster
      .filter((r) =>
        r.flags.some((f) => f.text === "Not on the schedule anymore"),
      )
      .map((r) => r.fullName),
  ).toEqual(["Ivan Kovac", "Jon Tan", "Alex Burns"]);
  const plan = planAll(roster, readMessages(fixture("Messages")));
  expect(plan.length).toBeGreaterThan(100);
  // Every key is unique, and no one gets two check-ins.
  expect(new Set(plan.map((p) => p.key)).size).toBe(plan.length);
  const checkins = plan.filter((p) => p.kind === "checkin").map((p) => p.email);
  expect(new Set(checkins).size).toBe(checkins.length);
});

test("a manual row keeps its typed role and shift and is never 'not on the schedule'", () => {
  const grid = [
    [...HEADER, "Manual row (not on a schedule)"],
    [
      "Mentor",
      "Jaz Test",
      "",
      "Fri 8pm-1am, Sat 9am-3pm",
      "@Jess Xing",
      "",
      "FALSE",
      "",
      "",
      "",
      "jaz@example.com",
      "TRUE",
    ],
    [
      "Mentor",
      "Typo Shift",
      "t@example.com",
      "Sat 9-3",
      "@Jess Xing",
      "",
      "TRUE",
      "",
      "",
      "",
      "",
      "TRUE",
    ],
  ];
  const schedule = readSchedule(
    [["Friday"], ["8pm - 1am"], ["Jaz Test"]],
    "Mentor",
    "Mentor schedule",
  );
  const roster = buildRoster(readPeople(grid), schedule);
  const jaz = roster.find((r) => r.fullName === "Jaz Test" && !r.isNew)!;
  expect(jaz.flags).toEqual([]);
  expect(jaz.newShift).toBeUndefined();
  expect(jaz.shifts.map((s) => s.label)).toEqual([
    "Fri 8pm-1am",
    "Sat 9am-3pm",
  ]);
  // The schedule's "Jaz Test" isn't matched to the manual row.
  expect(roster.some((r) => r.isNew && r.fullName === "Jaz Test")).toBe(true);
  // Shift format is still checked.
  expect(
    roster.find((r) => r.fullName === "Typo Shift")?.flags[0],
  ).toMatchObject({
    blocking: true,
  });
});
