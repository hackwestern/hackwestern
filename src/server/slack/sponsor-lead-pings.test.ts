import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { iveyWalkCopy } from "~/content/ivey-walk";
import type { RunOfShowTask } from "~/lib/run-of-show";
import type { HwContact } from "~/server/api/utils/sponsor-hw-contacts";
import { db } from "~/server/db";
import { sponsorLeadPings } from "~/server/db/schema";
import {
  desiredPing,
  planLeadPings,
  syncSponsorLeadPings,
  type PingSponsor,
} from "~/server/slack/sponsor-lead-pings";

const contacts: HwContact[] = [
  {
    name: "Noah Medland",
    phone: "",
    loginEmail: "noah@example.com",
    sameViewAs: "",
  },
  {
    name: "Caroline Wu",
    phone: "",
    loginEmail: "caroline@example.com",
    sameViewAs: "",
  },
];

const at = (iso: string) => new Date(`${iso}-05:00`);

const sponsor = (over: Partial<PingSponsor> = {}): PingSponsor => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Canada Life",
  leadCell: "Noah",
  digital: false,
  prizeTrack: false,
  chatsOn: false,
  workshops: [],
  chats: [],
  done: { availability: true, shortlist: true, finalists: false, top5: false },
  ...over,
});

const plan = (s: PingSponsor, tasks: RunOfShowTask[] = []) =>
  planLeadPings({ sponsors: [s], contacts, tasks }).pings;

describe("planLeadPings", () => {
  it("pings 15 min before the sponsor must arrive for their workshop", () => {
    const [p, ...rest] = plan(
      sponsor({
        workshops: [
          { start: "14:00", title: "Intro to APIs", location: "2230 (50)" },
        ],
      }),
    );
    expect(rest).toEqual([]);
    expect(p!.item).toBe("workshop:14:00");
    expect(p!.lead.email).toBe("noah@example.com");
    expect(p!.dueAt).toEqual(at("2026-11-21T13:45:00"));
    expect(p!.postAt).toEqual(at("2026-11-21T13:30:00"));
    expect(p!.text(15)).toBe(
      '⏰ Canada Life sets up their workshop in 15 min: arrive by 1:45 PM, Rm 2230. "Intro to APIs" starts at 2:00 PM.',
    );
  });

  it("pings 15 min before each coffee chat session, 30 at Ivey with the walk", () => {
    const pings = plan(
      sponsor({
        chatsOn: true,
        chats: [
          { placementId: "p1", rep: "Sam", start: 600, room: "2241" },
          { placementId: "p2", rep: "Ana", start: 840, room: "1352" },
        ],
      }),
    );
    const near = pings.find((p) => p.item === "chat:p1")!;
    const ivey = pings.find((p) => p.item === "chat:p2")!;
    expect(near.postAt).toEqual(at("2026-11-21T09:45:00"));
    expect(near.text(15)).toBe(
      "⏰ Canada Life: Sam's coffee chats start in 15 min (10:00 AM, Rm 2241).",
    );
    expect(ivey.postAt).toEqual(at("2026-11-21T13:30:00"));
    expect(ivey.dueAt).toEqual(at("2026-11-21T14:00:00"));
    expect(ivey.text(30)).toBe(
      [
        "⏰ Canada Life: Ana's coffee chats start in 30 min (2:00 PM, Ivey Rm 1352).",
        iveyWalkCopy.slackLine(iveyWalkCopy.sponsor, iveyWalkCopy.hackerMapUrl),
      ].join("\n"),
    );
  });

  it("gives no chat pings to a sponsor not doing chats", () => {
    const pings = plan(
      sponsor({
        chatsOn: false,
        chats: [{ placementId: "p1", rep: "Sam", start: 600, room: "2241" }],
      }),
    );
    expect(pings.filter((p) => p.item.startsWith("chat:"))).toEqual([]);
  });

  it("pings judging due steps for prize track sponsors only", () => {
    const due = (s: PingSponsor) =>
      plan(s)
        .filter((p) => p.item.startsWith("due:"))
        .map((p) => [p.item, p.postAt.toISOString()]);
    expect(due(sponsor({ prizeTrack: false }))).toEqual([]);
    expect(due(sponsor({ prizeTrack: true }))).toEqual([
      ["due:u3", at("2026-11-22T09:30:00").toISOString()],
      ["due:u5", at("2026-11-22T11:45:00").toISOString()],
    ]);
    const u3 = plan(sponsor({ prizeTrack: true })).find(
      (p) => p.item === "due:u3",
    )!;
    expect(u3.text(15)).toMatch(
      /^⏰ Canada Life: "Pick your finalists, up to \d+" is due in 15 min \(9:45 AM\) and isn't done yet\.$/,
    );
  });

  it("skips due steps that are already done", () => {
    const items = plan(
      sponsor({
        prizeTrack: true,
        chatsOn: true,
        done: {
          availability: true,
          shortlist: false,
          finalists: true,
          top5: false,
        },
      }),
    ).map((p) => p.item);
    expect(items).toEqual(["due:f7", "due:u5"]);
  });

  it("gives a digital sponsor no on-site pings, but keeps their due steps", () => {
    const items = plan(
      sponsor({
        digital: true,
        prizeTrack: true,
        chatsOn: true,
        workshops: [{ start: "14:00", title: "Talk", location: null }],
        chats: [{ placementId: "p1", rep: "Sam", start: 600, room: "2241" }],
      }),
    ).map((p) => p.item);
    expect(items).toEqual(["due:u3", "due:u5"]);
  });

  it("pings every lead the cell names, keyed per lead", () => {
    const pings = plan(
      sponsor({
        leadCell: "Noah / Caroline",
        workshops: [{ start: "14:00", title: "Talk", location: null }],
      }),
    );
    expect(pings.map((p) => p.key)).toEqual([
      "11111111-1111-4111-8111-111111111111:workshop:14:00:noah@example.com",
      "11111111-1111-4111-8111-111111111111:workshop:14:00:caroline@example.com",
    ]);
  });

  it("leaves the workshop to the organizer-reminders bot when the lead owns its task", () => {
    const tasks: RunOfShowTask[] = [
      {
        day: "Saturday",
        start: "13:30",
        task: "Set up Canada Life workshop",
        owner: "Noah",
      },
    ];
    const pings = plan(
      sponsor({
        leadCell: "Noah / Caroline",
        workshops: [{ start: "14:00", title: "Talk", location: null }],
      }),
      tasks,
    );
    expect(pings.map((p) => p.lead.name)).toEqual(["Caroline Wu"]);
  });

  it("lists sponsors whose HW lead isn't in HW Contacts", () => {
    const out = planLeadPings({
      sponsors: [sponsor({ leadCell: "Somebody" }), sponsor({ leadCell: "" })],
      contacts,
      tasks: [],
    });
    expect(out.pings).toEqual([]);
    expect(out.unmatched).toEqual([
      { sponsor: "Canada Life", lead: "Somebody" },
      { sponsor: "Canada Life", lead: "" },
    ]);
  });

  it("changes the content key when the item changes", () => {
    const key = (room: string) =>
      plan(
        sponsor({
          chatsOn: true,
          chats: [{ placementId: "p1", rep: "Sam", start: 600, room }],
        }),
      )[0]!.contentKey;
    expect(key("2241")).toBe(key("2241"));
    expect(key("2241")).not.toBe(key("2242"));
  });
});

describe("desiredPing", () => {
  const ping = plan(
    sponsor({
      chatsOn: true,
      chats: [{ placementId: "p1", rep: "Sam", start: 600, room: "2241" }],
    }),
  )[0]!;

  it("schedules ahead of time", () => {
    const d = desiredPing(ping, at("2026-11-21T08:00:00"))!;
    expect(d.mode).toBe("schedule");
    expect(d.postAt).toEqual(at("2026-11-21T09:45:00"));
    expect(d.text).toContain("in 15 min");
  });

  it("sends at once, with the real minutes, inside the window", () => {
    const d = desiredPing(ping, at("2026-11-21T09:52:00"))!;
    expect(d.mode).toBe("now");
    expect(d.text).toContain("in 8 min");
  });

  it("drops it once the chat started", () => {
    expect(desiredPing(ping, at("2026-11-21T10:00:00"))).toBeNull();
  });
});

describe("syncSponsorLeadPings (database, fake Slack)", () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const calls: string[] = [];
  let scheduled = 0;
  const fakeSlack = (async (url: string) => {
    const method = url.split("/").pop()!;
    calls.push(method);
    const data =
      method === "users.lookupByEmail"
        ? { ok: true, user: { id: "U1" } }
        : method === "conversations.open"
          ? { ok: true, channel: { id: "D1" } }
          : method === "chat.scheduleMessage"
            ? { ok: true, scheduled_message_id: `Q${++scheduled}` }
            : { ok: true, ts: "1.2" };
    return new Response(JSON.stringify(data), { status: 200 });
  }) as unknown as typeof fetch;

  const inputs = (done: Partial<PingSponsor["done"]> = {}) => ({
    sponsors: [
      sponsor({
        id,
        prizeTrack: true,
        done: {
          availability: true,
          shortlist: true,
          finalists: false,
          top5: false,
          ...done,
        },
      }),
    ],
    contacts,
    tasks: [],
  });
  const run = (now: string, done: Partial<PingSponsor["done"]> = {}) =>
    syncSponsorLeadPings({
      mode: "live",
      token: "xoxb-test",
      fetch: fakeSlack,
      now: at(now),
      sponsorIds: [id],
      inputs: inputs(done),
    });

  afterAll(async () => {
    await db.delete(sponsorLeadPings).where(eq(sponsorLeadPings.sponsorId, id));
  });

  it("schedules, keeps, then deletes a ping once its step is done", async () => {
    await db.delete(sponsorLeadPings).where(eq(sponsorLeadPings.sponsorId, id));
    const first = await run("2026-11-22T08:00:00");
    expect(first.scheduled).toBe(2);
    expect(calls.filter((c) => c === "chat.scheduleMessage")).toHaveLength(2);

    calls.length = 0;
    const again = await run("2026-11-22T08:05:00");
    expect(again.kept).toBe(2);
    expect(calls).toEqual([]);

    const done = await run("2026-11-22T08:10:00", { finalists: true });
    expect(done.cancelled).toBe(1);
    expect(done.kept).toBe(1);
    expect(calls).toEqual(["chat.deleteScheduledMessage"]);
    const rows = await db
      .select()
      .from(sponsorLeadPings)
      .where(eq(sponsorLeadPings.sponsorId, id));
    expect(rows.map((r) => r.key)).toEqual([`${id}:due:u5:noah@example.com`]);
  });

  it("dry mode changes nothing and logs what it would do", async () => {
    await db.delete(sponsorLeadPings).where(eq(sponsorLeadPings.sponsorId, id));
    calls.length = 0;
    const lines: string[] = [];
    const out = await syncSponsorLeadPings({
      mode: "dry",
      token: "xoxb-test",
      fetch: fakeSlack,
      now: at("2026-11-22T11:50:00"),
      sponsorIds: [id],
      inputs: inputs({ finalists: true }),
      log: (l) => lines.push(l),
    });
    expect(out.dry).toBe(1);
    expect(calls).toEqual([]);
    expect(lines[0]).toContain("would send now to Noah Medland");
    expect(lines[0]).toContain("is due in 10 min");
    const rows = await db
      .select()
      .from(sponsorLeadPings)
      .where(eq(sponsorLeadPings.sponsorId, id));
    expect(rows).toEqual([]);
  });

  it("sends at once inside the window, and never twice", async () => {
    await db.delete(sponsorLeadPings).where(eq(sponsorLeadPings.sponsorId, id));
    calls.length = 0;
    const out = await run("2026-11-22T11:50:00", { finalists: true });
    expect(out.sent).toBe(1);
    expect(calls.filter((c) => c === "chat.postMessage")).toHaveLength(1);
    const again = await run("2026-11-22T11:52:00", { finalists: true });
    expect(again.kept).toBe(1);
    expect(calls.filter((c) => c === "chat.postMessage")).toHaveLength(1);
  });

  it("does nothing when off", async () => {
    const out = await syncSponsorLeadPings({ mode: "off", inputs: inputs() });
    expect(out.scheduled + out.sent + out.dry).toBe(0);
  });
});
