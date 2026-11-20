import { useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Camera, Check, Copy, Phone } from "lucide-react";
import { toast } from "sonner";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { firstNameOf } from "~/lib/coffee-chat-board-view";
import { badgeCodeOf, typedBadgeCodeOf, useQrScanner } from "~/lib/use-qr-scanner";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { dangerButton, focusRing, formatPhone } from "./parts";

const copy = coffeeSessionsCopy;
const wc = copy.warn;
const lc = copy.line;
const why = copy.hackers.why;

/* The live SendConfirm look (Radix AlertDialog, 448px). Esc cancels and Tab stays inside. */
const overlay = "fixed inset-0 z-[62] bg-dashboard-text-heavy/30";
const box =
  "fixed left-1/2 top-1/2 z-[63] flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree text-dashboard-text-heavy shadow-dashboard-card focus:outline-none";
const title = "m-0 text-xl font-bold leading-snug";
const para = "m-0 text-base text-dashboard-text-medium";
const lead = "m-0 text-base font-semibold text-dashboard-text-heavy";
/** Side by side from 640px (primary on the right), stacked on phones. */
const acts = "flex flex-col gap-2 sm:flex-row-reverse";
const actBtn = "min-h-11 sm:w-auto sm:px-5";
const outlineBtn = "h-11 sm:w-auto sm:px-5";

/**
 * A warning before a change that tells hackers ("This chat is confirmed."):
 * a red primary button, and Cancel has focus.
 */
export function ConfirmDialog({
  open,
  heading,
  paras,
  ok,
  onOk,
  onClose,
}: {
  open: boolean;
  heading: string;
  paras: string[];
  ok: string;
  onOk: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content
          className={box}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <AlertDialog.Title className={title}>{heading}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="flex flex-col gap-1.5">
              {paras.map((p, i) => (
                <p key={i} className={i === 0 && paras.length > 1 ? lead : para}>{p}</p>
              ))}
            </div>
          </AlertDialog.Description>
          <div className={acts}>
            <AlertDialog.Action asChild>
              <DashboardButton variant="primary" className={cn(actBtn, dangerButton)} onClick={onOk}>
                {ok}
              </DashboardButton>
            </AlertDialog.Action>
            <AlertDialog.Cancel asChild>
              <DashboardButton ref={cancelRef} variant="outline" className={outlineBtn}>
                {wc.cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** "(519) 555-0101" as a tel: link (+1 for a 10-digit number). */
function telOf(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return `tel:${d.length === 10 ? `+1${d}` : d}`;
}

/**
 * Moving a chat to a session the rep didn't tick takes two steps in one
 * dialog (mock v11). Step 1: contact the rep (phone, copy, Call); it can't
 * move the chat. Step 2: did they confirm? Only Yes moves it (red, and it's
 * marked "Not free"); No and Cancel keep it where it is.
 */
export function MoveCheckDialog({
  open,
  rep,
  session,
  sentLine,
  onYes,
  onClose,
}: {
  open: boolean;
  rep: { name: string; phone: string };
  /** "2–3" */
  session: string;
  /** For a sent chat: "4 hackers in 4 chats will be asked to confirm …". */
  sentLine: string | null;
  onYes: () => void;
  onClose: () => void;
}) {
  const c = wc.check;
  const [step, setStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) {
      setStep(1);
      setCopied(false);
    }
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  // Step 2's safe answer has focus.
  useEffect(() => {
    if (open && step === 2) keepRef.current?.focus();
  }, [open, step]);
  const who = firstNameOf(rep.name);
  const shown = rep.phone ? formatPhone(rep.phone) : "";
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content
          className={box}
          data-step={step}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <AlertDialog.Title className={title}>{c.title(rep.name, session)}</AlertDialog.Title>
          {step === 1 ? (
            <>
              <AlertDialog.Description asChild>
                <div className="flex flex-col gap-1.5">
                  <p className={para}>{`${c.notFree(session)} ${c.contact(who)}`}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-dashboard-md bg-dashboard-bg-inset py-1.5 pl-3 pr-1.5">
                    <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-snug">
                      <b className="text-[15px] font-semibold [overflow-wrap:anywhere]">{rep.name}</b>
                      {shown && <span className="text-[17px] font-semibold tabular-nums text-dashboard-text-heavy">{shown}</span>}
                    </span>
                    {shown && (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={copied ? copy.phone.copiedLabel(shown) : copy.phone.copyLabel(rep.name, shown)}
                          onClick={() => {
                            const done = () => setCopied(true);
                            void navigator.clipboard?.writeText(shown).then(done, done);
                          }}
                          className={cn(
                            "inline-flex h-11 min-w-11 cursor-pixel-hover items-center justify-center gap-1 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-2 text-[13px] font-semibold",
                            copied ? "text-dashboard-status-live" : "text-dashboard-text-medium",
                            focusRing,
                          )}
                        >
                          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                          {copied && copy.phone.copied}
                        </button>
                        <DashboardButton asChild variant="small" className="min-h-11 px-3.5 text-[15px] text-dashboard-text-link md:min-h-11">
                          <a href={telOf(rep.phone)} aria-label={c.callLabel(rep.name, shown)}>
                            <Phone aria-hidden />
                            {c.call}
                          </a>
                        </DashboardButton>
                      </span>
                    )}
                  </div>
                </div>
              </AlertDialog.Description>
              <div className={acts}>
                <DashboardButton variant="primary" className={actBtn} onClick={() => setStep(2)}>
                  {c.contacted(who)}
                </DashboardButton>
                <AlertDialog.Cancel asChild>
                  <DashboardButton ref={cancelRef} variant="outline" className={outlineBtn}>
                    {wc.cancel}
                  </DashboardButton>
                </AlertDialog.Cancel>
              </div>
            </>
          ) : (
            <>
              <AlertDialog.Description asChild>
                <div className="flex flex-col gap-1.5">
                  <p className={lead}>{c.ask(who, session)}</p>
                  {sentLine && <p className={para}>{sentLine}</p>}
                </div>
              </AlertDialog.Description>
              <div className="flex flex-col gap-2">
                <AlertDialog.Action asChild>
                  <DashboardButton variant="primary" className={cn("min-h-11 md:w-full", dangerButton)} onClick={onYes}>
                    {sentLine ? c.yesTell : c.yes}
                  </DashboardButton>
                </AlertDialog.Action>
                <AlertDialog.Cancel asChild>
                  <DashboardButton ref={keepRef} variant="outline" className="h-11 w-full">
                    {c.no}
                  </DashboardButton>
                </AlertDialog.Cancel>
                <AlertDialog.Cancel asChild>
                  <DashboardButton variant="outline" className="h-11 w-full">
                    {wc.cancel}
                  </DashboardButton>
                </AlertDialog.Cancel>
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

type HackerCheck =
  | { state: "empty" }
  | { state: "checking" }
  | { state: "ok"; code: string; name: string }
  | { state: "error"; message: string };

/**
 * A typed or scanned hacker ID, checked on the server for this sponsor (and
 * with `chatId`, free at that chat's time): their name, or why not.
 */
function useHackerCheck(sponsorId: string, raw: string, chatId?: string): HackerCheck {
  const typed = typedBadgeCodeOf(raw);
  const [code, setCode] = useState<string | null>(typed);
  // Check once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setCode(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const q = api.coffeeChatInvites.checkHacker.useQuery(
    { sponsorId, code: code ?? "", chatId },
    { enabled: !!code, retry: false, staleTime: 5_000 },
  );
  if (!typed) return { state: "empty" };
  if (code !== typed || q.isFetching || !q.data) {
    return q.error && code === typed ? { state: "error", message: q.error.message } : { state: "checking" };
  }
  return q.data.ok ? { state: "ok", code: typed, name: q.data.name } : { state: "error", message: q.data.error };
}

/** The ID field with a camera button (scan a badge) and a live line under it. */
function HackerIdPicker({
  value,
  onChange,
  check,
  okLine,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  check: HackerCheck;
  okLine: (name: string) => string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const { videoRef, status } = useQrScanner({
    active: scanning,
    onResult: (text) => {
      setScanning(false);
      const code = badgeCodeOf(text);
      if (code) {
        setScanErr(null);
        onChange(code);
      } else setScanErr(lc.camera.notCode);
    },
  });
  const camLine =
    status === "starting" ? lc.camera.starting
    : status === "scanning" ? lc.camera.scanning
    : status === "denied" ? lc.camera.denied
    : status === "unavailable" ? lc.camera.unavailable
    : status === "error" ? lc.camera.error
    : null;
  const out =
    scanErr ??
    (check.state === "ok" ? okLine(check.name)
    : check.state === "error" ? check.message
    : check.state === "checking" ? lc.checking
    : "");
  const bad = !!scanErr || check.state === "error";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={scanning ? lc.stopScan : lc.scanLabel}
          aria-pressed={scanning}
          onClick={() => {
            setScanErr(null);
            setScanning((s) => !s);
          }}
          className={cn(
            "inline-flex size-11 flex-none cursor-pixel-hover items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
            scanning && "bg-dashboard-bg-highlight",
            focusRing,
          )}
        >
          <Camera aria-hidden className="size-4" />
        </button>
        <label htmlFor="coffee-hacker-id" className="sr-only">{lc.idLabel}</label>
        <input
          id="coffee-hacker-id"
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setScanErr(null);
            onChange(e.target.value);
          }}
          placeholder={lc.idPlaceholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            "min-h-11 min-w-0 flex-auto rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2.5 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder",
            focusRing,
          )}
        />
      </div>
      {scanning && (
        <div className="flex flex-col gap-1">
          <div className="overflow-hidden rounded-dashboard-md bg-dashboard-text-heavy">
            <video ref={videoRef} aria-label={lc.camera.label} muted playsInline className="aspect-video w-full object-cover" />
          </div>
          {camLine && <p className="m-0 text-sm text-dashboard-text-medium">{camLine}</p>}
        </div>
      )}
      {!scanning && camLine && status !== "idle" && <p className="m-0 text-sm text-dashboard-text-warning">{camLine}</p>}
      <p aria-live="polite" className={cn("m-0 min-h-[1.5em] text-[15px] font-semibold", bad ? "text-dashboard-text-warning" : "text-dashboard-text-heavy")}>
        {out}
      </p>
    </div>
  );
}

const useLineRefresh = () => {
  const utils = api.useUtils();
  return () =>
    Promise.all([
      utils.coffeeChatInvites.status.invalidate(),
      utils.coffeeChatInvites.line.invalidate(),
      utils.coffeeChatInvites.checkHacker.invalidate(),
    ]);
};

/**
 * Remove a hacker from a sent chat: they're told it's cancelled, and the
 * seat goes to the next person in line who can take it, or to someone
 * picked by ID ("Added by organizer"). Same chat, same seat, Waiting.
 */
export function RemoveHackerDialog({
  target,
  onClose,
}: {
  target: { sponsorId: string; chatId: string; name: string } | null;
  onClose: () => void;
}) {
  const open = !!target;
  const sponsorId = target?.sponsorId ?? "";
  const chatId = target?.chatId ?? "";
  const line = api.coffeeChatInvites.line.useQuery({ sponsorId, chatId }, { enabled: open });
  const next = line.data?.next ?? null;
  const [mode, setMode] = useState<"next" | "other">("next");
  const [raw, setRaw] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) setRaw("");
  }, [open, chatId]);
  // Nobody can take the seat from the line: "Someone else" is picked.
  useEffect(() => {
    if (open && line.data) setMode(line.data.next ? "next" : "other");
  }, [open, line.data]);
  const check = useHackerCheck(sponsorId, mode === "other" ? raw : "", chatId || undefined);
  const refresh = useLineRefresh();
  const replace = api.coffeeChatInvites.replace.useMutation({
    onSuccess: (r) => {
      toast.success(lc.toastReplaced(r.removed, r.invited));
      onClose();
    },
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  });
  const name = target?.name ?? "";
  const pickName = mode === "next" ? next?.name : check.state === "ok" ? check.name : undefined;
  const radio = (on: boolean, disabled?: boolean) =>
    cn(
      "flex min-h-11 items-start gap-2.5 rounded-dashboard-md border px-3 py-2.5 text-[15px] text-dashboard-text-heavy",
      on ? "border-dashboard-action-primary bg-dashboard-bg-highlight" : "border-dashboard-border-default",
      disabled ? "cursor-not-allowed text-dashboard-text-disabled" : "cursor-pixel-hover",
    );
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content
          className={box}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <AlertDialog.Title className={title}>{lc.removeTitle(name)}</AlertDialog.Title>
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Description className={para}>{lc.removeLine(name)}</AlertDialog.Description>
            <fieldset className="m-0 mt-1.5 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-base font-bold text-dashboard-text-heavy">{lc.whoGets}</legend>
              <label className={radio(mode === "next" && !!next, !next)}>
                <input
                  type="radio"
                  name="coffee-seat-who"
                  value="next"
                  checked={mode === "next" && !!next}
                  disabled={!next}
                  onChange={() => setMode("next")}
                  className="mt-0.5 size-[18px] flex-none accent-dashboard-action-primary"
                />
                <span>
                  {line.isLoading ? lc.checking : next ? lc.next(next.name, why[next.source] ?? next.source) : lc.nextNone}
                </span>
              </label>
              <label className={radio(mode === "other")}>
                <input
                  type="radio"
                  name="coffee-seat-who"
                  value="other"
                  checked={mode === "other"}
                  onChange={() => setMode("other")}
                  className="mt-0.5 size-[18px] flex-none accent-dashboard-action-primary"
                />
                <span>{lc.other}</span>
              </label>
              <HackerIdPicker
                value={raw}
                onChange={(v) => {
                  setRaw(v);
                  // Typing an ID picks "Someone else".
                  if (v.trim()) setMode("other");
                }}
                check={check}
                okLine={lc.front}
              />
            </fieldset>
          </div>
          <div className={acts}>
            <DashboardButton
              variant="primary"
              className={cn(actBtn, dangerButton)}
              disabled={!pickName || replace.isPending}
              onClick={() => {
                if (!target || !pickName) return;
                replace.mutate({
                  chatId: target.chatId,
                  pick: mode === "next" ? { kind: "next" } : { kind: "code", code: check.state === "ok" ? check.code : "" },
                });
              }}
            >
              {pickName ? lc.removeGo(pickName) : lc.removeGoEmpty}
            </DashboardButton>
            <AlertDialog.Cancel asChild>
              <DashboardButton ref={cancelRef} variant="outline" className={outlineBtn}>
                {lc.cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Put a hacker first in a sponsor's line: they get its next free seat. */
export function FrontDialog({ sponsorId, onClose }: { sponsorId: string | null; onClose: () => void }) {
  const open = !!sponsorId;
  const [raw, setRaw] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setRaw("");
  }, [open]);
  const check = useHackerCheck(sponsorId ?? "", raw);
  const refresh = useLineRefresh();
  const putFirst = api.coffeeChatInvites.putFirst.useMutation({
    onSuccess: (r) => {
      toast.success(lc.toastFront(r.name));
      onClose();
    },
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  });
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content
          className={box}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <AlertDialog.Title className={title}>{lc.addTitle}</AlertDialog.Title>
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Description className={para}>{lc.addHint}</AlertDialog.Description>
            <HackerIdPicker value={raw} onChange={setRaw} check={check} okLine={lc.addLine} inputRef={inputRef} />
          </div>
          <div className={acts}>
            <DashboardButton
              variant="primary"
              className={actBtn}
              disabled={check.state !== "ok" || putFirst.isPending}
              onClick={() => {
                if (sponsorId && check.state === "ok") putFirst.mutate({ sponsorId, code: check.code });
              }}
            >
              {lc.addGo}
            </DashboardButton>
            <AlertDialog.Cancel asChild>
              <DashboardButton variant="outline" className={outlineBtn}>
                {lc.cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
