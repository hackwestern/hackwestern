import { useEffect, useRef, useState } from "react";

export type CameraStatus = "starting" | "scanning" | "denied" | "unavailable";

// BarcodeDetector isn't in TypeScript's DOM types yet, so describe the part used.
interface DetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options?: { formats?: string[] }) => DetectorLike;

/** How often the picture is checked for a QR code, in ms. */
const SCAN_EVERY_MS = 150;
/** The same code is not reported again for this long, in ms. */
const REPEAT_MS = 1500;
/** Frames are shrunk to this width before jsQR reads them. */
const FALLBACK_WIDTH = 480;

type Reader = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) => Promise<string | null>;

/**
 * The browser's own QR reader when it has one (Chrome, Android, recent Safari),
 * otherwise jsQR, loaded only when needed. Install it with: npm install jsqr
 */
async function makeReader(): Promise<Reader> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorCtor })
    .BarcodeDetector;
  if (Native) {
    try {
      const detector = new Native({ formats: ["qr_code"] });
      return async (video) => {
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      };
    } catch {
      // This browser can't read QR codes natively. Use jsQR below.
    }
  }

  const { default: jsQR } = await import("jsqr");
  return (video, canvas) => {
    const scale = Math.min(1, FALLBACK_WIDTH / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    return Promise.resolve(jsQR(image.data, width, height)?.data ?? null);
  };
}

interface QrCameraProps {
  /** Called with the raw text of every QR code read. */
  onDetect: (text: string) => void;
  /** Freezes the picture and stops reading until it is false again. */
  paused?: boolean;
  onStatus?: (status: CameraStatus) => void;
}

const MESSAGES: Partial<Record<CameraStatus, string>> = {
  starting: "Starting camera…",
  denied:
    "Camera access is blocked. Allow it in your browser settings, or enter the table number below.",
  unavailable:
    "The camera isn't available here. Enter the table number below.",
};

/**
 * Live rear-camera view that reads QR codes. It asks for the camera when it
 * appears and turns it off when it goes away.
 */
export function QrCamera({ onDetect, paused = false, onStatus }: QrCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("starting");

  // Latest values, read from inside the scan loop without restarting it.
  const onDetectRef = useRef(onDetect);
  const onStatusRef = useRef(onStatus);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onDetectRef.current = onDetect;
    onStatusRef.current = onStatus;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const canvas = document.createElement("canvas");

    const update = (next: CameraStatus) => {
      if (cancelled) return;
      setStatus(next);
      onStatusRef.current?.(next);
    };

    const start = async () => {
      // Missing on pages that aren't HTTPS (localhost is fine) and old browsers.
      if (!navigator.mediaDevices?.getUserMedia) {
        update("unavailable");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        update(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "unavailable",
        );
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        update("unavailable");
        return;
      }

      let read: Reader;
      try {
        read = await makeReader();
      } catch {
        update("unavailable");
        return;
      }
      update("scanning");

      let last = { text: "", at: 0 };
      let busy = false;
      const tick = async () => {
        if (cancelled) return;
        if (
          !busy &&
          !pausedRef.current &&
          video.readyState >= 2 &&
          video.videoWidth > 0
        ) {
          busy = true;
          try {
            const text = await read(video, canvas);
            const now = Date.now();
            if (
              text &&
              !cancelled &&
              !pausedRef.current &&
              (text !== last.text || now - last.at > REPEAT_MS)
            ) {
              last = { text, at: now };
              onDetectRef.current(text);
            }
          } catch {
            // A frame that can't be read is skipped.
          }
          busy = false;
        }
        timer = window.setTimeout(() => void tick(), SCAN_EVERY_MS);
      };
      void tick();
    };

    void start();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Freeze the last frame while paused (a code was found).
  useEffect(() => {
    const video = videoRef.current;
    if (!video?.srcObject) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [paused]);

  const message = MESSAGES[status];

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-[1.5px] border-[#0b2238] bg-[#0b2238]">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Camera view"
        className="h-full w-full object-cover"
      />
      {status === "scanning" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-white/80"
        />
      )}
      {message && (
        <p
          role="status"
          className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-[17px] text-[#d6dbe5]"
        >
          {message}
        </p>
      )}
    </div>
  );
}