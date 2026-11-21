// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingForm } from "~/components/sponsors/organizer/coffee-sessions/chat-modal";
import type { SessionBoardData } from "~/components/sponsors/organizer/coffee-sessions/parts";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";

const bc = coffeeSessionsCopy.booking;

const { useQuery, useOptions } = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useOptions: vi.fn(),
}));
vi.mock("~/utils/api", () => ({
  api: {
    coffeeChatSessions: {
      bookingHackers: { useQuery },
      bookingOptions: { useQuery: useOptions },
    },
  },
}));

// Sid has a chat at 10-11 already; Sam and Sal are free. Moon Co has no
// coffee chat setup (no reps) and is still offered.
const board = {
  sponsors: [],
  placements: [{ repId: "sid", sessionId: "10" }],
  bookings: [{ sessionId: "10", room: "2242", repIds: ["sal"] }],
} as unknown as SessionBoardData;
const OPTIONS = {
  sponsors: [
    {
      id: "moon",
      name: "Moon Co",
      reps: [],
    },
    {
      id: "sun",
      name: "Sun Co",
      reps: [
        { id: "sam", name: "Sam" },
        { id: "sid", name: "Sid" },
        { id: "sal", name: "Sal" },
        { id: "sue", name: "Sue" },
      ],
    },
  ],
  staff: ["Caroline", "Noah"],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  useOptions.mockReturnValue({ isSuccess: true, data: OPTIONS });
  useQuery.mockImplementation((input: { q: string }) => ({
    isLoading: false,
    isFetching: false,
    data: {
      scanned: [
        { userId: "u-bob", name: "Bob B.", hackerId: "calm-otter-kite" },
        { userId: "u-ada", name: "Ada L.", hackerId: null },
      ],
      found: input.q
        ? [{ userId: "u-cy", name: "Cy D.", hackerId: "brave-fox-lamp" }]
        : [],
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
  useOptions.mockReset();
});

/** Set a select's value the way a person does (React listens for "change"). */
function pick(el: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )!.set!.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);

function render(onBook = vi.fn()) {
  act(() => {
    root.render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <BookingForm
              board={board}
              initial={{ room: "2241", session: "10" }}
              busy={false}
              onBook={onBook}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
  });
  return onBook;
}

/** Type into an input the way a person does. */
function type(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const submit = () => act(() => q<HTMLFormElement>("form")!.requestSubmit());

describe("Book an event form", () => {
  test("room and session are fixed; Booked by is a list of the sponsorship team; any sponsor is offered", () => {
    render();
    expect(document.body.textContent).toContain(bc.title);
    expect(document.body.textContent).toContain(bc.where("Rm 2241", "10–11"));
    expect(q("#bk-room")).toBeNull();
    expect(q("#bk-session")).toBeNull();
    expect(q("#bk-booked-by")!.tagName).toBe("SELECT");
    expect(
      [...q<HTMLSelectElement>("#bk-booked-by")!.options].map(
        (o) => o.textContent,
      ),
    ).toEqual([bc.bookedByPick, "Caroline", "Noah"]);
    expect(
      [...q<HTMLSelectElement>("#bk-sponsor")!.options].map(
        (o) => o.textContent,
      ),
    ).toEqual([bc.sponsorNone, "Moon Co", "Sun Co"]);
    // No sponsor yet: no hacker picker.
    expect(document.body.textContent).toContain(bc.hackersNeedSponsor);
  });

  test("description and booked by are required", () => {
    const onBook = render();
    submit();
    expect(q('[role="alert"]')!.textContent).toBe(bc.needDescription);
    act(() => type(q<HTMLInputElement>("#bk-description")!, "Mentor hour"));
    submit();
    expect(q('[role="alert"]')!.textContent).toBe(bc.needBookedBy);
    expect(onBook).not.toHaveBeenCalled();
  });

  test("a room just for the team: no sponsor, reps or hackers", () => {
    const onBook = render();
    act(() => type(q<HTMLInputElement>("#bk-description")!, "Spon team sync"));
    act(() => pick(q<HTMLSelectElement>("#bk-booked-by")!, "Noah"));
    submit();
    expect(onBook).toHaveBeenLastCalledWith({
      room: "2241",
      session: "10",
      description: "Spon team sync",
      bookedBy: "Noah",
      sponsorId: null,
      repIds: [],
      userIds: [],
    });
  });

  test("several reps (only those free then) and several hackers, scanned or found by search", async () => {
    vi.useFakeTimers();
    try {
      const onBook = render();
      act(() => type(q<HTMLInputElement>("#bk-description")!, "Resume pass"));
      act(() => pick(q<HTMLSelectElement>("#bk-booked-by")!, "Caroline"));
      act(() => pick(q<HTMLSelectElement>("#bk-sponsor")!, "sun"));
      // Every rep is listed; busy ones say why and can't be picked.
      const reps = q(`ul[aria-label="${bc.reps}"]`)!;
      expect(
        [...reps.querySelectorAll("label")].map((l) => l.textContent),
      ).toEqual(["Sam", "Sid", "Sal", "Sue"]);
      const sid = q<HTMLInputElement>('input[value="sid"]')!;
      const sal = q<HTMLInputElement>('input[value="sal"]')!;
      expect(sid.disabled).toBe(true);
      expect(sal.disabled).toBe(true);
      expect(q<HTMLInputElement>('input[value="sam"]')!.disabled).toBe(false);
      expect(q("#bk-rep-busy-sid")!.textContent).toBe(bc.repInChat("Sid"));
      expect(q("#bk-rep-busy-sal")!.textContent).toBe(bc.repBooked("Sal"));
      expect(q("#bk-rep-busy-sam")).toBeNull();
      // Announced, and not colour alone (an icon with the text).
      expect(
        q("#bk-rep-busy-sid")!.parentElement!.getAttribute("aria-live"),
      ).toBe("polite");
      expect(q("#bk-rep-busy-sid svg")).not.toBeNull();
      expect(sid.getAttribute("aria-describedby")).toContain("bk-rep-busy-sid");
      // Free time that day: Sid's chat at 10-11 leaves 11-12 and 1-5.
      expect(q("#bk-rep-free-sid")!.textContent).toBe(
        bc.repFree("11:00 AM–12:00 PM, 1:00 PM–5:00 PM"),
      );
      expect(q("#bk-rep-free-sam")!.textContent).toBe(
        bc.repFree("10:00 AM–12:00 PM, 1:00 PM–5:00 PM"),
      );
      // A click on a busy rep does nothing.
      act(() => sid.click());
      expect(sid.checked).toBe(false);
      act(() => q<HTMLInputElement>('input[value="sam"]')!.click());
      act(() => q<HTMLInputElement>('input[value="sue"]')!.click());
      const scanned = q(`ul[aria-label="${bc.scannedTitle}"]`)!;
      expect(
        [...scanned.querySelectorAll("label")].map((l) => l.textContent),
      ).toEqual([bc.hackerLine("Bob B.", "calm-otter-kite"), "Ada L."]);
      act(() => q<HTMLInputElement>('input[value="u-ada"]')!.click());
      act(() => q<HTMLInputElement>('input[value="u-bob"]')!.click());
      act(() => type(q<HTMLInputElement>("#bk-search")!, "brave"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(useQuery).toHaveBeenLastCalledWith(
        { sponsorId: "sun", q: "brave" },
        expect.anything(),
      );
      act(() => q<HTMLInputElement>('input[value="u-cy"]')!.click());
      expect(document.body.textContent).toContain(bc.picked(3));
      submit();
      expect(onBook).toHaveBeenLastCalledWith({
        room: "2241",
        session: "10",
        description: "Resume pass",
        bookedBy: "Caroline",
        sponsorId: "sun",
        repIds: ["sam", "sue"],
        userIds: ["u-ada", "u-bob", "u-cy"],
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
