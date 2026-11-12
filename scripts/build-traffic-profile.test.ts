import { describe, expect, it } from "vitest";
import {
  buildProfile,
  type CountRow,
  type EventRow,
} from "./build-traffic-profile";

const ev = (
  id: number,
  ts: number,
  procedure: string,
  user: string | null,
  phase = "during",
): EventRow => ({
  id,
  ts,
  procedure,
  type: "query",
  status: "OK",
  duration_ms: 10,
  user_hash: user,
  phase,
});

describe("buildProfile", () => {
  const auth = {
    "teams.getTeam": "protected",
    "review.save": "organizer",
    "clock.get": "public",
  };
  const events = [
    ev(1, 0, "teams.getTeam", "u1"),
    ev(2, 5_000, "teams.getTeam", "u1"),
    ev(3, 0, "review.save", "org"),
    ev(4, 0, "clock.get", null),
  ];
  const counts: CountRow[] = [
    { minute: 0, procedure: "clock.get", n: 96, phase: "during" },
  ];
  const profile = buildProfile(events, counts, auth);

  it("weights routes by share, including polled counts", () => {
    expect(profile.routes["clock.get"]).toBeCloseTo(97 / 100, 4);
    expect(profile.totals.polledCalls).toBe(96);
  });

  it("classifies personas by highest auth tier touched", () => {
    expect(Object.keys(profile.personas)).toEqual([
      "organizer",
      "hacker",
      "anonymous",
    ]);
  });

  it("builds transition probabilities and think time", () => {
    const hacker = profile.personas.hacker!;
    expect(hacker.transitions.START).toEqual({ "teams.getTeam": 1 });
    expect(hacker.transitions["teams.getTeam"]).toEqual({ "teams.getTeam": 1 });
    expect(hacker.thinkTimeMs.p50).toBe(5000);
  });

  it("reports per-phase rates", () => {
    expect(profile.phases.during!.peakPerMinute).toBe(100);
  });
});
