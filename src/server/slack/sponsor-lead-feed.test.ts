import { describe, expect, it } from "vitest";

import { sponsorLeadSlackCopy } from "~/content/sponsor-lead-slack";
import type { HwContact } from "~/server/api/utils/sponsor-hw-contacts";
import type { SponsorInfoRecord } from "~/server/api/utils/sponsor-sheets";
import {
  FEED_GROUP_MAX,
  feedParts,
  flushFeed,
  planFeedMessages,
  type FeedEvent,
} from "~/server/slack/sponsor-lead-feed";
import { parseLeadSlackMode } from "~/server/slack/sponsor-leads";

const copy = sponsorLeadSlackCopy.feed;

const contact = (name: string, loginEmail: string): HwContact => ({
  name,
  phone: "",
  loginEmail,
  sameViewAs: "",
});

const contacts = [
  contact("Noah Medland", "noah@example.com"),
  contact("Caroline Wu", "caroline@example.com"),
  contact("Daniel Kim", "daniel@example.com"),
  contact("No Email", ""),
];

const info = (hwContact: string) =>
  ({ hwContact }) as unknown as SponsorInfoRecord;

const dir = {
  contacts,
  info: new Map([
    ["canadalife", info("Noah")],
    ["shopify", info("Noah / Daniel")],
    ["qnx", info("Somebody Else")],
    ["nolead", info("No Email")],
  ]),
};

const caroline = {
  kind: "organizer" as const,
  email: "Caroline@Example.com",
  name: "Caroline W",
};
const noah = {
  kind: "organizer" as const,
  email: "noah@example.com",
  name: "Noah",
};

const status = (
  sponsorName: string,
  value: string,
  actor: FeedEvent["actor"] = caroline,
): FeedEvent => ({
  sponsorName,
  group: "status",
  text: copy.status(value),
  latestOnly: true,
  actor,
});

describe("planFeedMessages", () => {
  it("DMs the sponsor's lead one line, saying who changed it", () => {
    const { messages } = planFeedMessages(
      [status("Canada Life", "Booth set up")],
      dir,
    );
    expect(messages).toEqual([
      {
        lead: { row: 0, name: "Noah Medland", email: "noah@example.com" },
        sponsorName: "Canada Life",
        text: "📣 Canada Life: Status → Booth set up (by Caroline)",
      },
    ]);
  });

  it("skips a change the lead made themselves", () => {
    const { messages } = planFeedMessages(
      [status("Canada Life", "Arrived", noah)],
      dir,
    );
    expect(messages).toEqual([]);
  });

  it("still tells a co-lead about the other lead's change", () => {
    const { messages } = planFeedMessages(
      [status("Shopify", "Arrived", noah)],
      dir,
    );
    expect(messages.map((m) => m.lead.name)).toEqual(["Daniel Kim"]);
    expect(messages[0]!.text).toBe("📣 Shopify: Status → Arrived (by Noah)");
  });

  it("coalesces a burst into one message per sponsor and lead", () => {
    const placed = Array.from({ length: 6 }, (_, i) => ({
      sponsorName: "Canada Life",
      group: "placed" as const,
      text: copy.placed(`Rep ${i}`, "2:00 PM", "2241"),
      actor: caroline,
    }));
    const { messages } = planFeedMessages(
      [
        status("Canada Life", "Arrived"),
        ...placed,
        status("Canada Life", "Booth set up"),
      ],
      dir,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]!.text).toBe(
      `📣 Canada Life: Status → Booth set up; ${copy.many.placed(6)} (by Caroline)`,
    );
  });

  it("keeps a few changes of one kind as lines, collapses past the max", () => {
    const moved = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        group: "moved" as const,
        text: `m${i}`,
        actor: caroline,
      }));
    expect(feedParts(moved(FEED_GROUP_MAX))).toEqual(["m0", "m1", "m2"]);
    expect(feedParts(moved(FEED_GROUP_MAX + 1))).toEqual([
      copy.many.moved(FEED_GROUP_MAX + 1),
    ]);
  });

  it("gives a hacker's answer no 'by', one line per person", () => {
    const { messages } = planFeedMessages(
      [
        status("Canada Life", "Arrived"),
        {
          sponsorName: "Canada Life",
          group: "accepted",
          text: copy.accepted("Alex", "Sam", "2:00 PM"),
          actor: { kind: "other" },
        },
      ],
      dir,
    );
    expect(messages[0]!.text).toBe(
      [
        "📣 Canada Life: Status → Arrived (by Caroline)",
        "📣 Canada Life: Alex accepted Sam's 2:00 PM chat",
      ].join("\n"),
    );
  });

  it("matches the registered name loosely and escapes it", () => {
    const { messages } = planFeedMessages(
      [status("Canada <Life>", "Arrived")],
      {
        ...dir,
        info: new Map([["canadalife", info("Noah")]]),
      },
    );
    expect(messages[0]?.text).toContain("Canada &lt;Life&gt;");
  });

  it("reports sponsors whose lead isn't in HW Contacts with an email", () => {
    const { messages, unmatched } = planFeedMessages(
      [status("QNX", "Arrived"), status("NoLead", "Arrived")],
      dir,
    );
    expect(messages).toEqual([]);
    expect(unmatched).toEqual([
      { sponsor: "QNX", lead: "Somebody Else" },
      { sponsor: "NoLead", lead: "No Email" },
    ]);
  });
});

describe("flushFeed", () => {
  it("only logs in dry mode", async () => {
    const lines: string[] = [];
    const out = await flushFeed([status("Canada Life", "Arrived")], {
      mode: "dry",
      directory: dir,
      token: "xoxb-test",
      fetch: () => {
        throw new Error("no Slack in a dry run");
      },
      log: (l) => lines.push(l),
    });
    expect(out.logged).toBe(1);
    expect(lines).toEqual([
      "[sponsor lead feed] dry run, to Noah Medland: 📣 Canada Life: Status → Arrived (by Caroline)",
    ]);
  });

  it("does nothing when off", async () => {
    const out = await flushFeed([status("Canada Life", "Arrived")], {
      mode: "off",
      directory: dir,
    });
    expect(out).toEqual({ sent: 0, logged: 0, failed: 0, notFound: 0 });
  });

  it("DMs the lead by their Login email when live (fake Slack)", async () => {
    const calls: { method: string; body: string }[] = [];
    const fakeSlack = (async (url: string, init: RequestInit) => {
      const method = url.split("/").pop()!;
      calls.push({ method, body: String(init.body) });
      const data =
        method === "users.lookupByEmail"
          ? { ok: true, user: { id: "U1" } }
          : method === "conversations.open"
            ? { ok: true, channel: { id: "D1" } }
            : { ok: true, ts: "1.2" };
      return new Response(JSON.stringify(data), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await flushFeed([status("Canada Life", "Arrived")], {
      mode: "live",
      directory: dir,
      token: "xoxb-test",
      fetch: fakeSlack,
    });
    expect(out.sent).toBe(1);
    expect(calls.map((c) => c.method)).toEqual([
      "users.lookupByEmail",
      "conversations.open",
      "chat.postMessage",
    ]);
    expect(calls[0]!.body).toContain("noah%40example.com");
  });
});

describe("parseLeadSlackMode", () => {
  it("is off unless set to 1 or dry", () => {
    expect(parseLeadSlackMode(undefined)).toBe("off");
    expect(parseLeadSlackMode("")).toBe("off");
    expect(parseLeadSlackMode("0")).toBe("off");
    expect(parseLeadSlackMode("yes")).toBe("off");
    expect(parseLeadSlackMode("1")).toBe("live");
    expect(parseLeadSlackMode(" dry ")).toBe("dry");
    expect(parseLeadSlackMode("dry-run")).toBe("dry");
  });
});
