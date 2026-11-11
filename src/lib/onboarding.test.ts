import { describe, expect, test } from "vitest";
import { RSVP_DEADLINE } from "~/lib/date";
import { buildChecklist } from "./onboarding";

const DAY = 24 * 60 * 60 * 1000;
// A fixed time while RSVP is open, so these don't change once it really closes
const OPEN = RSVP_DEADLINE.getTime() - 9 * DAY;
const CLOSED = RSVP_DEADLINE.getTime() + DAY;

const done = (c: ReturnType<typeof buildChecklist>) =>
  c?.steps.filter((s) => s.done).map((s) => s.id);

describe("buildChecklist", () => {
  test("not admitted: no checklist", () => {
    for (const status of [
      "IN_PROGRESS",
      "PENDING_REVIEW",
      "REJECTED",
      "DECLINED",
      null,
    ]) {
      expect(buildChecklist({ status, recorded: [], now: OPEN })).toBeNull();
    }
  });

  test("accepted but not RSVPed: RSVP is the current step", () => {
    const c = buildChecklist({ status: "ACCEPTED", recorded: [], now: OPEN })!;
    expect(done(c)).toEqual(["accepted"]);
    expect(c.currentId).toBe("rsvp");
    expect(c.stepsLeft).toBe(4);
    expect(c.rsvpDueInDays).toBe(9);
    expect(c.allDone).toBe(false);
  });

  test("RSVP is derived from CONFIRMED, not stored", () => {
    const c = buildChecklist({ status: "CONFIRMED", recorded: [], now: OPEN })!;
    expect(done(c)).toEqual(["accepted", "rsvp"]);
    expect(c.currentId).toBe("slack");
    expect(c.rsvpDueInDays).toBeNull();
  });

  test("a stored 'rsvp' row can't fake the derived step", () => {
    const c = buildChecklist({
      status: "ACCEPTED",
      recorded: ["rsvp"],
      now: OPEN,
    })!;
    expect(c.steps.find((s) => s.id === "rsvp")!.done).toBe(false);
  });

  test("recorded steps complete in any order; current is the first left", () => {
    const c = buildChecklist({
      status: "CONFIRMED",
      recorded: ["wallet", "slack"],
      now: OPEN,
    })!;
    expect(done(c)).toEqual(["accepted", "rsvp", "slack", "wallet"]);
    expect(c.currentId).toBe("devpost");
    expect(c.stepsLeft).toBe(1);
  });

  test("all done, and hidden only when the hide row exists", () => {
    const all = ["slack", "devpost", "wallet"];
    const shown = buildChecklist({
      status: "CONFIRMED",
      recorded: all,
      now: OPEN,
    })!;
    expect(shown.allDone).toBe(true);
    expect(shown.currentId).toBeNull();
    expect(shown.hidden).toBe(false);

    const hidden = buildChecklist({
      status: "CONFIRMED",
      recorded: [...all, "hide-checklist"],
      now: OPEN,
    })!;
    expect(hidden.hidden).toBe(true);
  });

  test("after RSVP closes only confirmed hackers have a checklist", () => {
    expect(
      buildChecklist({ status: "ACCEPTED", recorded: [], now: CLOSED }),
    ).toBeNull();
    const c = buildChecklist({
      status: "CONFIRMED",
      recorded: [],
      now: CLOSED,
    })!;
    expect(c.rsvpDueInDays).toBeNull();
  });
});
