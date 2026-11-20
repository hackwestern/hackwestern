// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { IveyWalkNote } from "~/components/ivey-walk-note";
import { KeyRooms } from "~/components/sponsors/home/key-rooms";
import { iveyWalkCopy } from "~/content/ivey-walk";
import { IVEY, floorForQuery } from "~/lib/venue-map";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node: React.ReactNode) => act(() => root.render(node));

describe("Ivey walk note", () => {
  test("hacker: icon + text and a real Check map link to the map on Ivey", () => {
    render(<IveyWalkNote who="hacker" mapHref={iveyWalkCopy.hackerMapPath} />);
    expect(container.textContent).toContain(
      "This chat is in a different building (Ivey), a 15-minute walk away.",
    );
    // Not colour alone: an icon (hidden from screen readers) plus the words.
    expect(container.querySelector("svg[aria-hidden]")).not.toBeNull();
    const link = container.querySelector("a")!;
    expect(link.textContent).toBe("Check map");
    expect(link.getAttribute("href")).toBe("/live?tab=map&building=ivey");
  });

  test("sponsor wording; no link when there's nowhere to go", () => {
    render(<IveyWalkNote who="sponsor" mapHref={null} />);
    expect(container.textContent).toContain(
      "This chat is in a different building (Ivey), a 15-minute walk from the Sponsor Bay. Leave early.",
    );
    expect(container.querySelector("a")).toBeNull();
  });

  test("Home Key rooms shows it only when a chat is at Ivey", () => {
    const near = {
      rep: "Riley",
      room: "2241",
      building: "near" as const,
      start: "10:00",
    };
    render(<KeyRooms chats={[near]} mapHref="/sponsors/x/map?building=ivey" />);
    expect(container.textContent).not.toContain("different building");
    render(
      <KeyRooms
        chats={[
          near,
          { ...near, room: "1348", building: "ivey", start: "13:00" },
        ]}
        mapHref="/sponsors/x/map?building=ivey"
      />,
    );
    expect(container.textContent).toContain(iveyWalkCopy.sponsor);
    expect(container.querySelector("a")!.getAttribute("href")).toBe(
      "/sponsors/x/map?building=ivey",
    );
  });

  test("?building=ivey opens the map on the Ivey building", () => {
    expect(floorForQuery("ivey")).toBe(IVEY);
    expect(floorForQuery(undefined)).toBeUndefined();
    expect(floorForQuery("sei")).toBeUndefined();
  });
});
