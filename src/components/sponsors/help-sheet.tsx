import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  helpContactStorageKey,
  helpLocationNoteSchema,
  helpPhoneSchema,
  helpRepNameSchema,
  SPONSOR_HELP_LOCATION_NOTE_MAX,
  SPONSOR_HELP_NOTE_MAX,
  SPONSOR_HELP_PHONE_MAX,
  SPONSOR_HELP_REASONS,
  SPONSOR_HELP_REP_NAME_MAX,
  type SponsorHelpReason,
} from "~/lib/sponsor-help";
import { cn } from "~/lib/utils";

const copy = sponsorHelpCopy.sheet;

export type HelpSheetValues = {
  reason: SponsorHelpReason;
  note: string;
  repName: string;
  phone: string;
  locationNote: string;
};

type ErrorKey = keyof typeof copy.errors;

/** The first rule a field breaks, as a key into copy.errors, or null. */
function fieldError(
  schema:
    | typeof helpRepNameSchema
    | typeof helpPhoneSchema
    | typeof helpLocationNoteSchema,
  value: string,
): ErrorKey | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  const key = result.error.issues[0]?.message;
  return key && key in copy.errors ? (key as ErrorKey) : null;
}

// Rep name and phone are remembered per sponsor on this device, so the next
// ping is quick. Storage can be blocked (private mode), so never throw.
function readContact(sponsor: string): { repName: string; phone: string } {
  try {
    const raw = window.localStorage.getItem(helpContactStorageKey(sponsor));
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      repName: typeof parsed.repName === "string" ? parsed.repName : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { repName: "", phone: "" };
  }
}

function rememberContact(
  sponsor: string,
  contact: { repName: string; phone: string },
) {
  try {
    window.localStorage.setItem(
      helpContactStorageKey(sponsor),
      JSON.stringify({
        repName: contact.repName.trim(),
        phone: contact.phone.trim(),
      }),
    );
  } catch {
    // Storage blocked: they type it again next time.
  }
}

const inputClass =
  "min-h-11 w-full rounded-dashboard-lg border bg-dashboard-bg-surface px-3 py-2.5 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";
const labelClass = "text-sm font-semibold text-dashboard-text-light";

function borderFor(error: ErrorKey | null) {
  return error
    ? "border-dashboard-text-warning"
    : "border-dashboard-border-control";
}

// The "Need help" sheet: pick a quick reason, add an optional note, send.
// Bottom sheet on phones, centered dialog on wider screens. Radix Dialog
// traps focus, closes on Escape and returns focus to the trigger.
export function HelpSheet({
  sponsor,
  boothLocation,
  open,
  onOpenChange,
  onSubmit,
  sending,
  error,
}: {
  sponsor: string;
  /** Booth from the sponsor sheet, shown as the location placeholder. */
  boothLocation?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: HelpSheetValues) => void;
  sending: boolean;
  error: string | null;
}) {
  const [reason, setReason] = useState<SponsorHelpReason | null>(null);
  const [note, setNote] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [tried, setTried] = useState(false);
  const noteId = useId();
  const hintId = useId();
  const reasonErrorId = useId();
  const repId = useId();
  const repErrorId = useId();
  const phoneId = useId();
  const phoneHintId = useId();
  const phoneErrorId = useId();
  const whereId = useId();
  const whereErrorId = useId();

  // Prefill from this device once the sheet opens (client only, so no
  // hydration mismatch). Never overwrite what they already typed.
  useEffect(() => {
    if (!open) return;
    const saved = readContact(sponsor);
    setRepName((v) => (v !== "" ? v : saved.repName));
    setPhone((v) => (v !== "" ? v : saved.phone));
  }, [open, sponsor]);

  const repError = tried ? fieldError(helpRepNameSchema, repName) : null;
  const phoneError = tried ? fieldError(helpPhoneSchema, phone) : null;
  const whereError = tried
    ? fieldError(helpLocationNoteSchema, locationNote)
    : null;
  const reasonMissing = tried && !reason;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    const invalid = [
      fieldError(helpRepNameSchema, repName),
      fieldError(helpPhoneSchema, phone),
      fieldError(helpLocationNoteSchema, locationNote),
    ].some((e) => e !== null);
    if (!reason || invalid) {
      return;
    }
    rememberContact(sponsor, { repName, phone });
    onSubmit({ reason, note, repName, phone, locationNote });
  };

  const booth =
    boothLocation && boothLocation.trim() !== "" && boothLocation !== "TBD"
      ? boothLocation.trim()
      : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col gap-5 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dashboard-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="m-0 text-xl font-semibold">
                {copy.title}
              </Dialog.Title>
              <Dialog.Description className="m-0 text-base text-dashboard-text-medium">
                {copy.description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={copy.close}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <fieldset
              className="m-0 flex flex-col gap-2 border-0 p-0"
              role="radiogroup"
              aria-invalid={reasonMissing || undefined}
              aria-describedby={reasonMissing ? reasonErrorId : undefined}
            >
              <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-light">
                {copy.reasonLegend}
              </legend>
              {SPONSOR_HELP_REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-11 cursor-pixel-hover items-center gap-3 rounded-dashboard-lg border px-4 py-2.5 text-base transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dashboard-action-primary has-[:focus-visible]:ring-offset-2",
                    reason === r
                      ? "border-dashboard-action-primary bg-dashboard-bg-highlight"
                      : "border-dashboard-border-default bg-dashboard-bg-surface hover:bg-dashboard-bg-highlightSubtle",
                  )}
                >
                  <input
                    type="radio"
                    name="help-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-dashboard-action-primary"
                  />
                  {sponsorHelpCopy.reasons[r]}
                </label>
              ))}
              {reasonMissing && (
                <p
                  id={reasonErrorId}
                  role="alert"
                  className="m-0 text-sm text-dashboard-text-warning"
                >
                  {copy.pickReason}
                </p>
              )}
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-light">
                {copy.contactLegend}
              </legend>

              <div className="flex flex-col gap-2">
                <label htmlFor={repId} className={labelClass}>
                  {copy.repNameLabel}
                </label>
                <input
                  id={repId}
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={repName}
                  maxLength={SPONSOR_HELP_REP_NAME_MAX}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder={copy.repNamePlaceholder}
                  aria-invalid={repError ? true : undefined}
                  aria-describedby={repError ? repErrorId : undefined}
                  className={cn(inputClass, borderFor(repError))}
                />
                {repError && (
                  <p
                    id={repErrorId}
                    className="m-0 text-sm text-dashboard-text-warning"
                  >
                    {copy.errors[repError]}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={phoneId} className={labelClass}>
                  {copy.phoneLabel}
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  maxLength={SPONSOR_HELP_PHONE_MAX}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={copy.phonePlaceholder}
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={
                    phoneError ? `${phoneErrorId} ${phoneHintId}` : phoneHintId
                  }
                  className={cn(inputClass, borderFor(phoneError))}
                />
                {phoneError && (
                  <p
                    id={phoneErrorId}
                    className="m-0 text-sm text-dashboard-text-warning"
                  >
                    {copy.errors[phoneError]}
                  </p>
                )}
                <p
                  id={phoneHintId}
                  className="m-0 text-xs text-dashboard-text-light"
                >
                  {copy.phoneHint} {copy.remembered}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={whereId} className={labelClass}>
                  {copy.locationNoteLabel}
                </label>
                <input
                  id={whereId}
                  type="text"
                  value={locationNote}
                  maxLength={SPONSOR_HELP_LOCATION_NOTE_MAX}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder={booth ?? copy.locationNoteFallback}
                  aria-invalid={whereError ? true : undefined}
                  aria-describedby={whereError ? whereErrorId : undefined}
                  className={cn(inputClass, borderFor(whereError))}
                />
                {whereError && (
                  <p
                    id={whereErrorId}
                    className="m-0 text-sm text-dashboard-text-warning"
                  >
                    {copy.errors[whereError]}
                  </p>
                )}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={noteId}
                  className="text-sm font-semibold text-dashboard-text-light"
                >
                  {copy.noteLabel}
                </label>
                <span id={hintId} className="text-xs text-dashboard-text-light">
                  {copy.noteCount(note.length, SPONSOR_HELP_NOTE_MAX)}
                </span>
              </div>
              <textarea
                id={noteId}
                aria-describedby={hintId}
                value={note}
                maxLength={SPONSOR_HELP_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.notePlaceholder}
                rows={3}
                className="w-full resize-none rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 py-2.5 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="m-0 text-sm text-dashboard-text-warning"
              >
                {error}
              </p>
            )}

            <DashboardButton
              type="submit"
              disabled={sending}
              className="md:h-11 md:w-full"
            >
              {sending ? copy.sending : copy.submit}
            </DashboardButton>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
