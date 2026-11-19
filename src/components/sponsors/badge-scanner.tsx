import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CameraOff,
  Check,
  CircleCheck,
  Clock,
  Coffee,
  MapPin,
  ScanLine,
  UserX,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { hoverTint, pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { sponsorScanCopy } from "~/content/sponsor-scan";
import { formatClock } from "~/lib/run-of-show";
import {
  badgeCodeOf,
  typedBadgeCodeOf,
  useQrScanner,
  type QrScannerStatus,
} from "~/lib/use-qr-scanner";
import { cn } from "~/lib/utils";
import type { CoffeeChatOffer } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

const copy = sponsorScanCopy;

type Phase =
  | { kind: "scan" }
  | { kind: "hacker"; code: string }
  | { kind: "notHacker" }
  | { kind: "sent"; offer: CoffeeChatOffer };

const enterMotion =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200";

/**
 * One persistent live region. Each message is cleared first, so the same
 * message twice in a row is still read out.
 */
function useAnnouncer() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const announce = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage("");
    timer.current = setTimeout(() => setMessage(next), 100);
  }, []);
  return { message, announce };
}

// Scan a hacker's badge, wallet pass or /live QR (or type their hacker
// code), then offer them a coffee chat at one of the sponsor's open times.
// `initialCode` (a hacker code or user id, e.g. from the candidates list)
// skips the camera and opens the offer card for that hacker.
export function BadgeScanner({
  sponsor,
  initialCode,
  preferredTime = null,
}: {
  sponsor: string;
  initialCode?: string | null;
  /** Start time to preselect when it's open (e.g. a room hold's). */
  preferredTime?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    initialCode ? { kind: "hacker", code: initialCode } : { kind: "scan" },
  );
  const { message, announce } = useAnnouncer();
  // The sponsor's own name sticks between scans.
  const [repName, setRepName] = useState("");
  // Each step's heading takes focus so keyboard and screen reader users
  // land on the new content.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusKey, setFocusKey] = useState(0);
  useEffect(() => {
    if (focusKey > 0) headingRef.current?.focus();
  }, [focusKey]);
  const focusHeading = useCallback(() => setFocusKey((k) => k + 1), []);

  const go = (next: Phase, text?: string) => {
    setPhase(next);
    if (text) announce(text);
    focusHeading();
  };
  // The camera panel announces its own status.
  const scanNext = () => go({ kind: "scan" });
  const lookUp = (code: string | null) =>
    code
      ? go({ kind: "hacker", code }, copy.lookingUp)
      : go({ kind: "notHacker" }, copy.notHacker.title);

  return (
    <div data-tour="scan-camera" className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {message}
      </p>
      {phase.kind === "scan" && (
        <CameraPanel
          headingRef={headingRef}
          announce={announce}
          onFocusHeading={focusHeading}
          onScan={(text) => lookUp(badgeCodeOf(text))}
          onTyped={(text) => lookUp(typedBadgeCodeOf(text))}
        />
      )}
      {phase.kind === "notHacker" && (
        <NotHackerPanel headingRef={headingRef} onScanNext={scanNext} />
      )}
      {phase.kind === "hacker" && (
        <OfferStep
          key={phase.code}
          sponsor={sponsor}
          code={phase.code}
          preferredTime={preferredTime}
          repName={repName}
          onRepName={setRepName}
          headingRef={headingRef}
          announce={announce}
          onFocusHeading={focusHeading}
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
  announce,
  onFocusHeading,
  onScan,
  onTyped,
}: {
  headingRef: HeadingRef;
  announce: (message: string) => void;
  onFocusHeading: () => void;
  onScan: (text: string) => void;
  onTyped: (text: string) => void;
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

  // Say what the camera is doing; on failure, also move focus to the
  // heading that explains it.
  useEffect(() => {
    if (status === "starting") announce(copy.camera.starting);
    else if (status === "scanning") announce(copy.camera.scanning);
    else if (failed) {
      const problem = cameraProblem(status);
      announce(`${problem.title}. ${problem.body}`);
      onFocusHeading();
    }
  }, [status, failed, announce, onFocusHeading]);

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
            <DashboardButton
              variant="outline"
              className={cn("h-11", pressable)}
              onClick={retry}
            >
              {copy.camera.retry}
            </DashboardButton>
          )}
        </div>
      ) : (
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
            className="pointer-events-none absolute inset-[14%] rounded-dashboard-lg border-2 border-dashboard-text-inverse/80"
          />
          <p
            aria-hidden
            className="absolute inset-x-0 bottom-3 m-0 flex items-center justify-center gap-2 text-sm font-semibold text-dashboard-text-inverse"
          >
            <ScanLine
              aria-hidden
              className="size-4 motion-safe:animate-pulse"
            />
            {status === "scanning"
              ? copy.camera.scanning
              : copy.camera.starting}
          </p>
        </div>
      )}
      <ManualEntry onSubmit={onTyped} />
    </DashboardPanel>
  );
}

/** The no-camera path: type the hacker code from their badge or pass. */
function ManualEntry({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [empty, setEmpty] = useState(false);
  return (
    <form
      className="flex flex-col gap-1.5 border-t border-dashboard-border-subtle pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) {
          setEmpty(true);
          return;
        }
        onSubmit(value);
      }}
    >
      <label
        htmlFor="hacker-code"
        className="text-sm font-semibold text-dashboard-text-heavy"
      >
        {copy.manual.label}
      </label>
      <p
        id="hacker-code-hint"
        className="m-0 text-sm text-dashboard-text-light"
      >
        {copy.manual.hint}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="hacker-code"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={255}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setEmpty(false);
          }}
          aria-describedby={
            empty ? "hacker-code-hint hacker-code-error" : "hacker-code-hint"
          }
          aria-invalid={empty || undefined}
          className="h-11 w-full min-w-0 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary sm:flex-1"
        />
        <DashboardButton
          type="submit"
          variant="outline"
          className={cn("h-11 w-full sm:w-auto", pressable)}
        >
          {copy.manual.submit}
        </DashboardButton>
      </div>
      {empty && (
        <p
          id="hacker-code-error"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {copy.manual.empty}
        </p>
      )}
    </form>
  );
}

function cameraProblem(status: QrScannerStatus) {
  if (status === "denied") return copy.camera.denied;
  if (status === "unavailable") return copy.camera.unavailable;
  return copy.camera.error;
}

function NotHackerPanel({
  headingRef,
  title = copy.notHacker.title,
  body = copy.notHacker.body,
  onScanNext,
}: {
  headingRef: HeadingRef;
  title?: string;
  body?: string;
  onScanNext: () => void;
}) {
  return (
    <DashboardPanel className={cn("gap-4", enterMotion)}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-inset">
          <UserX aria-hidden className="size-5 text-dashboard-text-warning" />
        </span>
        <StepHeading headingRef={headingRef}>{title}</StepHeading>
      </div>
      <p className="m-0 text-base text-dashboard-text-medium">{body}</p>
      <DashboardButton
        className={cn("md:w-full", pressable)}
        onClick={onScanNext}
      >
        <ScanLine aria-hidden />
        {copy.scanNext}
      </DashboardButton>
    </DashboardPanel>
  );
}

function OfferStep({
  sponsor,
  code,
  preferredTime,
  repName,
  onRepName,
  headingRef,
  announce,
  onFocusHeading,
  onSent,
  onScanNext,
}: {
  sponsor: string;
  code: string;
  preferredTime: string | null;
  repName: string;
  onRepName: (name: string) => void;
  headingRef: HeadingRef;
  announce: (message: string) => void;
  onFocusHeading: () => void;
  onSent: (offer: CoffeeChatOffer) => void;
  onScanNext: () => void;
}) {
  const hackerQ = api.coffeeChatRequests.hackerByCode.useQuery(
    { sponsor, code },
    { retry: false, refetchOnWindowFocus: false },
  );
  const timesQ = api.coffeeChatRequests.freeTimes.useQuery(
    { sponsor, userId: hackerQ.data?.userId },
    { enabled: hackerQ.isSuccess, retry: false, refetchOnWindowFocus: false },
  );
  const [picked, setPicked] = useState<string | null>(preferredTime);
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
      <NotHackerPanel
        headingRef={headingRef}
        title={notHacker ? copy.notHacker.title : copy.camera.error.title}
        body={
          notHacker
            ? copy.notHacker.body
            : (hackerQ.error?.message ?? copy.card.offerError)
        }
        onScanNext={onScanNext}
      />
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
      <div className="flex items-start gap-3">
        {/* GitHub photo only when they shared their profile (links is
            null otherwise). */}
        <HackerAvatar
          name={hacker.firstName}
          github={hacker.links?.github}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
            <Coffee aria-hidden className="size-4" strokeWidth={1.67} />
            {copy.card.eyebrow}
          </span>
          <StepHeading headingRef={headingRef}>
            {times.length > 0 || timesQ.isError
              ? copy.card.heading(hacker.firstName)
              : sponsorSetupCopy.scan.heading(hacker.firstName)}
          </StepHeading>
          {free && (
            <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dashboard-text-medium">
              <span className="inline-flex items-center gap-1.5">
                <Clock
                  aria-hidden
                  className="size-4 text-dashboard-text-light"
                />
                {copy.card.timesHint(free.durationMinutes)}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Every scan can go on Met at Hacker Fair: invited first. */}
      <MetAtFair
        sponsor={sponsor}
        userId={hacker.userId}
        firstName={hacker.firstName}
        repName={repName}
        onRepName={onRepName}
        announce={announce}
      />

      {timesQ.isError ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-4 text-base text-dashboard-text-medium">
          {copy.card.timesError}
        </p>
      ) : times.length === 0 ? null : (
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
                      "flex min-h-11 cursor-pointer flex-col justify-center rounded-dashboard-lg border px-3 py-2",
                      pressable,
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dashboard-action-primary has-[:focus-visible]:ring-offset-2",
                      checked
                        ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                        : cn(
                            "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-heavy",
                            hoverTint,
                          ),
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
                    <span className="flex items-center gap-1.5 text-base font-semibold">
                      {checked && (
                        <Check aria-hidden className="size-4 shrink-0" />
                      )}
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
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        checked
                          ? "text-dashboard-text-inverse/90"
                          : "text-dashboard-text-light",
                      )}
                    >
                      <MapPin aria-hidden className="size-3 shrink-0" />
                      {t.room ? copy.card.room(t.room) : copy.card.roomTbd}
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
              className={cn("md:h-11", pressable)}
            >
              {offer.isPending ? copy.card.offering : copy.card.offer}
            </DashboardButton>
            <DashboardButton
              type="button"
              variant="outline"
              className={cn("h-11 w-full sm:w-auto", pressable)}
              onClick={onScanNext}
            >
              {copy.cancel}
            </DashboardButton>
          </div>
        </form>
      )}

      {(times.length === 0 || timesQ.isError) && (
        <DashboardButton
          className={cn("md:w-full", pressable)}
          onClick={onScanNext}
        >
          <ScanLine aria-hidden />
          {copy.scanNext}
        </DashboardButton>
      )}
    </DashboardPanel>
  );
}

/**
 * "Met at Hacker Fair": pick which rep wants to talk to them (from Your
 * team), then record the scan (sponsor_scan) so they're invited first.
 */
function MetAtFair({
  sponsor,
  userId,
  firstName,
  repName,
  onRepName,
  announce,
}: {
  sponsor: string;
  userId: string;
  firstName: string;
  repName: string;
  onRepName: (name: string) => void;
  announce: (message: string) => void;
}) {
  const metCopy = sponsorSetupCopy.scan;
  const setupQ = api.coffeeChatSetup.get.useQuery(
    { sponsor },
    { retry: false, refetchOnWindowFocus: false },
  );
  const record = api.coffeeChatSetup.recordScan.useMutation({
    onSuccess: () => announce(metCopy.added(firstName)),
    onError: () => announce(metCopy.error),
  });
  const reps = setupQ.data?.reps ?? [];
  const chip = (on: boolean) =>
    cn(
      "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
      on
        ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
        : cn("border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium", hoverTint),
      pressable,
    );
  if (record.isSuccess) {
    return (
      <p className="m-0 flex items-start gap-2 rounded-dashboard-lg bg-dashboard-bg-highlight p-4 text-base font-semibold text-dashboard-text-heavy">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-dashboard-status-live" />
        {metCopy.added(firstName)}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-inset p-4">
      {reps.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-heavy">
            {metCopy.metLegend}
          </legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={repName === ""} className={chip(repName === "")} onClick={() => onRepName("")}>
              {metCopy.noRep}
            </button>
            {reps.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={repName === r.name}
                className={chip(repName === r.name)}
                onClick={() => onRepName(r.name)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <DashboardButton
        className={cn("md:h-11", pressable)}
        aria-disabled={record.isPending || undefined}
        onClick={() => {
          if (record.isPending) return;
          record.mutate({ sponsor, userId, repName: repName.trim() || undefined });
        }}
      >
        {record.isPending ? metCopy.adding : metCopy.add}
      </DashboardButton>
      {record.isError && (
        <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {metCopy.error}
        </p>
      )}
    </div>
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
        <DashboardButton
          className={cn("md:h-11", pressable)}
          onClick={onScanNext}
        >
          <ScanLine aria-hidden />
          {copy.scanNext}
        </DashboardButton>
        <DashboardButton
          variant="outline"
          asChild
          className={cn("h-11 w-full sm:w-auto", pressable)}
        >
          <Link href={`/sponsors/${sponsor}/coffee-chats`}>
            {copy.sent.viewChats}
          </Link>
        </DashboardButton>
      </div>
    </DashboardPanel>
  );
}
