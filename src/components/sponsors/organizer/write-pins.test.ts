import { describe, expect, test } from "vitest";
import {
  applyPins,
  livePins,
  WRITE_PIN_MS,
  withoutPin,
  withPin,
  type Pins,
} from "~/components/sponsors/organizer/write-pins";

// What the board shows after a tap while getSponsors answers come back from
// different server instances, some with a copy from before the write.

type Row = { name: string; status: string; atCcWorkshop: boolean | null };
const server = (
  status: string,
  atCcWorkshop: boolean | null = false,
): Row[] => [
  { name: "Acme", status, atCcWorkshop },
  { name: "Globex", status: "Not arrived", atCcWorkshop: false },
];
const T0 = 1_000_000;

describe("write pins", () => {
  test("a stale answer from another instance can't flip the pill back", () => {
    const pins = withPin(new Map(), "Acme", "status", "Checked in", T0);
    // The 30 s poll and the post-write refetch both answer the old copy.
    for (const at of [T0 + 2_000, T0 + 30_000, T0 + 59_000]) {
      const shown = applyPins(server("Not arrived"), pins, at);
      expect(shown[0]?.status).toBe("Checked in");
      expect(shown[1]?.status).toBe("Not arrived");
    }
  });

  test("names match like the server (case, spaces)", () => {
    const pins = withPin(new Map(), " acme ", "atCcWorkshop", true, T0);
    expect(applyPins(server("Not arrived"), pins, T0)[0]?.atCcWorkshop).toBe(
      true,
    );
  });

  test("once it runs out, the server's value shows again", () => {
    const pins = withPin(new Map(), "Acme", "status", "Checked in", T0);
    const later = T0 + WRITE_PIN_MS + 1;
    expect(applyPins(server("Left"), pins, later)[0]?.status).toBe("Left");
    expect(livePins(pins, later).size).toBe(0);
    expect(livePins(pins, T0 + 1)).toBe(pins);
  });

  test("a failed write drops only its own pin", () => {
    let pins: Pins = withPin(new Map(), "Acme", "status", "Checked in", T0);
    pins = withPin(pins, "Globex", "status", "Left", T0);
    pins = withoutPin(pins, "Acme", "status");
    const shown = applyPins(server("Not arrived"), pins, T0);
    expect(shown.map((s) => s.status)).toEqual(["Not arrived", "Left"]);
  });

  test("nothing to change: the same list (select stays cheap)", () => {
    const list = server("Checked in");
    expect(applyPins(list, new Map(), T0)).toBe(list);
    const pins = withPin(new Map(), "Acme", "status", "Checked in", T0);
    expect(applyPins(list, pins, T0)).toBe(list);
  });
});
