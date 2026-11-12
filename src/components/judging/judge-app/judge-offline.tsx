import { useCallback, useEffect, useRef, useState } from "react";

import { infoBanner, warningBanner } from "../shared/judge-ui";
import { type JudgedTeam } from "../judge-app/judge-teams";

/** Scores the judge submitted, waiting to reach the server. */
export interface QueuedSubmission {
  id: string;
  judge: string;
  results: JudgedTeam[];
  queuedAt: number;
}

/** Everything needed to pick up where the judge left off after a reload. */
export interface Progress {
  done: number;
  started: boolean;
  results: JudgedTeam[];
  /** True once the latest results reached the server. */
  sent: boolean;
}

// One entry per judge, so two judges sharing a phone don't mix.
const OUTBOX_KEY = "hw13-judge-outbox-";
const PROGRESS_KEY = "hw13-judge-progress-";
/** While something is waiting, try again this often, in ms. */
const RETRY_MS = 15_000;

// Storage can throw (private mode, blocked site data): the app still works,
// it just can't survive a reload.
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved: storage is full or blocked.
  }
}

function readQueue(judgeKey: string): QueuedSubmission[] {
  const raw = readJson(OUTBOX_KEY + judgeKey);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is QueuedSubmission =>
      typeof q === "object" &&
      q !== null &&
      typeof (q as QueuedSubmission).id === "string" &&
      Array.isArray((q as QueuedSubmission).results),
  );
}

export function readProgress(judgeKey: string): Progress | null {
  const raw = readJson(PROGRESS_KEY + judgeKey) as Partial<Progress> | null;
  if (!raw || typeof raw.done !== "number" || !Array.isArray(raw.results)) {
    return null;
  }
  return {
    done: raw.done,
    started: raw.started === true,
    results: raw.results,
    sent: raw.sent === true,
  };
}

export function writeProgress(judgeKey: string, progress: Progress) {
  writeJson(PROGRESS_KEY + judgeKey, progress);
}

/**
 * Sends one submission to the server. STUB: waits a moment and logs it.
 * Replace the body with the real API call. It must throw when the send fails,
 * so the submission stays queued and is tried again.
 */
export async function sendScores(item: QueuedSubmission): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("offline");
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.log("[judge app] scores submitted", {
    judge: item.judge,
    results: item.results,
  });
}

/** Whether the phone thinks it has a connection. Assumes yes until told. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * A queue kept on the device. `submit` saves the scores at once; they are sent
 * as soon as there is a connection, and again every few seconds until the
 * server accepts them. The queue survives a reload.
 */
export function useOutbox(
  judgeKey: string,
  send: (item: QueuedSubmission) => Promise<void>,
  onSent?: (item: QueuedSubmission) => void,
) {
  const online = useOnline();
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const queueRef = useRef<QueuedSubmission[]>([]);
  const flushing = useRef(false);
  const sendRef = useRef(send);
  const onSentRef = useRef(onSent);
  useEffect(() => {
    sendRef.current = send;
    onSentRef.current = onSent;
  });

  const store = useCallback(
    (next: QueuedSubmission[]) => {
      queueRef.current = next;
      setQueue(next);
      writeJson(OUTBOX_KEY + judgeKey, next);
    },
    [judgeKey],
  );

  // Pick up anything left over from before a reload.
  useEffect(() => {
    const saved = readQueue(judgeKey);
    queueRef.current = saved;
    setQueue(saved);
  }, [judgeKey]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length > 0) {
        const [next] = queueRef.current;
        if (!next) break;
        try {
          await sendRef.current(next);
        } catch {
          break; // Still offline, or the server said no. Try again later.
        }
        store(queueRef.current.slice(1));
        onSentRef.current?.(next);
      }
    } finally {
      flushing.current = false;
    }
  }, [store]);

  useEffect(() => {
    if (!online || queue.length === 0) return;
    void flush();
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [online, queue.length, flush]);

  const submit = useCallback(
    (payload: { judge: string; results: JudgedTeam[] }) => {
      store([
        ...queueRef.current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...payload,
          queuedAt: Date.now(),
        },
      ]);
    },
    [store],
  );

  return { online, pending: queue.length, submit };
}

interface JudgeOfflineBannerProps {
  online: boolean;
  /** Submissions saved on the device but not yet sent. */
  pending: number;
}

/** Tells the judge when scores are only on their phone, and when they send. */
export function JudgeOfflineBanner({
  online,
  pending,
}: JudgeOfflineBannerProps) {
  if (!online) {
    return (
      <p role="status" className={warningBanner}>
        You&apos;re offline. Scores save on this phone and send when you&apos;re
        back online.
      </p>
    );
  }
  if (pending > 0) {
    return (
      <p role="status" className={infoBanner}>
        Sending your scores…
      </p>
    );
  }
  return null;
}
