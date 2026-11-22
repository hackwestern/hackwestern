// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { pingLogsCopy as copy } from "~/content/ping-logs";
import PingLogs from "~/pages/internal/ping-logs";

const NOW = new Date("2026-11-21T12:00:00-05:00");
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-05:00`);

const person = (name: string, over = {}) => ({
  name,
  reach: "ok",
  received: 1,
  missed: 0,
  upcoming: 1,
  atRisk: 0,
  lastAt: null,
  nextAt: at("12:30"),
  ...over,
});

const DATA = {
  now: NOW,
  bot: { lastCheckIn: at("11:59"), healthy: true },
  health: {
    people: [person("Zoe", { atRisk: 1, upcoming: 0 }), person("Noah")],
    lastSent: { at: at("11:00"), to: "Noah", title: "Coming up: Doors open" },
    nextUp: { at: at("12:30"), to: "Noah", title: "Coming up: Lunch" },
    sentLastHour: 1,
  },
  unpinged: [],
  organizerError: null,
  failed: [],
  entries: [
    {
      kind: "organizer",
      at: at("11:00"),
      to: "Noah",
      about: "Coming up: Doors open",
      status: "organizer.sent",
      tone: "ok",
      detail: "Doors open at 11:15\nBring the lanyards",
    },
    {
      kind: "organizer",
      at: at("12:30"),
      to: "Noah",
      about: "Coming up: Lunch",
      status: "organizer.queued",
      tone: "waiting",
      detail: "Lunch is at 12:45",
    },
    {
      kind: "organizer",
      at: at("13:00"),
      to: "Zoe",
      about: "Coming up: Workshop setup",
      status: "organizer.notQueued",
      tone: "problem",
      detail: "Set up the workshop room",
    },
    {
      kind: "autoPing",
      at: at("09:00"),
      to: "Maya Chen",
      group: "Mentor",
      about: "Check-in: Mentor",
      status: "autoPing.sent",
      tone: "ok",
    },
  ],
};

vi.mock("~/utils/api", () => ({
  api: {
    organizerPings: {
      log: {
        useQuery: () => ({ data: DATA, isLoading: false, error: null }),
      },
    },
  },
}));
vi.mock("~/utils/redirect", () => ({ authRedirectOrganizer: vi.fn() }));
vi.mock("~/components/seo", () => ({ default: () => null }));
vi.mock("~/components/internals/page-shell", () => ({
  InternalPage: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<PingLogs />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The "To: About" of each row in the list, top to bottom. */
const listed = () =>
  [...container.querySelectorAll("section ul > li")].map((li) => {
    const spans = li.querySelectorAll(":scope > span");
    const to = spans[2]?.querySelector("span")?.textContent;
    const about =
      li.querySelector("summary > span")?.textContent ?? spans[3]?.textContent;
    return `${to}: ${about}`;
  });
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith(name),
  )!;
const click = (el: Element) => {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};
const type = (text: string) => {
  const input = container.querySelector("input")!;
  const value = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  act(() => {
    value?.set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("Ping Logs page", () => {
  test("opens on problems first, then what's coming up; sent is a chip away", () => {
    expect(listed()).toEqual([
      "Zoe: Coming up: Workshop setup",
      "Noah: Coming up: Lunch",
    ]);
    expect(button(copy.views.problem).textContent).toBe(
      `${copy.views.problem}1`,
    );
    expect(button(copy.views.sent).textContent).toBe(`${copy.views.sent}2`);
    expect(container.textContent).toContain(copy.goingOut.yes);

    click(button(copy.views.sent));
    expect(listed()).toEqual([
      "Noah: Coming up: Doors open",
      "Maya Chen: Check-in: Mentor",
    ]);
  });

  test("message bodies start closed", () => {
    const details = container.querySelector("section ul details")!;
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("pre")!.textContent).toBe(
      "Set up the workshop room",
    );
  });

  test("search by person, then offer matches outside the view", () => {
    type("noah");
    expect(listed()).toEqual(["Noah: Coming up: Lunch"]);

    type("maya");
    expect(listed()).toEqual([]);
    click(button(copy.feed.elsewhere(1)));
    expect(listed()).toEqual(["Maya Chen: Check-in: Mentor"]);
  });

  test("a source chip narrows to mentors", () => {
    click(button(copy.views.all));
    click(button(copy.sources.mentor));
    expect(listed()).toEqual(["Maya Chen: Check-in: Mentor"]);
  });

  test("a name under By person opens that person's pings", () => {
    click(
      [...container.querySelectorAll("details button")].find(
        (b) => b.getAttribute("title") === copy.people.see("Noah"),
      )!,
    );
    expect(container.querySelector("input")!.value).toBe("Noah");
    expect(listed()).toEqual([
      "Noah: Coming up: Lunch",
      "Noah: Coming up: Doors open",
    ]);
  });
});
