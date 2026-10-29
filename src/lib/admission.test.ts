import { describe, expect, it } from "vitest";
import { RSVP_DEADLINE } from "~/lib/date";
import { admittedStatuses, isAdmittedStatus } from "./admission";

const before = RSVP_DEADLINE.getTime() - 1;
const after = RSVP_DEADLINE.getTime();

describe("admission", () => {
  it("admits accepted and confirmed hackers while RSVP is open", () => {
    expect(admittedStatuses(before)).toEqual(["ACCEPTED", "CONFIRMED"]);
    expect(isAdmittedStatus("ACCEPTED", before)).toBe(true);
    expect(isAdmittedStatus("CONFIRMED", before)).toBe(true);
  });

  it("only admits confirmed hackers once RSVP closes", () => {
    expect(admittedStatuses(after)).toEqual(["CONFIRMED"]);
    expect(isAdmittedStatus("ACCEPTED", after)).toBe(false);
    expect(isAdmittedStatus("CONFIRMED", after)).toBe(true);
  });

  it("never admits other statuses", () => {
    for (const status of [
      "IN_PROGRESS",
      "PENDING_REVIEW",
      "IN_REVIEW",
      "REJECTED",
      "WAITLISTED",
      "DECLINED",
      "",
      null,
      undefined,
    ]) {
      expect(isAdmittedStatus(status, before)).toBe(false);
      expect(isAdmittedStatus(status, after)).toBe(false);
    }
  });
});
