import { describe, expect, it } from "vitest";
import { OWN_TRAVEL } from "~/schemas/rsvp";
import { describeTravel, rsvpView } from "./rsvp-view";

const deadlineText = "Friday, November 6 at 11:59 p.m. ET";

const accepted = {
  title: "You’re invited to Hack Western 13!",
  body: "Hack Western runs November 20–22 at Western University. Tell us how you’re getting here and confirm your spot.",
};
const confirmed = {
  title: "You’re confirmed. See you there!",
  body: "Hack Western runs November 20–22 at Western University. We’ll email you the schedule and check-in details closer to the event.",
};

describe("rsvpView", () => {
  it("asks accepted hackers to RSVP while it's open", () => {
    expect(
      rsvpView({ status: "ACCEPTED", closed: false, deadlineText }),
    ).toEqual({
      ...accepted,
      pill: `RSVP by ${deadlineText}`,
      canEditTravel: true,
      showSavedTravel: false,
    });
  });

  it("tells accepted hackers their spot was released once RSVP closes", () => {
    expect(
      rsvpView({ status: "ACCEPTED", closed: true, deadlineText }),
    ).toEqual({
      title: "RSVP is closed",
      body: `The RSVP deadline was ${deadlineText}, so your spot has been released. We hope to see you at a future Hack Western.`,
      pill: null,
      canEditTravel: false,
      showSavedTravel: false,
    });
  });

  it("lets confirmed hackers change travel until the deadline", () => {
    expect(
      rsvpView({ status: "CONFIRMED", closed: false, deadlineText }),
    ).toEqual({
      ...confirmed,
      pill: `You can change your travel plans until ${deadlineText}`,
      canEditTravel: true,
      showSavedTravel: false,
    });
  });

  it("locks confirmed hackers' travel once RSVP closes and shows what's on file", () => {
    expect(
      rsvpView({ status: "CONFIRMED", closed: true, deadlineText }),
    ).toEqual({
      ...confirmed,
      pill: `Travel plans locked on ${deadlineText}`,
      canEditTravel: false,
      showSavedTravel: true,
    });
  });

  it("ignores the deadline for declined hackers and accounts with no RSVP", () => {
    for (const closed of [false, true]) {
      expect(rsvpView({ status: "DECLINED", closed, deadlineText })).toEqual({
        title: "You’re not attending Hack Western 13",
        body: "Your spot has been released. We hope to see you at a future Hack Western.",
        pill: null,
        canEditTravel: false,
        showSavedTravel: false,
      });
      expect(rsvpView({ status: "NONE", closed, deadlineText })).toEqual({
        title: "There’s no RSVP on this account",
        body: "If you got an acceptance email, sign in with the account you applied with.",
        pill: null,
        canEditTravel: false,
        showSavedTravel: false,
      });
    }
  });
});

describe("describeTravel", () => {
  it("names the bus city", () => {
    expect(
      describeTravel({
        transportationMethod: "Toronto",
        travelReimbursement: null,
        travelFrom: null,
      }),
    ).toBe("Hack Western bus from Toronto");
  });

  it("includes a reimbursement request and its city", () => {
    expect(
      describeTravel({
        transportationMethod: OWN_TRAVEL,
        travelReimbursement: true,
        travelFrom: "Ottawa",
      }),
    ).toBe("On your own, with a ticket reimbursement request from Ottawa");
  });

  it("still shows a request saved before its city was filled in", () => {
    for (const travelFrom of [null, ""]) {
      expect(
        describeTravel({
          transportationMethod: OWN_TRAVEL,
          travelReimbursement: true,
          travelFrom,
        }),
      ).toBe("On your own, with a ticket reimbursement request");
    }
  });

  it("is just on your own without a reimbursement request", () => {
    for (const travelReimbursement of [false, null]) {
      expect(
        describeTravel({
          transportationMethod: OWN_TRAVEL,
          travelReimbursement,
          travelFrom: null,
        }),
      ).toBe("On your own");
    }
  });

  it("is null when there's no answer on file", () => {
    expect(describeTravel({})).toBeNull();
    expect(
      describeTravel({
        transportationMethod: null,
        travelReimbursement: null,
        travelFrom: null,
      }),
    ).toBeNull();
  });
});
