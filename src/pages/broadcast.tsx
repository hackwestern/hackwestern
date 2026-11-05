import Head from "next/head";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import {
  hackingPhase,
  nowAndNext,
  type BroadcastActivity,
} from "~/lib/broadcast";

// Venue broadcast display, loaded by OBS as a 1920x1080 Browser Source.
// Settings come from /internal/broadcast, now/next from the Events schedule
// sheet, the leaderboard from scavenger hunt points.

const WIDTH = 1920;
const HEIGHT = 1080;
const POLL_MS = 15_000;
const STALE_SCHEDULE_MS = 5 * 60_000;
const MAX_ACTIVITIES = 2;

type Media = { id: string; type: "image" | "video"; url: string };

// Past Hack Western photos until the organizer Drive folder is connected.
const PLACEHOLDER_MEDIA: Media[] = [
  "dsc02232",
  "hc-00986",
  "hc-02535",
  "dsc00540",
  "hc-01227",
  "dsc00517",
  "hc-01118",
  "dsc02287",
  "hc-00180",
  "hc-02152",
].map((name) => ({
  id: name,
  type: "image",
  url: `/landing/home/gallery/${name}.webp`,
}));

const easternTime = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleString("en-CA", { timeZone: "America/Toronto", ...options });
const clockTime = (date: Date) =>
  easternTime(date, { hour: "numeric", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");

// Null until mounted, so server and client render the same markup.
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Shrinks the fixed 1920x1080 canvas to fit smaller windows (OBS is exact).
function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(
        Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT),
      );
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function Card({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl bg-offwhite/95 px-8 py-6 text-heavy shadow-lg ${className}`}
    >
      <h2 className="mb-3 font-pix32 text-2xl uppercase tracking-wide text-emphasis">
        {label}
      </h2>
      {children}
    </section>
  );
}

function Countdown({
  start,
  end,
  now,
}: {
  start: Date | null;
  end: Date | null;
  now: number | null;
}) {
  const state = now === null ? null : hackingPhase(start, end, now);

  if (!state || state.phase === "unset") {
    return (
      <Card label="Hacking">
        <p className="text-4xl font-semibold">Times coming soon</p>
      </Card>
    );
  }
  if (state.phase === "after") {
    return (
      <Card label="Hacking">
        <p className="text-5xl font-semibold">Hacking has ended</p>
        <p className="mt-2 text-2xl text-medium">Submissions are closed</p>
      </Card>
    );
  }

  const s = state.secondsLeft;
  return (
    <Card label={state.phase === "before" ? "Hacking starts in" : "Time left"}>
      <p className="font-pix32 text-8xl tabular-nums leading-none">
        {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:
        {pad(s % 60)}
      </p>
      {state.phase === "during" && end && (
        <p className="mt-3 text-2xl text-medium">
          Submissions close{" "}
          {easternTime(end, {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          ET
        </p>
      )}
    </Card>
  );
}

function Activities({
  label,
  activities,
  empty,
}: {
  label: string;
  activities: BroadcastActivity[];
  empty: string;
}) {
  const shown = activities.slice(0, MAX_ACTIVITIES);
  const hidden = activities.length - shown.length;
  return (
    <Card label={label} className="h-full">
      {shown.length ? (
        <ul className="space-y-3">
          {shown.map((a) => (
            <li key={a.id}>
              <p className="line-clamp-1 text-3xl font-semibold">{a.title}</p>
              <p className="line-clamp-1 text-xl text-medium">
                {clockTime(a.start)}–{clockTime(a.end)}
                {a.location && ` · ${a.location}`}
              </p>
            </li>
          ))}
          {hidden > 0 && <li className="text-xl text-light">+{hidden} more</li>}
        </ul>
      ) : (
        <p className="text-2xl text-medium">{empty}</p>
      )}
    </Card>
  );
}

function Leaderboard({
  leaders,
}: {
  leaders: { name: string; points: number; rank: number }[];
}) {
  return (
    <Card label="Scavenger hunt" className="flex-1">
      {leaders.length ? (
        <ol className="space-y-6">
          {leaders.map((l, i) => (
            <li key={i} className="flex items-baseline gap-5 text-3xl">
              <span className="w-12 font-pix32 text-emphasis">{l.rank}</span>
              <span className="line-clamp-1 min-w-0 flex-1 font-semibold">
                {l.name}
              </span>
              <span className="tabular-nums">{l.points.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-2xl text-medium">No points yet</p>
      )}
    </Card>
  );
}

// Random rotation (never the same item twice in a row). Photos and videos
// each move on after their configured time; a short video moves on when it
// ends. Media that fails to load is skipped.
function MediaRotation({
  media,
  photoSeconds,
  videoSeconds,
}: {
  media: Media[];
  photoSeconds: number;
  videoSeconds: number;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const playable = media.filter((m) => !failed.includes(m.id));
  const [currentId, setCurrentId] = useState(media[0]?.id);
  const current = playable.find((m) => m.id === currentId) ?? playable[0];

  const advance = () => {
    const others = playable.filter((m) => m.id !== current?.id);
    const next = others[Math.floor(Math.random() * others.length)];
    if (next) setCurrentId(next.id);
  };

  useEffect(() => {
    if (!current) return;
    const seconds = current.type === "video" ? videoSeconds : photoSeconds;
    const timer = setTimeout(advance, seconds * 1000);
    return () => clearTimeout(timer);
    // advance only reads state that changes with current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, photoSeconds, videoSeconds, playable.length]);

  const skip = () => {
    if (current) setFailed((ids) => [...ids, current.id]);
  };

  return (
    <div className="relative h-full overflow-hidden rounded-3xl bg-heavy shadow-lg">
      <AnimatePresence initial={false}>
        {current && (
          <motion.div
            key={current.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            {current.type === "video" ? (
              <video
                src={current.url}
                className="h-full w-full object-contain"
                autoPlay
                muted
                playsInline
                onEnded={advance}
                onError={skip}
              />
            ) : (
              // A blurred copy fills the frame so portrait and landscape
              // photos both show uncropped without bare bars.
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt=""
                  className="relative h-full w-full object-contain"
                  onError={skip}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {!current && (
        <p className="absolute inset-0 flex items-center justify-center text-4xl text-offwhite">
          Photos from the floor are coming soon
        </p>
      )}
    </div>
  );
}

export default function Broadcast() {
  const now = useNow();
  const scale = useFitScale();
  const { data, isError } = api.broadcast.display.useQuery(undefined, {
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  const schedule =
    data?.activities && now !== null ? nowAndNext(data.activities, now) : null;
  const stale =
    isError ||
    (data?.scheduleFetchedAt != null &&
      now !== null &&
      now - data.scheduleFetchedAt.getTime() > STALE_SCHEDULE_MS);

  return (
    <>
      <Head>
        <title>Broadcast | Hack Western 13</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="fixed inset-0 overflow-hidden bg-heavy">
        <div
          className="absolute left-1/2 top-1/2 flex flex-col bg-[url('/landing/home/background.webp')] bg-cover bg-center p-12 font-figtree"
          style={{
            width: WIDTH,
            height: HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <header className="mb-8 flex items-center justify-between">
            <h1 className="font-pix32 text-6xl text-heavy">Hack Western 13</h1>
            {stale && (
              <p className="rounded-full bg-offwhite/95 px-5 py-2 text-xl text-medium">
                Reconnecting, info may be out of date
              </p>
            )}
          </header>
          <div className="flex min-h-0 flex-1 gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <div className="min-h-0 flex-1">
                <MediaRotation
                  media={PLACEHOLDER_MEDIA}
                  photoSeconds={data?.photoSeconds ?? 8}
                  videoSeconds={data?.videoSeconds ?? 20}
                />
              </div>
              <div className="grid h-[272px] grid-cols-2 gap-8">
                {schedule ? (
                  <>
                    <Activities
                      label="Now"
                      activities={schedule.now}
                      empty={
                        schedule.done
                          ? "That’s a wrap"
                          : "Nothing scheduled right now"
                      }
                    />
                    <Activities
                      label="Up next"
                      activities={schedule.next}
                      empty="Nothing else scheduled"
                    />
                  </>
                ) : (
                  <Card label="Schedule" className="col-span-2">
                    <p className="text-2xl text-medium">
                      {data ? "Schedule unavailable" : "Loading…"}
                    </p>
                  </Card>
                )}
              </div>
            </div>
            <aside className="flex w-[600px] flex-col gap-8">
              <Countdown
                start={data?.hackingStartsAt ?? null}
                end={data?.hackingEndsAt ?? null}
                now={now}
              />
              <Leaderboard leaders={data?.leaders ?? []} />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
