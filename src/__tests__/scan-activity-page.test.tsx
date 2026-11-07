// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ScanActivityPage from "~/pages/scan/[activity]";

const { mutateAsync, stopTrack } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  stopTrack: vi.fn(),
}));

// Only getServerSideProps uses these; keep server env out of the browser test.
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("~/server/auth", () => ({ authOptions: {} }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("next/router", () => ({
  useRouter: () => ({ query: { activity: "booth" }, push: vi.fn() }),
}));
// Every frame "contains" the same QR code.
vi.mock("jsqr", () => ({ default: () => ({ data: "brave-otter-kite" }) }));
vi.mock("~/utils/api", () => ({
  api: {
    useUtils: () => ({}),
    scavengerHunt: {
      scan: { useMutation: () => ({ mutateAsync }) },
      getScavengerHuntItemById: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      getScavengerHuntItem: {
        useQuery: () => ({
          data: { id: 1, code: "booth", description: "Booth" },
          isLoading: false,
        }),
      },
    },
  },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  // A camera that always has a frame ready.
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: stopTrack }],
      }),
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
  });
  HTMLCanvasElement.prototype.getContext = (() => ({
    drawImage: () => undefined,
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
  })) as unknown as HTMLCanvasElement["getContext"];

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mutateAsync.mockReset();
  stopTrack.mockReset();
  vi.useRealTimers();
});

describe("scan page", () => {
  test("keeps scanning after a rejected scan", async () => {
    mutateAsync.mockRejectedValue({
      message:
        "This hacker has not been approved to attend and cannot be scanned.",
      data: { code: "FORBIDDEN" },
    });

    await act(async () => {
      root.render(<ScanActivityPage />);
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      container
        .querySelector("video")!
        .dispatchEvent(new Event("loadedmetadata"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500); // first frame scanned
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000); // error message clears
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500); // next frame scanned
    });

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(stopTrack).not.toHaveBeenCalled();
  });
});
