import { describe, expect, test } from "vitest";
import {
  eventClock,
  planDay,
  roomLabel,
  stepsFor,
  type HomeContext,
} from "./sponsor-home";

const ctx = (over: Partial<HomeContext> = {}): HomeContext => ({
  hasPrizeTrack: true,
  hasCoffeeChats: true,
  availabilitySent: false,
  shortlistSent: false,
  confirmed: false,
  chats: [],
  workshop: null,
  judgingRoom: null,
  ...over,
});

/** Friday 6:00 PM Eastern. */
const fri6pm = new Date("2026-11-20T18:00:00-05:00");

describe("sponsor Home Up next", () => {
  test("the clock counts from Friday midnight, Eastern", () => {
    expect(eventClock(fri6pm)).toEqual({ abs: 1080, day: 0, minute: 1080 });
    expect(eventClock(new Date("2026-11-21T11:00:00-05:00")).day).toBe(1);
  });

  test("Friday 6 PM: the booth is Now, Opening ceremony is next, sent availability is done", () => {
    const { abs } = eventClock(fri6pm);
    const plan = planDay(0, abs, ctx({ availabilitySent: true }));
    expect(plan.mode).toBe("now");
    expect(plan.hi?.step.title).toBe("Open your booth");
    expect(plan.next?.step.title).toBe("Opening ceremony");
    expect(plan.rows.find((r) => r.step.id === "f1")?.state).toBe("done");
  });

  test("Saturday swaps the placeholder for real chats once confirmed, and adds the workshop", () => {
    const steps = stepsFor(
      1,
      ctx({
        confirmed: true,
        chats: [
          {
            id: "p1",
            rep: "Dana W.",
            start: "10:00",
            end: "11:00",
            room: "1352",
            building: "ivey",
            chats: 4,
            confirmed: 2,
          },
        ],
        workshop: {
          start: "14:30",
          title: "Sun Life Workshop",
          location: "2230 (50)",
        },
      }),
    );
    expect(steps.some((s) => s.chatsPlaceholder)).toBe(false);
    expect(steps.find((s) => s.id === "chat-p1")).toMatchObject({
      title: "Dana W.'s coffee chats",
      where: "Ivey, Rm 1352",
      sub: "4 chats, 2 hackers confirmed",
    });
    expect(steps.find((s) => s.id === "workshop")).toMatchObject({
      start: 855,
      title: "Arrive by 2:15 to set up",
      where: "Rm 2230",
    });
    expect(steps[0]?.note).toBe(true);
  });

  test("unsent availability stays current after its slot, never done", () => {
    const { abs } = eventClock(fri6pm);
    const plan = planDay(0, abs, ctx());
    expect(plan.rows.find((r) => r.step.id === "f1")?.state).toBe("on");
  });

  test("no prize track: no judging steps on Sunday", () => {
    expect(
      stepsFor(2, ctx({ hasPrizeTrack: false })).some((s) => s.prizeOnly),
    ).toBe(false);
  });

  test("room labels from the run of show", () => {
    expect(roomLabel("2230 (50)")).toBe("Rm 2230");
    expect(roomLabel("Rm 2230 (50)")).toBe("Rm 2230");
    expect(roomLabel(null)).toBeNull();
  });
});
