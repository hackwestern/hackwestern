import { describe, expect, it } from "vitest";
import {
  clickTargetOf,
  hasSeenWelcome,
  hrefForMove,
  loadProgress,
  markWelcomeSeen,
  pageHref,
  pageOf,
  parseProgress,
  placeCallout,
  resolveStep,
  saveProgress,
  targetSelector,
  TOUR_PROGRESS_KEY,
  VIEWPORT_MARGIN,
  type TourDef,
  type TourStorage,
} from "~/lib/sponsor-tour";
import { SPONSOR_TOURS } from "~/lib/sponsor-tours";

const SPONSOR = "89170676-4186-4912-8a06-fa0eda0ff309";

const tour: TourDef = {
  id: "demo",
  steps: [
    { id: "a", page: "home", target: "tile-scan", title: "A", body: "a" },
    { id: "b", page: "scan", target: "scan-camera", title: "B", body: "b" },
    { id: "c", page: "any", target: "map", title: "C", body: "c" },
    { id: "d", page: "home", placement: "center", title: "D", body: "d" },
  ],
};
const tours = { demo: tour };

function memoryStorage(initial: Record<string, string> = {}): TourStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
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

describe("pages", () => {
  it("maps route patterns to tour pages and back", () => {
    expect(pageOf("/sponsors/[uuid]")).toBe("home");
    expect(pageOf("/sponsors/[uuid]/picks")).toBe("picks");
    expect(pageOf("/live")).toBeNull();
    expect(pageHref("scan", SPONSOR)).toBe(`/sponsors/${SPONSOR}/scan`);
  });

  it("builds a data-tour selector, never a class", () => {
    expect(targetSelector("tile-scan")).toBe('[data-tour="tile-scan"]');
    expect(targetSelector('a"b')).toBe('[data-tour="a\\"b"]');
  });
});

describe("resolveStep", () => {
  const all = () => true;
  const none = () => false;

  it("shows an anchored step when its target is on the page", () => {
    expect(resolveStep(tour, 0, "home", SPONSOR, all)).toEqual({
      kind: "show",
      step: tour.steps[0],
      anchored: true,
    });
  });

  it("falls back to a centred callout when the target is missing", () => {
    expect(resolveStep(tour, 0, "home", SPONSOR, none)).toMatchObject({
      kind: "show",
      anchored: false,
    });
  });

  it("only looks for the step's own target", () => {
    const seen: string[] = [];
    resolveStep(tour, 1, "scan", SPONSOR, (t) => {
      seen.push(t);
      return true;
    });
    expect(seen).toEqual(["scan-camera"]);
  });

  it("asks to navigate when the step is on another page", () => {
    expect(resolveStep(tour, 1, "home", SPONSOR, all)).toEqual({
      kind: "navigate",
      href: `/sponsors/${SPONSOR}/scan`,
    });
  });

  it("runs an 'any' step wherever the tour is", () => {
    expect(resolveStep(tour, 2, "picks", SPONSOR, all).kind).toBe("show");
    expect(resolveStep(tour, 2, null, SPONSOR, all).kind).toBe("show");
  });

  it("never anchors a centre step, even with no target check", () => {
    expect(resolveStep(tour, 3, "home", SPONSOR, all)).toMatchObject({
      anchored: false,
    });
  });

  it("is done past either end", () => {
    expect(resolveStep(tour, 4, "home", SPONSOR, all)).toEqual({
      kind: "done",
    });
    expect(resolveStep(tour, -1, "home", SPONSOR, all)).toEqual({
      kind: "done",
    });
  });

  it("only navigates on a move to another page", () => {
    expect(hrefForMove(tour, 1, "home", SPONSOR)).toBe(
      `/sponsors/${SPONSOR}/scan`,
    );
    expect(hrefForMove(tour, 1, "scan", SPONSOR)).toBeNull();
    expect(hrefForMove(tour, 2, "scan", SPONSOR)).toBeNull();
    expect(hrefForMove(tour, 9, "scan", SPONSOR)).toBeNull();
  });
});

describe("progress", () => {
  it("round-trips through storage", () => {
    const s = memoryStorage();
    saveProgress(s, { tour: "demo", step: 2, sponsor: SPONSOR });
    expect(loadProgress(s, tours, SPONSOR)).toEqual({
      tour: "demo",
      step: 2,
      sponsor: SPONSOR,
    });
    saveProgress(s, null);
    expect(s.data[TOUR_PROGRESS_KEY]).toBeUndefined();
    expect(loadProgress(s, tours, SPONSOR)).toBeNull();
  });

  it("ignores progress saved for another sponsor", () => {
    const s = memoryStorage();
    saveProgress(s, { tour: "demo", step: 1, sponsor: "someone-else" });
    expect(loadProgress(s, tours, SPONSOR)).toBeNull();
  });

  it("rejects malformed or out-of-range progress", () => {
    expect(parseProgress(null, tours)).toBeNull();
    expect(parseProgress("not json", tours)).toBeNull();
    expect(parseProgress("[]", tours)).toBeNull();
    const p = (v: unknown) => parseProgress(JSON.stringify(v), tours);
    expect(p({ tour: "nope", step: 0, sponsor: SPONSOR })).toBeNull();
    expect(p({ tour: "demo", step: 4, sponsor: SPONSOR })).toBeNull();
    expect(p({ tour: "demo", step: -1, sponsor: SPONSOR })).toBeNull();
    expect(p({ tour: "demo", step: 1.5, sponsor: SPONSOR })).toBeNull();
    expect(p({ tour: "demo", step: "1", sponsor: SPONSOR })).toBeNull();
    expect(p({ tour: "demo", step: 3, sponsor: SPONSOR })).not.toBeNull();
  });

  it("survives storage that throws or is missing", () => {
    expect(() =>
      saveProgress(throwing, { tour: "demo", step: 0, sponsor: SPONSOR }),
    ).not.toThrow();
    expect(loadProgress(throwing, tours, SPONSOR)).toBeNull();
    expect(loadProgress(null, tours, SPONSOR)).toBeNull();
  });
});

describe("welcome seen", () => {
  it("is remembered per sponsor", () => {
    const s = memoryStorage();
    expect(hasSeenWelcome(s, SPONSOR)).toBe(false);
    markWelcomeSeen(s, SPONSOR);
    expect(hasSeenWelcome(s, SPONSOR)).toBe(true);
    expect(hasSeenWelcome(s, "another")).toBe(false);
  });

  it("never offers when storage is blocked", () => {
    expect(hasSeenWelcome(throwing, SPONSOR)).toBe(true);
    expect(() => markWelcomeSeen(throwing, SPONSOR)).not.toThrow();
  });
});

describe("placeCallout", () => {
  const viewport = { width: 1200, height: 800 };
  const size = { width: 300, height: 160 };

  it("uses the asked side when it fits", () => {
    const r = placeCallout(
      { top: 100, left: 400, width: 200, height: 50 },
      size,
      viewport,
      "bottom",
    );
    expect(r.placement).toBe("bottom");
    expect(r.top).toBe(100 + 50 + 12);
    expect(r.left).toBe(400 + 100 - 150);
  });

  it("flips to the other side when there's no room", () => {
    const r = placeCallout(
      { top: 700, left: 400, width: 200, height: 50 },
      size,
      viewport,
      "bottom",
    );
    expect(r.placement).toBe("top");
    expect(r.top).toBe(700 - 12 - 160);
  });

  it("stays inside the viewport", () => {
    const r = placeCallout(
      { top: 100, left: 0, width: 40, height: 40 },
      size,
      viewport,
      "bottom",
    );
    expect(r.left).toBe(VIEWPORT_MARGIN);
  });
});

describe("SPONSOR_TOURS", () => {
  it("every step has copy and a known page", () => {
    for (const def of Object.values(SPONSOR_TOURS)) {
      expect(def.steps.length).toBeGreaterThan(0);
      for (const step of def.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
        expect(step.target ?? step.placement).toBeTruthy();
      }
    }
  });

  it("the welcome tour stays on the portal home", () => {
    for (const step of SPONSOR_TOURS.welcome.steps) {
      expect(["home", "any"]).toContain(step.page);
    }
  });
});

describe("clickTargetOf", () => {
  // A tiny stand-in for DOM elements: a tag and children, matched by tag.
  interface Fake {
    tag: string;
    children: Fake[];
    matches(selector: string): boolean;
    querySelector(selector: string): Fake | null;
  }
  const clickable = new Set(["a", "button"]);
  const node = (tag: string, children: Fake[] = []): Fake => ({
    tag,
    children,
    matches: () => clickable.has(tag),
    querySelector(selector) {
      for (const c of children) {
        if (c.matches(selector)) return c;
        const deep = c.querySelector(selector);
        if (deep) return deep;
      }
      return null;
    },
  });

  it("clicks a link or button target itself", () => {
    const button = node("button");
    expect(clickTargetOf(button)).toBe(button);
  });

  it("clicks the first link inside a wrapper target", () => {
    const link = node("a");
    const li = node("li", [node("span"), node("div", [link]), node("button")]);
    expect(clickTargetOf(li)).toBe(link);
  });

  it("falls back to the target when nothing inside is clickable", () => {
    const section = node("section", [node("p")]);
    expect(clickTargetOf(section)).toBe(section);
  });
});
