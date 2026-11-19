import { createContext, useContext, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LifeBuoy, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { PhoneCopy } from "~/components/sponsors/phone-copy";
import {
  hoverTint,
  pressable,
} from "~/components/sponsors/sponsor-shell-styles";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy;

type HelpState = { open: () => void };

const HelpContext = createContext<HelpState | null>(null);

/**
 * The sponsor portal's Help (decisions 2026-11-19, Q1–Q11 and "Tracked
 * sponsor help removed everywhere"): a "Need help?" button that opens their
 * HW lead's name and phone, and Noah as the emergency contact, each phone
 * with a copy icon. No message form, no Slack, no tracking. The shell mounts
 * this once; `SponsorHelp` views (side nav, page card on phones) open it.
 * The tracked request flow (help-sheet.tsx, help-status.tsx, the
 * sponsorHelp request/status routes) is kept in the repo, unused.
 */
export function SponsorHelpProvider({
  sponsor,
  children,
}: {
  sponsor: string;
  /** Unused since the tracked help flow was switched off. */
  boothLocation?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <HelpContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <HelpContacts sponsor={sponsor} open={open} onOpenChange={setOpen} />
    </HelpContext.Provider>
  );
}

/**
 * The sponsor's HW lead and the emergency contact, read at runtime (lead
 * from getSponsorPortalInfo, emergency from sponsorHelp.contacts); nothing
 * here is in the repo. Shared by the Help dialog and the portal home.
 */
export function useHelpContacts(sponsor: string) {
  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor },
    { enabled: !!sponsor, refetchOnWindowFocus: false, retry: false },
  );
  const contacts = api.sponsorHelp.contacts.useQuery(
    { sponsor },
    { enabled: !!sponsor, refetchOnWindowFocus: false, retry: 1 },
  );
  const leadName =
    info.data?.hwContact && info.data.hwContact !== "—"
      ? info.data.hwContact
      : null;
  return {
    loading: info.isLoading || contacts.isLoading,
    lead: leadName
      ? { name: leadName, phone: info.data?.hwContactPhone ?? null }
      : null,
    emergency: contacts.data?.emergency ?? null,
  };
}

/** One person: label, name, and their phone with a copy icon. */
export function ContactRow({
  label,
  name,
  phone,
  missingName,
  missingPhone,
}: {
  label: string;
  name: string | null;
  phone: string | null;
  missingName: string;
  missingPhone: string;
}) {
  return (
    <div
      data-contact={label}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashboard-border-subtle py-3 first:border-t-0"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-dashboard-text-light">
          {label}
        </span>
        <span className="break-words text-base font-semibold text-dashboard-text-heavy">
          {name ?? missingName}
        </span>
      </div>
      {name &&
        (phone ? (
          <PhoneCopy name={name} phone={phone} className="-mr-2" />
        ) : (
          <span className="text-sm text-dashboard-text-light">
            {missingPhone}
          </span>
        ))}
    </div>
  );
}

function HelpContacts({
  sponsor,
  open,
  onOpenChange,
}: {
  sponsor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = copy.contacts;
  const { loading, lead, emergency } = useHelpContacts(sponsor);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[440px] sm:rounded-dashboard-2xl sm:pb-6",
            "data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
            "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
            "sm:data-[state=closed]:duration-150 sm:data-[state=open]:duration-200 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-2 sm:data-[state=open]:slide-in-from-bottom-2",
            "motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="m-0 text-xl font-semibold">
                {c.title}
              </Dialog.Title>
              <Dialog.Description className="m-0 text-base text-dashboard-text-medium">
                {c.description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={c.close}
              className={cn(
                "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                hoverTint,
                pressable,
              )}
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {loading ? (
            <p className="m-0 text-sm text-dashboard-text-light">{c.loading}</p>
          ) : (
            <div className="flex flex-col">
              <ContactRow
                label={c.lead}
                name={lead?.name ?? null}
                phone={lead?.phone ?? null}
                missingName={c.noLead}
                missingPhone={c.noPhone}
              />
              <ContactRow
                label={c.emergency}
                name={emergency?.name ?? null}
                phone={emergency?.phone ?? null}
                missingName={c.noPhone}
                missingPhone={c.noPhone}
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// "Need help?" on a sponsor page. `variant="nav"` is the side nav's quiet
// version. Both open the one Help dialog from SponsorHelpProvider.
export function SponsorHelp({
  variant = "card",
}: {
  variant?: "card" | "nav";
}) {
  const help = useContext(HelpContext);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!help) return null;
  const nav = variant === "nav";
  return (
    <div data-tour="need-help" className="flex flex-col gap-2">
      {nav ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={help.open}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-left text-sm font-semibold text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
            hoverTint,
            pressable,
          )}
        >
          <LifeBuoy
            aria-hidden
            className="size-4 shrink-0 text-dashboard-action-primary"
          />
          {copy.button}
        </button>
      ) : (
        <>
          <DashboardButton
            ref={triggerRef}
            variant="outline"
            className={cn(
              "h-12 w-full rounded-dashboard-lg text-base font-semibold [&_svg]:size-5 [&_svg]:text-dashboard-action-primary",
              pressable,
            )}
            onClick={help.open}
            aria-haspopup="dialog"
          >
            <LifeBuoy aria-hidden />
            {copy.button}
          </DashboardButton>
          <p className="m-0 text-center text-sm text-dashboard-text-light">
            {copy.buttonHint}
          </p>
        </>
      )}
    </div>
  );
}
