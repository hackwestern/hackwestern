import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import {
  hackingPhase,
  nowAndNext,
  type BroadcastActivity,
} from "~/lib/broadcast";
import {
  BroadcastCanvas,
  BroadcastHeader,
  BroadcastWindow,
  easternTime,
  useNow,
} from "~/components/broadcast/shell";

// Venue dashboard: hacking countdown, now/next from the Events schedule sheet,
// the scavenger hunt top 5 and a photo/video rotation from the organizers'
// Drive folder. Settings live at /internal/broadcast.

const POLL_MS = 15_000;
const STALE_SCHEDULE_MS = 5 * 60_000;

type Media = { id: string; type: "image" | "video"; url: string };

// Past Hack Western photos until the Drive folder has something in it
const PLACEHOLDER_MEDIA: Media[] = [
  "dsc02232",
  "dsc00540",
  "dsc00517",
  "dsc02287",
  "dsc00585",
  "dsc02198",
  "dsc02258",
  "dsc00523",
].map((name) => ({
  id: name,
  type: "image",
  url: `/landing/home/gallery/${name}.webp`,
}));

const pad = (n: number) => String(n).padStart(2, "0");
const clockTime = (date: Date) =>
  easternTime(date, { hour: "numeric", minute: "2-digit" });
const timeRange = (a: BroadcastActivity) =>
  `${clockTime(a.start).replace(/ [AP]M$/, "")}-${clockTime(a.end)}`;

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex w-full flex-col items-start rounded-[6px] bg-white px-[24px] py-[18px] ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="whitespace-nowrap text-[16px] font-semibold uppercase text-[#61666c]">
    {children}
  </p>
);

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
  const seconds =
    state && (state.phase === "before" || state.phase === "during")
      ? state.secondsLeft
      : 0;
  const progress =
    state?.phase === "after"
      ? 1
      : state?.phase === "during" && start && end && now !== null
        ? (now - start.getTime()) / (end.getTime() - start.getTime())
        : 0;
  const label =
    state?.phase === "before"
      ? "Hacking starts in"
      : state?.phase === "after"
        ? "Hacking has ended"
        : "Hacking ends in";
  const units = [
    [pad(Math.floor(seconds / 3600)), "hours"],
    [pad(Math.floor((seconds % 3600) / 60)), "minutes"],
    [pad(seconds % 60), "seconds"],
  ] as const;

  return (
    <Card className="gap-[24px]">
      <Label>{label}</Label>
      <div className="flex w-full flex-col items-start gap-[24px]">
        <div className="flex items-start gap-[12.259px] whitespace-nowrap">
          {units.map(([value, unit], index) => (
            <div key={unit} className="flex items-start gap-[12.259px]">
              {index > 0 && (
                <p className="font-cossetteTexte text-[87.567px] font-bold leading-none text-[#5aa1e8]">
                  :
                </p>
              )}
              <div className="flex flex-col items-start">
                <p className="font-cossetteTexte text-[87.567px] font-bold tabular-nums leading-none text-[#042239]">
                  {value}
                </p>
                <p className="text-[17.429px] font-semibold text-[#898e94]">
                  {unit}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="relative h-[12px] w-full rounded-[50px] bg-[#d1d4d8]">
          <div
            className="relative h-full min-w-[12px] opacity-80"
            style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
          >
            <div className="absolute inset-0 overflow-clip rounded-[32.13px] border-[0.321px] border-[#176bbf]">
              <div className="absolute inset-0 rounded-[32.13px] bg-[#3b94ec]" />
              <div className="absolute inset-[-0.32px_3.11px_7.77px_3.11px] rounded-[32.13px] bg-gradient-to-b from-[rgba(255,255,255,0.8)] to-[rgba(255,255,255,0)]" />
              <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_-3.856px_3.213px_0px_rgba(255,255,255,0.4)]" />
            </div>
          </div>
        </div>
        {end && (
          <p className="whitespace-nowrap text-[18px] font-semibold text-[#898e94]">
            {state?.phase === "before" && start
              ? "Hacking starts "
              : "Submissions close "}
            <span className="font-bold text-[#16191d]">
              {easternTime(state?.phase === "before" && start ? start : end, {
                weekday: "long",
                month: "short",
                day: "numeric",
              }).replace(/(\w{3}) /, "$1. ")}{" "}
              @{" "}
              {easternTime(state?.phase === "before" && start ? start : end, {
                hour: "numeric",
              })}
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}

function NowAndNext({
  activities,
  now,
  hacking,
}: {
  activities: BroadcastActivity[] | null;
  now: number | null;
  /** Between hacking start and end, so an empty "now" still means hacking */
  hacking: boolean;
}) {
  const schedule =
    activities && now !== null ? nowAndNext(activities, now) : null;
  const current = schedule?.now[0];
  const next = schedule?.next[0];
  const moreNow = (schedule?.now.length ?? 0) - 1;
  const moreNext = (schedule?.next.length ?? 0) - 1;

  return (
    <Card className="gap-[18px]">
      <div className="flex w-full flex-col items-start gap-[12px]">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-[6px]">
            <div className="relative size-[10px] shrink-0">
              <div className="absolute inset-[0_-11.11%_-27.78%_-11.11%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="block size-full max-w-none"
                  src="/broadcast/now-dot.svg"
                />
              </div>
            </div>
            <p className="whitespace-nowrap text-[16px] font-semibold uppercase text-[#209e57]">
              Now
            </p>
          </div>
          {current && (
            <p className="whitespace-nowrap text-[16px] font-semibold text-[#898e94]">
              {timeRange(current)}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col items-start gap-[6px] font-semibold">
          <p className="line-clamp-2 text-[24px] text-black">
            {current
              ? current.title
              : schedule?.done
                ? "That's a wrap!"
                : hacking
                  ? "Hacking"
                  : "Nothing on right now"}
          </p>
          {(Boolean(current?.location) || moreNow > 0) && (
            <p className="line-clamp-1 text-[20px] text-[#898e94]">
              {current?.location}
              {moreNow > 0 &&
                `${current?.location ? " · " : ""}+${moreNow} more happening`}
            </p>
          )}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="block h-px w-full" src="/broadcast/divider.svg" />
      <div className="flex w-full flex-col items-start gap-[12px]">
        <Label>Up next</Label>
        <p className="flex w-full items-baseline gap-[8px] font-semibold">
          <span className="line-clamp-1 shrink-0 text-[20px] text-black">
            {next ? next.title : "Nothing else scheduled"}
          </span>
          {next && (
            <span className="truncate text-[18px] text-[#898e94]">
              {[next.location, clockTime(next.start)]
                .filter(Boolean)
                .join(" · ")}
              {moreNext > 0 && ` · +${moreNext} more`}
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}

function Leaderboard({
  leaders,
}: {
  leaders: { name: string; points: number; rank: number }[];
}) {
  return (
    <Card className="gap-[18px]">
      <div className="flex w-full items-center justify-between">
        <Label>Scavenger hunt</Label>
        <p className="whitespace-nowrap text-[16px] font-semibold text-[#898e94]">
          Top 5
        </p>
      </div>
      <div className="flex w-full flex-col items-start gap-[2px]">
        {leaders.length === 0 && (
          <p className="p-[4px] text-[18px] font-semibold text-[#898e94]">
            No points yet. Get scanned at activities to climb the board!
          </p>
        )}
        {leaders.map((leader, index) => (
          <div
            key={index}
            className={`flex w-full items-start justify-between rounded-[4px] p-[4px] ${leader.rank === 1 ? "bg-[rgba(90,161,232,0.2)]" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-[10px]">
              <div
                className={`flex size-[24px] shrink-0 items-center justify-center rounded-[4px] text-[14px] font-bold ${leader.rank === 1 ? "bg-[#2e547a] text-white" : "bg-[#f0f0f0] text-[#61666c]"}`}
              >
                {leader.rank}
              </div>
              <p className="truncate text-[18px] font-semibold text-black">
                {leader.name}
              </p>
            </div>
            <p className="whitespace-nowrap text-[18px] font-semibold text-black">
              {leader.points}pt
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Random rotation (never the same item twice in a row). Photos move on after
// their time, videos when they end or hit their limit. Media that fails to
// load is skipped.
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
    <div className="absolute inset-0 overflow-hidden bg-[#ededed]">
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
                className="h-full w-full bg-black object-contain"
                autoPlay
                muted
                playsInline
                onEnded={advance}
                onError={skip}
              />
            ) : (
              // A blurred copy fills the frame so portrait and landscape
              // photos both show uncropped
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
                  referrerPolicy="no-referrer"
                  className="relative h-full w-full object-contain"
                  onError={skip}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BroadcastDashboard() {
  const now = useNow();
  const { data, isError } = api.broadcast.display.useQuery(undefined, {
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  const stale =
    isError ||
    (data?.scheduleFetchedAt != null &&
      now !== null &&
      now - data.scheduleFetchedAt.getTime() > STALE_SCHEDULE_MS);
  const media = data?.media?.length ? data.media : PLACEHOLDER_MEDIA;

  return (
    <BroadcastCanvas title="Live Dashboard">
      {/* Sky */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(210.89deg, rgb(97, 148, 184) 18.358%, rgb(153, 248, 249) 83.008%)",
        }}
      />
      <div className="absolute inset-0 bg-[url('/broadcast/bg-texture.webp')] bg-[length:921.6px_921.6px] bg-left-top opacity-20" />

      <BroadcastWindow
        title="Photo Gallery"
        className="absolute left-[40px] top-[160.78px] h-[758px] w-[1356px] bg-[#ededed]"
      >
        <MediaRotation
          key={media.map((m) => m.id).join()}
          media={media}
          photoSeconds={data?.photoSeconds ?? 8}
          videoSeconds={data?.videoSeconds ?? 20}
        />
      </BroadcastWindow>

      {/* Mountains, drawn over the bottom of the photo window like the design */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[660px] top-[489.3px] flex h-[1073.367px] w-[1522.025px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-[970.294px] w-[1455.442px] max-w-none rotate-[4.16deg] object-cover"
            src="/broadcast/mountain-261.webp"
          />
        </div>
        <div className="absolute left-[208.36px] top-[193.54px] flex h-[1389.097px] w-[1880.801px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-[1157.119px] w-[1735.679px] max-w-none rotate-[8.06deg] object-bottom"
            src="/broadcast/mountain-251.webp"
          />
        </div>
        <div className="absolute left-[-63.16px] top-[518.64px] flex h-[1207.282px] w-[1701.151px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-[1079.135px] w-[1618.703px] max-w-none rotate-[4.67deg] object-cover"
            src="/broadcast/mountain-259.webp"
          />
        </div>
      </div>

      <div className="absolute left-[40px] top-[54px]">
        <BroadcastHeader
          pill={stale ? ["Reconnecting…"] : ["Live", "Western University"]}
        />
      </div>

      <div className="absolute left-[1416.92px] top-[160.78px] flex w-[463.078px] flex-col items-start gap-[15px]">
        <Countdown
          start={data?.hackingStartsAt ?? null}
          end={data?.hackingEndsAt ?? null}
          now={now}
        />
        <NowAndNext
          activities={data?.activities ?? null}
          now={now}
          hacking={
            now !== null &&
            hackingPhase(
              data?.hackingStartsAt ?? null,
              data?.hackingEndsAt ?? null,
              now,
            ).phase === "during"
          }
        />
        <Leaderboard leaders={data?.leaders ?? []} />
      </div>
    </BroadcastCanvas>
  );
}
