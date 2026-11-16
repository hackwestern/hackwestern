import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera QR scanner for phones: opens the rear camera, decodes frames with
 * jsQR, and hands back the first code it reads. Stops the camera when
 * `active` turns false and on unmount.
 */

export type QrScannerStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "denied" // the person or the browser blocked the camera
  | "unavailable" // no camera, or no camera API (e.g. plain http)
  | "error";

/** How often to try decoding a frame. Plenty for a held-up badge. */
const SCAN_INTERVAL_MS = 150;

/** Text in a QR code in an RGBA frame, or null. */
export function decodeQrFrame(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  const code = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  const text = code?.data.trim();
  return text ? text : null;
}

/**
 * A scanned code worth looking up: 1-255 characters, no whitespace (a user
 * id or a hacker ID like "brave-otter-kite"). Anything else is null, so a
 * random QR never reaches the server.
 */
export function badgeCodeOf(text: string): string | null {
  const code = text.trim();
  return code.length >= 1 && code.length <= 255 && !/\s/.test(code)
    ? code
    : null;
}

/** A typed code: "Brave otter  kite" -> "Brave-otter-kite", then as scanned. */
export function typedBadgeCodeOf(text: string): string | null {
  return badgeCodeOf(text.trim().replace(/\s+/g, "-"));
}

/** Map a getUserMedia failure to what the person can do about it. */
export function cameraErrorStatus(error: unknown): QrScannerStatus {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    name === "TypeError"
  ) {
    return "unavailable";
  }
  return "error";
}

export function useQrScanner({
  active,
  onResult,
}: {
  active: boolean;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<QrScannerStatus>("idle");
  // Bumped by retry() to start the camera again after a failure.
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attached: HTMLVideoElement | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (ctx && video && video.readyState >= video.HAVE_CURRENT_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const text = decodeQrFrame(frame.data, frame.width, frame.height);
          if (text) {
            // One result per activation; the caller turns `active` off.
            cancelled = true;
            onResultRef.current(text);
            return;
          }
        }
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    const start = async () => {
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) setStatus(cameraErrorStatus(error));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (video) {
        attached = video;
        video.srcObject = stream;
        // iOS needs muted + playsInline to play without a tap.
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => undefined);
      }
      if (cancelled) return;
      setStatus("scanning");
      tick();
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (attached) attached.srcObject = null;
    };
  }, [active, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { videoRef, status, retry };
}
