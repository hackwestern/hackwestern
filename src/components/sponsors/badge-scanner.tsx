import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CameraOff,
  CircleCheck,
  Clock,
  Coffee,
  MapPin,
  ScanLine,
  UserX,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorScanCopy } from "~/content/sponsor-scan";
import { formatClock } from "~/lib/run-of-show";
import { useQrScanner, type QrScannerStatus } from "~/lib/use-qr-scanner";
import { cn } from "~/lib/utils";
import type { CoffeeChatOffer } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

const copy = sponsorScanCopy;

type Phase =
  | { kind: "scan" }
  | { kind: "hacker"; userId: string }
  | { kind: "sent"; offer: CoffeeChatOffer };

const enterMotion =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200";

// Scan a hacker's badge (or /live QR, which holds their user id), then offer
// them a coffee chat at one of the sponsor's open start times.
export function BadgeScanner({ sponsor }: { sponsor: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "scan" });
  // One persistent live region; each step writes what changed into it.
  const [announcement, setAnnouncement] = useState("");
  // The sponsor's own name sticks between scans.
  const [repName, setRepName] = useState("");
  // Each step's heading takes focus so keyboard and screen reader users
  // land on the new content.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusKey, setFocusKey] = useState(0);
  useEffect(() => {
    if (focusKey > 0) headingRef.current?.focus();
  }, [focusKey]);

  const go = (next: Phase, message: string) => {
    setPhase(next);
    setAnnouncement(message);
    setFocusKey((k) => k + 1);
  };
  const scanNext = () => go({ kind: "scan" }, copy.camera.scanning);

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {phase.kind === "scan" && (
        <CameraPanel
          headingRef={headingRef}
          onScan={(userId) => go({ kind: "hacker", userId }, copy.lookingUp)}
        />
      )}
      {phase.kind === "hacker" && (
        <OfferStep
          key={phase.userId}
          sponsor={sponsor}
          userId={phase.userId}
          repName={repName}
          onRepName={setRepName}
          headingRef={headingRef}
          announce={setAnnouncement}
          onFocusHeading={() => setFocusKey((k) => k + 1)}
          onSent={(offer) =>
            go(
              { kind: "sent", offer },
              copy.sent.body(
                offer.firstName,
                formatClock(offer.slotTime),
                offer.room,
              ),
            )
          }
          onScanNext={scanNext}
        />
      )}
      {phase.kind === "sent" && (
        <SentPanel
          sponsor={sponsor}
          offer={phase.offer}
          headingRef={headingRef}
          onScanNext={scanNext}
        />
      )}
    </div>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function StepHeading({
  headingRef,
  children,
}: {
  headingRef: HeadingRef;
  children: React.ReactNode;
}) {
  return (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="m-0 break-words text-xl font-semibold text-dashboard-text-heavy focus:outline-none"
    >
      {children}
    </h2>
  );
}

function CameraPanel({
  headingRef,
  onScan,
}: {
  headingRef: HeadingRef;
  onScan: (userId: string) => void;
}) {
  const [active, setActive] = useState(true);
  const { videoRef, status, retry } = useQrScanner({
    active,
    onResult: (text) => {
      setActive(false);
      onScan(text);
    },
  });
  const failed =
    status === "denied" || status === "unavailable" || status === "error";

  return (
    <DashboardPanel className={cn("gap-4 p-4 sm:p-6", enterMotion)}>
      <StepHeading headingRef={headingRef}>
        {failed ? cameraProblem(status).title : copy.camera.heading}
      </StepHeading>
      {failed ? (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-start gap-3 rounded-dashboard-lg bg-dashboard-bg-inset p-4">
            <CameraOff
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-dashboard-text-warning"
            />
            <p className="m-0 text-base text-dashboard-text-medium">
              {cameraProblem(status).body}
            </p>
          </div>
          {status !== "unavailable" && (
            <DashboardButton variant="outline" className="h-11" onClick={retry}>
              {copy.camera.retry}
            </DashboardButton>
          )}
        </div>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-dashboard-lg bg-dashboard-text-heavy">
            <video
              ref={videoRef}
              aria-label={copy.camera.label}
              muted
              playsInline
              className="size-full object-cover"
            />
            {/* Aiming frame */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[14%] rounded-dashboard-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(11,43,74,0.35)]"
            />
            <p className="absolute inset-x-0 bottom-3 m-0 flex items-center justify-center gap-2 text-sm font-semibold text-white">
              <ScanLine
                aria-hidden
                className="size-4 motion-safe:animate-pulse"
              />
              {status === "scanning"
                ? copy.camera.scanning
                : copy.camera.starting}
            </p>
          </div>
        </>
      )}
    </DashboardPanel>
  );
}

function cameraProblem(status: QrScannerStatus) {
  if (status === "denied") return copy.camera.denied;
  if (status === "unavailable") return copy.camera.unavailable;
  return copy.camera.error;
}

function OfferStep({
  sponsor,
  userId,
  repName,
  onRepName,
  headingRef,
  announce,
  onFocusHeading,
  onSent,
  onScanNext,
}: {
  sponsor: string;
  userId: string;
  repName: string;
  onRepName: (name: string) => void;
  headingRef: HeadingRef;
  announce: (message: string) => void;
  onFocusHeading: () => void;
  onSent: (offer: CoffeeChatOffer) => void;
  onScanNext: () => void;
}) {
  const hackerQ = api.coffeeChatRequests.hacker.useQuery(
    { sponsor, userId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const timesQ = api.coffeeChatRequests.freeTimes.useQuery(
    { sponsor, userId },
    { enabled: hackerQ.isSuccess, retry: false, refetchOnWindowFocus: false },
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const offer = api.coffeeChatRequests.offer.useMutation({
    onSuccess: onSent,
    onError: (error) => {
      const code = error.data?.code;
      // Capacity and window problems carry copy from src/content/coffee-chat.
      const message =
        code === "CONFLICT" || code === "BAD_REQUEST"
          ? error.message
          : copy.card.offerError;
      setOfferError(message);
      announce(message);
      // A seat may have just gone: show what's still open.
      void timesQ.refetch();
    },
  });

  // Once the lookup settles, say what happened and move focus to it.
  const settled = hackerQ.isError || (hackerQ.isSuccess && !timesQ.isLoading);
  const announced = useRef(false);
  useEffect(() => {
    if (!settled || announced.current) return;
    announced.current = true;
    if (hackerQ.isError) {
      announce(copy.notHacker.title);
    } else if (hackerQ.data) {
      const count = timesQ.data?.times.length ?? 0;
      announce(
        count > 0
          ? copy.card.heading(hackerQ.data.firstName)
          : copy.card.noTimes.title,
      );
    }
    onFocusHeading();
  }, [
    settled,
    hackerQ.isError,
    hackerQ.data,
    timesQ.data,
    announce,
    onFocusHeading,
  ]);

  if (!settled) {
    return (
      <DashboardPanel className="items-center gap-3 py-10 text-center">
        <div
          aria-hidden
          className="size-8 rounded-full border-2 border-dashboard-bg-nav border-t-dashboard-action-primary motion-safe:animate-spin"
        />
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.lookingUp}
        </p>
      </DashboardPanel>
    );
  }

  if (hackerQ.isError || !hackerQ.data) {
    const notHacker = hackerQ.error?.data?.code === "NOT_FOUND";
    return (
      <DashboardPanel className={cn("gap-4", enterMotion)}>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-inset">
            <UserX aria-hidden className="size-5 text-dashboard-text-warning" />
          </span>
          <StepHeading headingRef={headingRef}>
            {notHacker ? copy.notHacker.title : copy.camera.error.title}
          </StepHeading>
        </div>
        <p className="m-0 text-base text-dashboard-text-medium">
          {notHacker
            ? copy.notHacker.body
            : (hackerQ.error?.message ?? copy.card.offerError)}
        </p>
        <DashboardButton className="md:w-full" onClick={onScanNext}>
          <ScanLine aria-hidden />
          {copy.scanNext}
        </DashboardButton>
      </DashboardPanel>
    );
  }

  const hacker = hackerQ.data;
  const free = timesQ.data;
  const times = free?.times ?? [];
  // Earliest open time is picked unless the sponsor chose another that's
  // still open.
  const slot =
    times.find((t) => t.slotTime === picked)?.slotTime ?? times[0]?.slotTime;

  return (
    <DashboardPanel className={cn("gap-5", enterMotion)}>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
          <Coffee aria-hidden className="size-4" strokeWidth={1.67} />
          {copy.card.eyebrow}
        </span>
        <StepHeading headingRef={headingRef}>
          {times.length > 0 || timesQ.isError
            ? copy.card.heading(hacker.firstName)
            : copy.card.noTimes.title}
        </StepHeading>
        {free && (
          <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dashboard-text-medium">
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="size-4 text-dashboard-text-light" />
              {copy.card.timesHint(free.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin
                aria-hidden
                className="size-4 text-dashboard-text-light"
              />
              {free.room ? copy.card.room(free.room) : copy.card.roomTbd}
            </span>
          </p>
        )}
      </div>

      {timesQ.isError ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-4 text-base text-dashboard-text-medium">
          {copy.card.timesError}
        </p>
      ) : times.length === 0 ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-4 text-base text-dashboard-text-medium">
          {copy.card.noTimes.body(hacker.firstName)}
        </p>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!slot || offer.isPending) return;
            setOfferError(null);
            offer.mutate({
              sponsor,
              userId: hacker.userId,
              slotTime: slot,
              repName: repName.trim() || undefined,
            });
          }}
        >
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-heavy">
              {copy.card.timesLegend}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {times.map((t) => {
                const checked = t.slotTime === slot;
                return (
                  <label
                    key={t.slotTime}
                    className={cn(
                      "flex min-h-11 cursor-pixel-hover flex-col justify-center rounded-dashboard-lg border px-3 py-2 transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dashboard-action-primary has-[:focus-visible]:ring-offset-2",
                      checked
                        ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                        : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-heavy hover:bg-dashboard-bg-highlight",
                    )}
                  >
                    <input
                      type="radio"
                      name="slot"
                      value={t.slotTime}
                      checked={checked}
                      onChange={() => setPicked(t.slotTime)}
                      className="sr-only"
                    />
                    <span className="text-base font-semibold">
                      {formatClock(t.slotTime)}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        checked
                          ? "text-dashboard-text-inverse/90"
                          : "text-dashboard-text-light",
                      )}
                    >
                      {copy.card.seatsLeft(t.seatsLeft)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="rep-name"
              className="text-sm font-semibold text-dashboard-text-heavy"
            >
              {copy.card.repLabel}
            </label>
            <input
              id="rep-name"
              type="text"
              autoComplete="name"
              maxLength={255}
              value={repName}
              onChange={(event) => onRepName(event.target.value)}
              aria-describedby="rep-name-hint"
              className="h-11 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
            />
            <p
              id="rep-name-hint"
              className="m-0 text-sm text-dashboard-text-light"
            >
              {copy.card.repHint}
            </p>
          </div>

          {offerError && (
            <p className="m-0 rounded-dashboard-lg border border-dashboard-border-muted bg-dashboard-bg-inset p-3 text-sm font-semibold text-dashboard-text-warning">
              {offerError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
            <DashboardButton
              type="submit"
              disabled={!slot}
              aria-disabled={offer.isPending || undefined}
              className="md:h-11"
            >
              {offer.isPending ? copy.card.offering : copy.card.offer}
            </DashboardButton>
            <DashboardButton
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={onScanNext}
            >
              {copy.cancel}
            </DashboardButton>
          </div>
        </form>
      )}

      {(times.length === 0 || timesQ.isError) && (
        <DashboardButton className="md:w-full" onClick={onScanNext}>
          <ScanLine aria-hidden />
          {copy.scanNext}
        </DashboardButton>
      )}
    </DashboardPanel>
  );
}

function SentPanel({
  sponsor,
  offer,
  headingRef,
  onScanNext,
}: {
  sponsor: string;
  offer: CoffeeChatOffer;
  headingRef: HeadingRef;
  onScanNext: () => void;
}) {
  return (
    <DashboardPanel className={cn("gap-4", enterMotion)}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight">
          <CircleCheck
            aria-hidden
            className="size-6 text-dashboard-status-live"
          />
        </span>
        <StepHeading headingRef={headingRef}>{copy.sent.title}</StepHeading>
      </div>
      <p className="m-0 text-lg font-semibold text-dashboard-text-heavy">
        {copy.sent.body(
          offer.firstName,
          formatClock(offer.slotTime),
          offer.room,
        )}
      </p>
      <p className="m-0 text-base text-dashboard-text-medium">
        {copy.sent.next}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <DashboardButton className="md:h-11" onClick={onScanNext}>
          <ScanLine aria-hidden />
          {copy.scanNext}
        </DashboardButton>
        <DashboardButton
          variant="outline"
          asChild
          className="h-11 w-full sm:w-auto"
        >
          <Link href={`/sponsors/${sponsor}/coffee-chats`}>
            {copy.sent.viewChats}
          </Link>
        </DashboardButton>
      </div>
    </DashboardPanel>
  );
}
