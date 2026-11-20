import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Check, Hash, Plus, ScanLine, UserX } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { btn, card } from "~/components/sponsors/portal-ui";
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
  // The mock's two cards: the camera (with "Enter a hacker code instead"),
  // or the typed code (with "Use the camera").
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(true);
  const { videoRef, status, retry } = useQrScanner({
    active: active && !typing,
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
    if (typing) return;
    if (status === "starting") announce(copy.camera.starting);
    else if (status === "scanning") announce(copy.camera.scanning);
    else if (failed) {
      // The focused heading names the problem; announce only what to do,
      // so "No camera found" is said once.
      announce(cameraProblem(status).body);
      onFocusHeading();
    }
  }, [status, failed, typing, announce, onFocusHeading]);

  if (typing || failed) {
    return (
      <section className={cn(card, "gap-3.5", enterMotion)}>
        <StepHeading headingRef={headingRef}>
          {failed && !typing ? cameraProblem(status).title : copy.manual.heading}
        </StepHeading>
        {failed && !typing && (
          <div className="flex items-start gap-3 rounded-dashboard-lg bg-dashboard-bg-inset p-4">
            <CameraOff aria-hidden className="mt-0.5 size-5 shrink-0 text-dashboard-text-warning" />
            <p className="m-0 text-base text-dashboard-text-medium">{cameraProblem(status).body}</p>
          </div>
        )}
        <ManualEntry onSubmit={onTyped} />
        {(typing || status !== "unavailable") && (
          <button
            type="button"
            className={cn(btn.link, "self-start")}
            onClick={() => {
              setTyping(false);
              if (failed) retry();
            }}
          >
            <ScanLine aria-hidden />
            {failed && !typing ? copy.camera.retry : copy.manual.useCamera}
          </button>
        )}
      </section>
    );
  }

  return (
    <section aria-label={copy.camera.label} className={cn(card, "gap-3.5", enterMotion)}>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {copy.camera.heading}
      </h2>
      <div className="relative w-full overflow-hidden rounded-dashboard-lg bg-dashboard-text-heavy max-md:aspect-square md:h-[300px]">
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
          className="pointer-events-none absolute inset-x-[14%] top-[14%] bottom-[22%] rounded-dashboard-2xl border-2 border-dashboard-text-inverse/80 md:inset-x-[23%]"
        />
        <p
          aria-hidden
          className="absolute inset-x-0 bottom-3 m-0 flex items-center justify-center gap-2 text-sm font-medium text-dashboard-text-inverse"
        >
          {status === "scanning" ? copy.camera.heading : copy.camera.starting}
        </p>
      </div>
      <button type="button" className={cn(btn.link, "self-start")} onClick={() => setTyping(true)}>
        <Hash aria-hidden />
        {copy.manual.open}
      </button>
    </section>
  );
}

/** The no-camera path: type the hacker code from their badge or pass. */
function ManualEntry({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [empty, setEmpty] = useState(false);
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) {
          setEmpty(true);
          return;
        }
        onSubmit(value);
      }}
    >
      <label htmlFor="hacker-code" className="text-sm font-semibold text-dashboard-text-heavy">
        {copy.manual.label}
      </label>
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
        aria-describedby={empty ? "hacker-code-hint hacker-code-error" : "hacker-code-hint"}
        aria-invalid={empty || undefined}
        className="h-11 w-full min-w-0 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
      />
      <p id="hacker-code-hint" className="m-0 text-[13px] text-dashboard-text-light">
        {copy.manual.hint}
      </p>
      {empty && (
        <p id="hacker-code-error" className="m-0 text-sm font-semibold text-dashboard-notice-danger">
          {copy.manual.empty}
        </p>
      )}
      <button type="submit" className={cn(btn.primary, "mt-2 w-full")}>
        {copy.manual.submit}
      </button>
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
  // Scanned before: start from the rep already credited, not "Anyone".
  const creditedRep = scanQ.data?.repName ?? null;
  const repList = setupQ.data?.reps;
  // Once only: a later refetch must not put back the rep they just changed.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !creditedRep || !repList) return;
    preselected.current = true;
    const match = repList.find((r) => r.name === creditedRep);
    if (match) setRepId(match.id);
  }, [creditedRep, repList]);
  // The first save adds them (announce it, focus the new heading); later
  // saves only change "Who talked to them?" and leave focus on the pick.
  const firstSave = useRef(true);
  const record = api.coffeeChatSetup.recordScan.useMutation({
    onSuccess: () => {
      void utils.coffeeChatSetup.get.invalidate({ sponsor });
      void utils.coffeeChatSetup.scanOf.invalidate({ sponsor });
      if (!firstSave.current) return;
      firstSave.current = false;
      preselected.current = true;
      if (hackerQ.data) announce(metCopy.added(hackerQ.data.firstName));
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
  const live = !!setupQ.data?.confirmed;
  const already = scanQ.data ?? null;
  const added = record.isSuccess;
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  const who = (
    <div className="flex min-w-0 items-center gap-3">
      {/* GitHub photo only when they shared their profile (links is null
          otherwise). */}
      <HackerAvatar name={hacker.firstName} github={hacker.links?.github} size="lg" />
      <div className="flex min-w-0 flex-col">
        <b className="break-words text-lg">{hacker.firstName}</b>
        <span className="text-sm tabular-nums text-dashboard-text-light">{code}</span>
      </div>
    </div>
  );

  if (!added) {
    return (
      <section aria-labelledby="scan-found" className={cn(card, "gap-4", enterMotion)}>
        <h2 id="scan-found" ref={headingRef} tabIndex={-1} className="sr-only">
          {metCopy.heading(hacker.firstName)}
        </h2>
        {who}
        {already && (
          <p className="m-0 text-sm font-semibold">{metCopy.already(whenEastern(already.scannedAt), already.repName)}</p>
        )}
        {record.isError && (
          <p role="alert" className="m-0 text-sm font-semibold text-dashboard-notice-danger">
            {metCopy.error}
          </p>
        )}
        <button
          type="button"
          className={cn(btn.primary, btn.lg, "w-full")}
          aria-disabled={record.isPending || undefined}
          onClick={() => {
            if (record.isPending) return;
            record.mutate({ sponsor, userId: hacker.userId, repId });
          }}
        >
          <Plus aria-hidden />
          {record.isPending ? metCopy.adding : metCopy.add}
        </button>
        <button type="button" className={cn(btn.link, "self-start")} onClick={onScanNext}>
          {copy.notThem}
        </button>
      </section>
    );
  }

  return (
    <section aria-live="polite" className={cn(card, "gap-3.5", enterMotion)}>
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-dashboard-action-primary text-dashboard-text-inverse">
          <Check aria-hidden className="size-6" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <StepHeading headingRef={headingRef}>{metCopy.onList(hacker.firstName)}</StepHeading>
        </div>
      </div>
      <p className="m-0 text-sm">{live ? metCopy.invitedFirstLive : metCopy.invitedFirst}</p>
      {reps.length > 0 && (
        <div role="group" aria-labelledby="scan-who" className="flex flex-col gap-2 border-t border-dashboard-border-subtle pt-3.5">
          <h3 id="scan-who" className="m-0 text-base font-semibold">
            {metCopy.metLegend} <span className="font-medium text-dashboard-text-light">{metCopy.optional}</span>
          </h3>
          <div className="flex flex-col gap-2">
            {reps.map((r) => {
              const on = repId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  disabled={record.isPending}
                  onClick={() => {
                    const next = on ? null : r.id;
                    setRepId(next);
                    record.mutate({ sponsor, userId: hacker.userId, repId: next });
                  }}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-dashboard-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    on
                      ? "border-2 border-dashboard-action-primary bg-dashboard-bg-highlight"
                      : cn("border-dashboard-border-control bg-dashboard-bg-surface", hoverTint),
                    pressable,
                  )}
                >
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-inset text-xs font-bold text-dashboard-text-medium">
                    {initials(r.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-semibold">{r.name}</b>
                    <span className="text-[13px] text-dashboard-text-medium">
                      {metCopy.chatWith(r.name.split(/\s+/)[0] ?? r.name)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                      on ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse" : "border-dashboard-border-control",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button type="button" className={cn(btn.primary, "w-full")} onClick={onScanNext}>
        <ScanLine aria-hidden />
        {copy.scanNext}
      </button>
    </section>
  );
}
