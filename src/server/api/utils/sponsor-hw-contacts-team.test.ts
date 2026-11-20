import { describe, expect, test } from "vitest";

import {
  parseHwContacts,
  sponsorshipTeamNames,
} from "~/server/api/utils/sponsor-hw-contacts";

describe("sponsorshipTeamNames (Book an event's Booked by)", () => {
  test("only Sponsorship rows when the tab has a Team column", () => {
    const contacts = parseHwContacts([
      ["Name", "Phone", "Team"],
      ["Caroline", "1", "Sponsorship"],
      ["Wes", "2", "Web"],
      ["Noah", "3", "sponsorship lead"],
      ["Caroline", "1", "Sponsorship"],
    ]);
    expect(sponsorshipTeamNames(contacts)).toEqual(["Caroline", "Noah"]);
  });

  test("every row when there's no Team or Position column", () => {
    const contacts = parseHwContacts([
      ["Name", "Phone"],
      ["Caroline", "1"],
      ["Noah", "3"],
    ]);
    expect(sponsorshipTeamNames(contacts)).toEqual(["Caroline", "Noah"]);
  });
});
