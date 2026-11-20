import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clickTargetOf,
  hasSeenWelcome,
  hrefForMove,
  isSkippable,
  loadProgress,
  markWelcomeSeen,
  pageHref,
  pageOf,
  parseProgress,
  placeCallout,
  resolveStep,
  saveProgress,
  skipFrom,
  stepTargets,
  targetSelector,
  TOUR_PROGRESS_KEY,
  VIEWPORT_MARGIN,
  type TourDef,
  type TourStorage,
} from "~/lib/sponsor-tour";
import { SPONSOR_TOURS, toursFor } from "~/lib/sponsor-tours";

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
  const steps = SPONSOR_TOURS.welcome.steps;

  it("every step has copy and a known page", () => {
    for (const def of Object.values(SPONSOR_TOURS)) {
      expect(def.steps.length).toBeGreaterThan(0);
      for (const step of def.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
        expect(stepTargets(step).length).toBeGreaterThan(0);
        expect(step.page).not.toBe("any");
      }
    }
  });

  it("follows the workshop deck: Home, Schedule, Map, Chats, Scan, Judging, Help", () => {
    // Consecutive steps on the same page collapse to one visit.
    const visits = steps
      .map((st) => st.page)
      .filter((page, i, all) => page !== all[i - 1]);
    expect(visits).toEqual([
      "home",
      "schedule",
      "map",
      "coffeeChats",
      "scan",
      "home",
    ]);
    expect(steps[0]?.id).toBe("welcome");
    expect(steps.at(-1)?.id).toBe("help");
    expect(steps.at(-2)?.id).toBe("judging");
  });

  it("never stops on a missing target: every targeted step can be skipped", () => {
    for (const step of steps) {
      expect(isSkippable(step)).toBe(true);
    }
  });

  it("has unique step ids", () => {
    const ids = steps.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points the Chats stage step at whichever stage card is shown", () => {
    const stage = steps.find((st) => st.id === "chats-stage");
    expect(stage && stepTargets(stage)).toEqual([
      "chats-start",
      "chats-shortlist",
      "chats-waiting",
      "chats-confirmed",
    ]);
  });

  it("only uses targets that some component or page renders", () => {
    const read = (dir: string): string =>
      readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith("_to_delete"))
        .map((e) =>
          e.isDirectory()
            ? read(join(dir, e.name))
            : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
              ? readFileSync(join(dir, e.name), "utf8")
              : "",
        )
        .join("\n");
    const source = read(join(process.cwd(), "src"));
    for (const step of steps) {
      for (const t of stepTargets(step)) {
        if (t.startsWith("nav-")) {
          // The shell's nav items: data-tour={`nav-${item.id}`}.
          expect(source).toContain("data-tour={`nav-${item.id}`}");
          expect(source).toMatch(new RegExp(`id: "${t.slice("nav-".length)}"`));
        } else {
          expect(source, `data-tour "${t}"`).toMatch(
            new RegExp(`data-tour=["'\`]${t}["'\`]|tourId="${t}"`),
          );
        }
      }
    }
  });

  it("never targets the removed Quick links card", () => {
    for (const step of steps) {
      for (const t of stepTargets(step)) expect(t).not.toMatch(/quick/i);
    }
  });
});

describe("skipping missing targets", () => {
  const skipTour: TourDef = {
    id: "skip",
    steps: [
      {
        id: "a",
        page: "home",
        target: "a",
        optional: true,
        title: "A",
        body: "a",
      },
      {
        id: "b",
        page: "home",
        target: "b",
        optional: true,
        title: "B",
        body: "b",
      },
      {
        id: "c",
        page: "home",
        title: "C",
        body: "c",
        variants: [
          { target: "c1", title: "C one", body: "c one" },
          { target: "c2", body: "c two" },
        ],
      },
      { id: "d", page: "home", target: "d", title: "D", body: "d" },
    ],
  };
  const only =
    (...present: string[]) =>
    (t: string) =>
      present.includes(t);

  it("skips an optional step whose target is missing", () => {
    expect(resolveStep(skipTour, 1, "home", SPONSOR, only("a"))).toEqual({
      kind: "skip",
    });
  });

  it("still shows an optional step when its target is there", () => {
    const r = resolveStep(skipTour, 1, "home", SPONSOR, only("b"));
    expect(r).toMatchObject({ kind: "show", anchored: true });
  });

  it("centres, not skips, a required step whose target is missing", () => {
    const r = resolveStep(skipTour, 3, "home", SPONSOR, only());
    expect(r).toMatchObject({ kind: "show", anchored: false });
  });

  it("navigates first, never skips a step on another page", () => {
    const r = resolveStep(skipTour, 0, "scan", SPONSOR, only());
    expect(r.kind).toBe("navigate");
  });

  it("shows the first variant on the page, with its own words", () => {
    const first = resolveStep(skipTour, 2, "home", SPONSOR, only("c1", "c2"));
    expect(first).toMatchObject({
      kind: "show",
      anchored: true,
      step: { target: "c1", title: "C one", body: "c one" },
    });
    const second = resolveStep(skipTour, 2, "home", SPONSOR, only("c2"));
    // A variant without a title keeps the step's.
    expect(second).toMatchObject({
      kind: "show",
      step: { target: "c2", title: "C", body: "c two" },
    });
  });

  it("skips a variant step when none of its targets is there", () => {
    expect(resolveStep(skipTour, 2, "home", SPONSOR, only("a")).kind).toBe(
      "skip",
    );
  });

  it("moves on in the direction the sponsor was going", () => {
    expect(skipFrom(1, false, 4)).toEqual({ step: 2, back: false });
    expect(skipFrom(2, true, 4)).toEqual({ step: 1, back: true });
  });

  it("turns forward when going back runs out, so it's never stuck", () => {
    expect(skipFrom(0, true, 4)).toEqual({ step: 1, back: false });
  });

  it("is done when the last step is skipped", () => {
    expect(skipFrom(3, false, 4)).toBeNull();
  });

  it("walks a whole tour with every target missing to the end", () => {
    let at: number | null = 0;
    let back = false;
    let moves = 0;
    while (at !== null && moves < 10) {
      const r = resolveStep(skipTour, at, "home", SPONSOR, only());
      if (r.kind !== "skip") break;
      const next = skipFrom(at, back, skipTour.steps.length);
      at = next?.step ?? null;
      back = next?.back ?? false;
      moves++;
    }
    // a, b and c skip; d (required) centres.
    expect(at).toBe(3);
  });

  it("keeps the Back direction through saved progress", () => {
    const store = memoryStorage();
    saveProgress(store, {
      tour: "skip",
      step: 2,
      sponsor: SPONSOR,
      back: true,
    });
    expect(loadProgress(store, { skip: skipTour }, SPONSOR)).toEqual({
      tour: "skip",
      step: 2,
      sponsor: SPONSOR,
      back: true,
    });
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

describe("tours by prize track", () => {
  it("drops Judging for sponsors without a prize track", () => {
    const tours = toursFor(false);
    expect(tours.welcome.steps.map((st) => st.target)).not.toContain(
      "nav-judging",
    );
    expect(tours.welcome.steps.length).toBe(
      SPONSOR_TOURS.welcome.steps.length - 1,
    );
  });

  it("keeps everything for prize track sponsors and while loading", () => {
    expect(toursFor(true)).toBe(SPONSOR_TOURS);
    expect(toursFor(undefined)).toBe(SPONSOR_TOURS);
  });
});
