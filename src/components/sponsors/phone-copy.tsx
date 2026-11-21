import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { hover, press } from "~/components/internals/interaction";
import { phoneCopyText as copy } from "~/content/phone-copy";
import { cn } from "~/lib/utils";

/** "5195550101" -> "(519) 555-0101"; anything else as typed. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : phone.trim();
}

/** A tel: href for a typed phone number (North American when 10 digits). */
export function telHref(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return `tel:${d.length === 10 ? `+1${d}` : `+${d}`}`;
}

/**
 * A phone number (tap to call) with a copy icon beside it (44px target),
 * which shows a check for a moment once copied. `name` is whose number it
 * is, for the screen reader labels.
 */
export function PhoneCopy({
  name,
  phone,
  className,
}: {
  name: string;
  phone: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const shown = formatPhone(phone);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <a
        href={telHref(phone)}
        aria-label={copy.call(name, shown)}
        className="inline-flex min-h-11 items-center whitespace-nowrap rounded-dashboard-md tabular-nums text-dashboard-text-heavy underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:underline"
      >
        {shown}
      </a>
      <button
        type="button"
        aria-label={copied ? copy.copied(name) : copy.copy(name)}
        title={copied ? copy.copiedShort : undefined}
        onClick={() => {
          const done = () => setCopied(true);
          void navigator.clipboard?.writeText(shown).then(done, done);
        }}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
          hover.highlight,
          hover.textHeavy,
          press,
        )}
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-dashboard-status-live" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? copy.copied(name) : ""}
      </span>
    </span>
  );
}
