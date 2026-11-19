import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraOff,
  Check,
  CircleCheck,
  Coffee,
  ScanLine,
  UserX,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { hoverTint, pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { sponsorScanCopy } from "~/content/sponsor-scan";
import { whenEastern } from "~/components/sponsors/coffee-setup/shared";
import {
  badgeCodeOf,
  typedBadgeCodeOf,
  useQrScanner,
  type QrScannerStatus,
} from "~/lib/use-qr-scanner";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorScanCopy;

type Phase =
  | { kind: "scan" }
  | { kind: "hacker"; code: string }
  | { kind: "notHacker" };

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
// code), then add them to "Met at your booth" so they're invited first.
// `initialCode` (a hacker code or user id) skips the camera and opens the
// card for that hacker.
export function BadgeScanner({
  sponsor,
  initialCode,
}: {
  sponsor: string;
  initialCode?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    initialCode ? { kind: "hacker", code: initialCode } : { kind: "scan" },
  );
  const { message, announce } = useAnnouncer();
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
        <HackerStep
          key={phase.code}
          sponsor={sponsor}
          code={phase.code}
          headingRef={headingRef}
          announce={announce}
          onFocusHeading={focusHeading}
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
      // The focused heading names the problem; announce only what to do,
      // so "No camera found" is said once.
      announce(cameraProblem(status).body);
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

/**
 * The hacker card does one job: add them to "Met at your booth" (invited
 * first), with an optional "Who talked to them?" rep. "Add to my list" is
 * the only filled button; "Scan next" shows once they're added. Seats come
 * from the invite rounds, so nothing is booked here.
 */
function HackerStep({
  sponsor,
  code,
  headingRef,
  announce,
  onFocusHeading,
  onScanNext,
}: {
  sponsor: string;
  code: string;
  headingRef: HeadingRef;
  announce: (message: string) => void;
  onFocusHeading: () => void;
  onScanNext: () => void;
}) {
  const metCopy = sponsorSetupCopy.scan;
  const hackerQ = api.coffeeChatRequests.hackerByCode.useQuery(
    { sponsor, code },
    { retry: false, refetchOnWindowFocus: false },
  );
  const userId = hackerQ.data?.userId;
  const scanQ = api.coffeeChatSetup.scanOf.useQuery(
    { sponsor, userId: userId ?? "" },
    { enabled: !!userId, retry: false, refetchOnWindowFocus: false },
  );
  const setupQ = api.coffeeChatSetup.get.useQuery(
    { sponsor },
    { retry: false, refetchOnWindowFocus: false },
  );
  const utils = api.useUtils();
  // A rep from Your team, by id (the server looks up the name); null = Anyone.
  const [repId, setRepId] = useState<string | null>(null);
  const record = api.coffeeChatSetup.recordScan.useMutation({
    onSuccess: () => {
      if (hackerQ.data) announce(metCopy.added(hackerQ.data.firstName));
      void utils.coffeeChatSetup.get.invalidate({ sponsor });
      void utils.coffeeChatSetup.scanOf.invalidate({ sponsor });
      onFocusHeading();
    },
    onError: () => announce(metCopy.error),
  });

  // Once the lookup settles, say what happened and move focus to it.
  const settled = hackerQ.isError || (hackerQ.isSuccess && !scanQ.isLoading);
  const announced = useRef(false);
  useEffect(() => {
    if (!settled || announced.current) return;
    announced.current = true;
    if (hackerQ.isError) announce(copy.notHacker.title);
    else if (hackerQ.data) announce(metCopy.heading(hackerQ.data.firstName));
    onFocusHeading();
  }, [settled, hackerQ.isError, hackerQ.data, announce, onFocusHeading, metCopy]);

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
        body={notHacker ? copy.notHacker.body : copy.card.lookupError}
        onScanNext={onScanNext}
      />
    );
  }

  const hacker = hackerQ.data;
  const reps = setupQ.data?.reps ?? [];
  const already = scanQ.data ?? null;
  const chip = (on: boolean) =>
    cn(
      "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
      // Picked: tinted, not filled, so "Add to my list" stays the one
      // filled button on the card.
      on
        ? "inline-flex items-center gap-1.5 border-2 border-dashboard-action-primary bg-dashboard-bg-highlight text-dashboard-text-active"
        : cn(
            "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium",
            hoverTint,
          ),
      pressable,
    );
  const tick = (on: boolean) =>
    on ? <Check aria-hidden className="size-4 shrink-0" /> : null;

  if (record.isSuccess) {
    return (
      <DashboardPanel className={cn("gap-4", enterMotion)}>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight">
            <CircleCheck
              aria-hidden
              className="size-6 text-dashboard-status-live"
            />
          </span>
          <StepHeading headingRef={headingRef}>
            {metCopy.added(hacker.firstName)}
          </StepHeading>
        </div>
        <TextButton onClick={onScanNext}>
          <ScanLine aria-hidden className="size-5" />
          {copy.scanNext}
        </TextButton>
      </DashboardPanel>
    );
  }

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
            {metCopy.heading(hacker.firstName)}
          </StepHeading>
          {already && (
            <p className="m-0 text-base font-semibold text-dashboard-text-heavy">
              {metCopy.already(
                whenEastern(already.scannedAt),
                already.repName,
              )}
            </p>
          )}
        </div>
      </div>

      {reps.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-heavy">
            {metCopy.metLegend}
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={repId === null}
              className={chip(repId === null)}
              onClick={() => setRepId(null)}
            >
              {tick(repId === null)}
              {metCopy.noRep}
            </button>
            {reps.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={repId === r.id}
                className={chip(repId === r.id)}
                onClick={() => setRepId(r.id)}
              >
                {tick(repId === r.id)}
                {r.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {record.isError && (
        <p
          role="alert"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {metCopy.error}
        </p>
      )}

      <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-4">
        <DashboardButton
          className={cn("h-12 text-base md:h-12", pressable)}
          aria-disabled={record.isPending || undefined}
          onClick={() => {
            if (record.isPending) return;
            record.mutate({ sponsor, userId: hacker.userId, repId });
          }}
        >
          {record.isPending
            ? metCopy.adding
            : already
              ? metCopy.save
              : metCopy.add}
        </DashboardButton>
        <TextButton onClick={onScanNext}>{copy.cancel}</TextButton>
      </div>
    </DashboardPanel>
  );
}

/** A plain text button: the secondary action next to the one filled button. */
function TextButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 w-fit items-center justify-center gap-2 self-center rounded-dashboard-md px-2 text-base font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary sm:self-auto [@media(hover:hover)]:hover:underline",
        pressable,
      )}
    >
      {children}
    </button>
  );
}
