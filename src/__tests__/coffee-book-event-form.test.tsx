// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingForm } from "~/components/sponsors/organizer/coffee-sessions/chat-modal";
import type { SessionBoardData } from "~/components/sponsors/organizer/coffee-sessions/parts";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";

const bc = coffeeSessionsCopy.booking;

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("~/utils/api", () => ({
  api: { coffeeChatSessions: { bookingHackers: { useQuery } } },
}));

// Sun Co: Sam is free 10-11; Sid isn't. Moon Co hasn't submitted.
const board = {
  sponsors: [
    {
      id: "sun",
      name: "Sun Co",
      submitted: true,
      blocked: [],
      reps: [
        { id: "sam", name: "Sam", chatsWanted: 4, free: ["10"] },
        { id: "sid", name: "Sid", chatsWanted: 4, free: ["11"] },
      ],
    },
    { id: "moon", name: "Moon Co", submitted: false, blocked: [], reps: [{ id: "mo", name: "Mo", chatsWanted: 4, free: ["10"] }] },
  ],
  placements: [],
  bookings: [],
} as unknown as SessionBoardData;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useQuery.mockImplementation((input: { q: string }) => ({
    isLoading: false,
    isFetching: false,
    data: {
      scanned: [
        { userId: "u-bob", name: "Bob B.", hackerId: "calm-otter-kite" },
        { userId: "u-ada", name: "Ada L.", hackerId: null },
      ],
      found: input.q ? [{ userId: "u-cy", name: "Cy D.", hackerId: "brave-fox-lamp" }] : [],
    },
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useQuery.mockReset();
});

/** Set a select's value the way a person does (React listens for "change"). */
function pick(el: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);

function render(onBook = vi.fn()) {
  act(() => {
    root.render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <BookingForm board={board} initial={{ room: "2241", session: "10" }} busy={false} onBook={onBook} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
  });
  return onBook;
}

describe("Book an event form", () => {
  test("room and session are fixed text; no room, session, note or free-text who fields", () => {
    render();
    expect(document.body.textContent).toContain(bc.title);
    expect(document.body.textContent).toContain(bc.where("Rm 2241", "10–11"));
    expect(q("#bk-room")).toBeNull();
    expect(q("#bk-session")).toBeNull();
    expect(q("#bk-note")).toBeNull();
    expect(q("#bk-who")).toBeNull();
    // Only submitted sponsors are offered.
    const options = [...q<HTMLSelectElement>("#bk-sponsor")!.options].map((o) => o.textContent);
    expect(options).toEqual([bc.sponsorPick, "Sun Co"]);
  });

  test("sponsor -> rep (only reps free then) -> a scanned hacker, or one found by search -> Book", () => {
    const onBook = render();
    act(() => pick(q<HTMLSelectElement>("#bk-sponsor")!, "sun"));
    const reps = [...q<HTMLSelectElement>("#bk-rep")!.options].map((o) => o.textContent);
    expect(reps).toEqual([bc.repPick, "Sam"]);
    // No hacker step before a rep.
    expect(document.body.textContent).not.toContain(bc.scannedTitle);
    act(() => pick(q<HTMLSelectElement>("#bk-rep")!, "sam"));
    // Scanned first, in the server's order (newest scan first).
    const scanned = q(`ul[aria-label="${bc.scannedTitle}"]`)!;
    expect([...scanned.querySelectorAll("label")].map((l) => l.textContent)).toEqual([
      bc.hackerLine("Bob B.", "calm-otter-kite"),
      "Ada L.",
    ]);
    act(() => q<HTMLInputElement>('input[value="u-ada"]')!.click());
    act(() => q<HTMLFormElement>("form")!.requestSubmit());
    expect(onBook).toHaveBeenLastCalledWith({ room: "2241", session: "10", sponsorId: "sun", repId: "sam", userId: "u-ada" });
  });

  test("search is second: results show once 2+ letters are typed", async () => {
    vi.useFakeTimers();
    try {
      const onBook = render();
      act(() => pick(q<HTMLSelectElement>("#bk-sponsor")!, "sun"));
      act(() => pick(q<HTMLSelectElement>("#bk-rep")!, "sam"));
      const search = q<HTMLInputElement>("#bk-search")!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "brave");
        search.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(useQuery).toHaveBeenLastCalledWith({ sponsorId: "sun", q: "brave" }, expect.anything());
      act(() => q<HTMLInputElement>('input[value="u-cy"]')!.click());
      act(() => q<HTMLFormElement>("form")!.requestSubmit());
      expect(onBook).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "u-cy" }));
    } finally {
      vi.useRealTimers();
    }
  });

  test("Book without a hacker says what's missing", () => {
    const onBook = render();
    act(() => pick(q<HTMLSelectElement>("#bk-sponsor")!, "sun"));
    act(() => q<HTMLFormElement>("form")!.requestSubmit());
    expect(q('[role="alert"]')!.textContent).toBe(bc.needRep);
    expect(onBook).not.toHaveBeenCalled();
  });
});
