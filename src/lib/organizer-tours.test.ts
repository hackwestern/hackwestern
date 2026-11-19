import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  markOrganizerTourSeen,
  ORGANIZER_TOUR_IDS,
  ORGANIZER_TOURS,
  organizerStepAt,
  organizerTourIdFor,
  organizerTourSeenKey,
  shouldOfferOrganizerTour,
  tourAfterTabChange,
} from "~/lib/organizer-tours";
import { ORGANIZER_TABS } from "~/lib/sponsor-organizer";
import {
  resolveStep,
  welcomeSeenKey,
  type TourStorage,
} from "~/lib/sponsor-tour";

function memoryStorage(): TourStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const throwing: TourStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

// Each tab's targets carry that tab's prefix, so a tour wired to the wrong
// tab (or two tabs' steps swapped) fails here.
const TARGET_PREFIX: Record<string, string> = {
  sponsors: "org-",
  schedule: "ros-",
  coffee: "coffee-",
  judging: "judging-",
  mine: "org-",
};

function allSourceText(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += allSourceText(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      out += readFileSync(full, "utf8");
  }
  return out;
}

describe("ORGANIZER_TOURS targets", () => {
  it("points each tab's steps at that tab's own targets", () => {
    for (const tab of ORGANIZER_TOUR_IDS) {
      for (const step of ORGANIZER_TOURS[tab].steps) {
        expect((step.target ?? "").startsWith(TARGET_PREFIX[tab] ?? "?")).toBe(
          true,
        );
      }
    }
  });

  it("only uses targets that some component renders as data-tour", () => {
    const source = allSourceText(join(process.cwd(), "src", "components"));
    for (const tab of ORGANIZER_TOUR_IDS) {
      for (const step of ORGANIZER_TOURS[tab].steps) {
        expect(source, `data-tour "${step.target ?? ""}"`).toMatch(
          new RegExp(`["'\`]${step.target}["'\`]`),
        );
      }
    }
  });
});

describe("ORGANIZER_TOURS", () => {
  it("has one tour of 3-5 steps for every dashboard tab", () => {
    for (const tab of ORGANIZER_TOUR_IDS) {
      const def = ORGANIZER_TOURS[tab];
      expect(def.id).toBe(tab);
      expect(def.steps.length).toBeGreaterThanOrEqual(3);
      expect(def.steps.length).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every step on the open tab, with a target and copy", () => {
    for (const tab of ORGANIZER_TOUR_IDS) {
      const ids = new Set<string>();
      for (const step of ORGANIZER_TOURS[tab].steps) {
        expect(step.page).toBe("any");
        expect(step.target).toBeTruthy();
        expect(step.title.trim()).not.toBe("");
        expect(step.body.trim()).not.toBe("");
        expect(ids.has(step.id)).toBe(false);
        ids.add(step.id);
      }
    }
  });

  it("never navigates; a missing target shows a centred callout", () => {
    const def = ORGANIZER_TOURS.coffee;
    expect(resolveStep(def, 0, null, "", () => false)).toEqual({
      kind: "show",
      step: def.steps[0],
      anchored: false,
    });
    expect(resolveStep(def, 0, null, "", () => true)).toMatchObject({
      kind: "show",
      anchored: true,
    });
  });
});

describe("organizer tour offer", () => {
  it("offers each tab once, remembered per tab", () => {
    const s = memoryStorage();
    expect(shouldOfferOrganizerTour(s, "sponsors")).toBe(true);
    markOrganizerTourSeen(s, "sponsors");
    expect(shouldOfferOrganizerTour(s, "sponsors")).toBe(false);
    expect(shouldOfferOrganizerTour(s, "coffee")).toBe(true);
    expect(s.data[organizerTourSeenKey("sponsors")]).toBe("1");
  });

  it("uses keys apart from the sponsor portal's welcome offer", () => {
    for (const tab of ORGANIZER_TABS) {
      expect(organizerTourSeenKey(tab)).not.toBe(welcomeSeenKey(tab));
      expect(organizerTourSeenKey(tab)).toMatch(/^hw-organizer-tour-seen:/);
    }
  });

  it("doesn't nag or throw when storage is blocked", () => {
    expect(shouldOfferOrganizerTour(throwing, "mine")).toBe(false);
    expect(() => markOrganizerTourSeen(throwing, "mine")).not.toThrow();
  });
});

describe("organizer tour state", () => {
  it("keeps a tour on its own tab and stops it on another", () => {
    const state = { tab: "judging" as const, step: 2 };
    expect(tourAfterTabChange(state, "judging")).toBe(state);
    expect(tourAfterTabChange(state, "mine")).toBeNull();
    expect(tourAfterTabChange(null, "mine")).toBeNull();
  });

  it("moves between steps and ends past either end", () => {
    const state = { tab: "mine" as const, step: 0 };
    const last = ORGANIZER_TOURS.mine.steps.length - 1;
    expect(organizerStepAt(state, 1)).toEqual({ tab: "mine", step: 1 });
    expect(organizerStepAt(state, last + 1)).toBeNull();
    expect(organizerStepAt(state, -1)).toBeNull();
    expect(organizerStepAt(null, 0)).toBeNull();
  });
});

describe("organizerTourIdFor", () => {
  it("uses the My sponsors tour only on Sponsors in My sponsors", () => {
    expect(organizerTourIdFor("sponsors", true)).toBe("mine");
    expect(organizerTourIdFor("sponsors", false)).toBe("sponsors");
    expect(organizerTourIdFor("coffee", true)).toBe("coffee");
  });
  it("has no Task pings tour", () => {
    expect(ORGANIZER_TOUR_IDS as readonly string[]).not.toContain("pings");
  });
});
