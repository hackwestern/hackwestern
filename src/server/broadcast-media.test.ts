import { describe, expect, test } from "vitest";
import { driveFolderIdFrom } from "~/lib/broadcast";
import { driveFileToMedia } from "~/server/broadcast-media";

describe("driveFolderIdFrom", () => {
  test("takes a folder link or a bare id", () => {
    expect(
      driveFolderIdFrom(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing",
      ),
    ).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFolderIdFrom("  1AbCdEfGhIjKlMnOp ")).toBe("1AbCdEfGhIjKlMnOp");
  });

  test("rejects anything that isn't a folder", () => {
    expect(driveFolderIdFrom("")).toBeNull();
    expect(driveFolderIdFrom("https://example.com/photos")).toBeNull();
  });
});

describe("driveFileToMedia", () => {
  test("images and videos get display URLs, other files are skipped", () => {
    expect(driveFileToMedia({ id: "img1", mimeType: "image/heic" })).toEqual({
      id: "img1",
      type: "image",
      url: "https://lh3.googleusercontent.com/d/img1=w1920",
    });
    expect(driveFileToMedia({ id: "vid1", mimeType: "video/mp4" })?.type).toBe(
      "video",
    );
    expect(
      driveFileToMedia({ id: "doc1", mimeType: "application/pdf" }),
    ).toBeNull();
  });
});
