import { useEffect, useState } from "react";
import { Check, Copy, Phone } from "lucide-react";
import { useHelpContacts } from "~/components/sponsors/help-button";
import { formatPhone } from "~/components/sponsors/phone-copy";
import { btn, card, CardTitle } from "~/components/sponsors/portal-ui";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { sponsorHomeCopy } from "~/content/sponsor-home";
import { cn } from "~/lib/utils";

const copy = sponsorHomeCopy.contacts;

/**
 * Home's Contacts card (mock sponsor-chats-v3): the sponsor's HW lead
 * (Sponsor Day-Of + HW Contacts) and the emergency contact (Noah, HW
 * Contacts), each with an icon button that copies the number (no Call:
 * Jazz, 2026-11-20). Same people as the Help dialog.
 */
export function ContactsCard({ sponsor }: { sponsor: string }) {
  const { loading, failed, lead, emergency } = useHelpContacts(sponsor);
  const missing = sponsorHelpCopy.contacts;
  return (
    <section aria-labelledby="contacts-heading" className={card}>
      <CardTitle id="contacts-heading" icon={<Phone aria-hidden />}>
        {copy.title}
      </CardTitle>
      {loading ? (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.loading}</p>
      ) : (
        <div className="flex flex-col">
          <ContactLine
            label={copy.pointOfContact}
            name={lead?.name ?? null}
            phone={lead?.phone ?? null}
            missingName={failed ? missing.loadFailed : missing.noLead}
            missingPhone={missing.noPhone}
          />
          <ContactLine
            label={copy.emergency}
            name={emergency?.name ?? null}
            phone={emergency?.phone ?? null}
            missingName={missing.noEmergency}
            missingPhone={missing.noPhone}
          />
        </div>
      )}
    </section>
  );
}

function ContactLine({
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
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const shown = phone ? formatPhone(phone) : null;
  return (
    <div className="flex flex-col gap-0.5 border-t border-dashboard-border-subtle py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <p className="m-0 text-xs font-bold uppercase tracking-wide text-dashboard-text-light">
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <p className="m-0 flex min-w-0 flex-1 flex-col leading-snug md:flex-row md:items-baseline md:gap-2.5">
          <b className="break-words font-semibold">{name ?? missingName}</b>
          {name && (
            <span className="text-sm tabular-nums text-dashboard-text-medium md:text-base">
              {shown ?? missingPhone}
            </span>
          )}
        </p>
        {name && phone && shown && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              aria-label={copied ? copy.copiedLabel(name) : copy.copyLabel(name, shown)}
              onClick={() => {
                const done = () => setCopied(true);
                void navigator.clipboard?.writeText(shown).then(done, done);
              }}
              title={copied ? copy.copied : copy.copy}
              className={cn(btn.outline, "size-11 px-0 [&_svg]:size-[18px]")}
            >
              {copied ? (
                <Check aria-hidden className="text-dashboard-status-live" />
              ) : (
                <Copy aria-hidden />
              )}
            </button>
          </div>
        )}
      </div>
      <span role="status" className="sr-only">
        {copied && name ? copy.copiedLabel(name) : ""}
      </span>
    </div>
  );
}
