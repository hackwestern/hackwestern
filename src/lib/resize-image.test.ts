import { afterEach, describe, expect, test, vi } from "vitest";
import { resizeToWebp } from "./resize-image";

// A canvas whose toBlob answers like a browser: `encodes` lists the types it
// can make; anything else comes back as PNG (what Safari does for WebP).
function fakeCanvas(encodes: string[]) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toBlob: (done: (b: Blob | null) => void, type: string) =>
      done(
        new Blob(["x"], { type: encodes.includes(type) ? type : "image/png" }),
      ),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 400, height: 300, close: vi.fn() })),
  );
}

const file = new File(["x"], "me.jpg", { type: "image/jpeg" });

describe("resizeToWebp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("makes WebP where the browser can", async () => {
    fakeCanvas(["image/webp", "image/jpeg"]);
    expect((await resizeToWebp(file)).type).toBe("image/webp");
  });

  test("falls back to JPEG where it can't (Safari)", async () => {
    fakeCanvas(["image/jpeg"]);
    expect((await resizeToWebp(file)).type).toBe("image/jpeg");
  });

  test("refuses when neither works", async () => {
    fakeCanvas([]);
    await expect(resizeToWebp(file)).rejects.toThrow(
      "Could not convert the image",
    );
  });
});
