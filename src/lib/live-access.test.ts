import { describe, expect, it } from "vitest";
import { RSVP_DEADLINE } from "~/lib/date";
import { liveAccessRedirect } from "./live-access";

const afterRsvp = RSVP_DEADLINE.getTime() + 1;

describe("liveAccessRedirect", () => {
  it("sends signed-out visitors to log in and come back", () => {
    expect(liveAccessRedirect(null, afterRsvp)).toBe(
      "/login?callbackUrl=/live",
    );
  });

  it("lets organizers in", () => {
    expect(
      liveAccessRedirect({ type: "organizer", status: null }, afterRsvp),
    ).toBeNull();
  });

  it("lets confirmed hackers in", () => {
    expect(
      liveAccessRedirect({ type: "hacker", status: "CONFIRMED" }, afterRsvp),
    ).toBeNull();
  });

  it.each(["ACCEPTED", "DECLINED", "REJECTED", "IN_PROGRESS", null])(
    "sends hackers with status %s to the dashboard",
    (status) => {
      expect(liveAccessRedirect({ type: "hacker", status }, afterRsvp)).toBe(
        "/dashboard",
      );
    },
  );

  it("sends other account types to the homepage", () => {
    expect(
      liveAccessRedirect({ type: "sponsor", status: null }, afterRsvp),
    ).toBe("/");
  });
});
