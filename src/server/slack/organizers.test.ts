import { beforeEach, describe, expect, test } from "vitest";

import { matchName } from "~/lib/ops-owners";
import {
  getSlackOrganizers,
  organizerEntry,
  resetSlackOrganizersCache,
  stripOrganizerTag,
} from "~/server/slack/organizers";

describe("stripOrganizerTag", () => {
  test("the prefix form, with or without a space, any case", () => {
    expect(stripOrganizerTag("[ORGANIZER] Jessica Xing")).toBe("Jessica Xing");
    expect(stripOrganizerTag("[ORGANIZER]Jessica Xing")).toBe("Jessica Xing");
    expect(stripOrganizerTag("[organizer]   Jessica  Xing ")).toBe("Jessica Xing");
    expect(stripOrganizerTag("[ ORGANIZER ] - Jessica Xing")).toBe("Jessica Xing");
  });

  test("the tag anywhere else also works", () => {
    expect(stripOrganizerTag("Jessica Xing [ORGANIZER]")).toBe("Jessica Xing");
    expect(stripOrganizerTag("Jessica [Organiser] Xing")).toBe("Jessica Xing");
  });

  test("no tag, or only the tag", () => {
    expect(stripOrganizerTag("Jessica Xing")).toBeNull();
    expect(stripOrganizerTag("ORGANIZER Jessica")).toBeNull();
    expect(stripOrganizerTag("[ORGANIZER]")).toBeNull();
    expect(stripOrganizerTag(undefined)).toBeNull();
  });
});

describe("organizerEntry", () => {
  test("a tagged real name or display name", () => {
    expect(
      organizerEntry({ id: "U1", profile: { real_name: "[ORGANIZER] Jessica Xing", display_name: "jess" } }),
    ).toEqual({ id: "U1", name: "Jessica Xing", otherNames: ["jess"] });
    expect(
      organizerEntry({ id: "U2", profile: { real_name: "Noah Medland", display_name: "[ORGANIZER] Noah" } }),
    ).toEqual({ id: "U2", name: "Noah", otherNames: ["Noah Medland"] });
  });

  test("untagged people, bots, deactivated users and guests are left out", () => {
    expect(organizerEntry({ id: "U3", profile: { real_name: "Jessica Xing" } })).toBeNull();
    const tagged = { profile: { real_name: "[ORGANIZER] Bot" } };
    expect(organizerEntry({ id: "U4", is_bot: true, ...tagged })).toBeNull();
    expect(organizerEntry({ id: "U5", deleted: true, ...tagged })).toBeNull();
    expect(organizerEntry({ id: "U6", is_restricted: true, ...tagged })).toBeNull();
  });
});

describe("getSlackOrganizers", () => {
  beforeEach(() => resetSlackOrganizersCache());

  const members = [
    { id: "U-ORG", profile: { real_name: "[ORGANIZER] Jessica Xing" } },
    // A hacker with the same name as an organizer, no tag.
    { id: "U-HACKER", profile: { real_name: "Jessica Xing" } },
    { id: "U-ORG2", profile: { real_name: "[ORGANIZER] Brittney Chong" } },
  ];

  function slack() {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(JSON.stringify({ ok: true, members }), { status: 200 });
    }) as unknown as typeof fetch;
    return { fetchImpl, calls: () => calls };
  }

  test("only tagged members; a hacker named like an organizer never matches", async () => {
    const s = slack();
    const organizers = await getSlackOrganizers("xoxb-test", s.fetchImpl, 0);
    expect(organizers.map((o) => o.id)).toEqual(["U-ORG", "U-ORG2"]);
    expect(matchName("Jessica Xing", organizers)).toMatchObject({ status: "one", id: "U-ORG" });
    expect(matchName("Jessica", organizers)).toMatchObject({ status: "one", id: "U-ORG" });
  });

  test("cached for 5 minutes unless asked fresh", async () => {
    const s = slack();
    await getSlackOrganizers("xoxb-test", s.fetchImpl, 0);
    await getSlackOrganizers("xoxb-test", s.fetchImpl, 60_000);
    expect(s.calls()).toBe(1);
    await getSlackOrganizers("xoxb-test", s.fetchImpl, 60_000, { fresh: true });
    await getSlackOrganizers("xoxb-test", s.fetchImpl, 6 * 60_000);
    expect(s.calls()).toBe(3);
  });
});
