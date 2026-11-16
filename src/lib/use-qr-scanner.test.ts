import * as QRCode from "qrcode";
import { describe, expect, test } from "vitest";

import {
  badgeCodeOf,
  cameraErrorStatus,
  decodeQrFrame,
  typedBadgeCodeOf,
} from "./use-qr-scanner";

/** A QR code as an RGBA frame, like a canvas would hand jsQR. */
function qrFrame(text: string, scale = 6, quiet = 4) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = (modules.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const dark =
        mx >= 0 &&
        my >= 0 &&
        mx < modules.size &&
        my < modules.size &&
        modules.get(my, mx);
      if (dark) {
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, width: size, height: size };
}

describe("decodeQrFrame", () => {
  test("reads a hacker id from a badge QR frame", () => {
    const { data, width, height } = qrFrame("cm3hackerid0001");
    expect(decodeQrFrame(data, width, height)).toBe("cm3hackerid0001");
  });

  test("a blank frame is null", () => {
    const data = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    expect(decodeQrFrame(data, 64, 64)).toBeNull();
  });
});

describe("cameraErrorStatus", () => {
  test("maps getUserMedia errors to what the sponsor can do", () => {
    expect(cameraErrorStatus({ name: "NotAllowedError" })).toBe("denied");
    expect(cameraErrorStatus({ name: "NotFoundError" })).toBe("unavailable");
    expect(cameraErrorStatus({ name: "AbortError" })).toBe("error");
    expect(cameraErrorStatus(null)).toBe("error");
  });
});

describe("badge codes", () => {
  test("scanned: 1-255 chars, no whitespace", () => {
    expect(badgeCodeOf(" brave-otter-kite ")).toBe("brave-otter-kite");
    expect(badgeCodeOf("cm3hackerid0001")).toBe("cm3hackerid0001");
    expect(badgeCodeOf("")).toBeNull();
    expect(badgeCodeOf("https://example.com/a b")).toBeNull();
    expect(badgeCodeOf("x".repeat(256))).toBeNull();
  });

  test("typed: spaces between words become dashes", () => {
    expect(typedBadgeCodeOf("  Brave otter   kite ")).toBe("Brave-otter-kite");
    expect(typedBadgeCodeOf("   ")).toBeNull();
  });
});
