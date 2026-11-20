import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorHomeCopy } from "~/content/sponsor-home";
import { cn } from "~/lib/utils";

const copy = sponsorHomeCopy.welcome;

/** Read or write one localStorage value; blocked storage never throws. */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered on this device.
  }
}

/**
 * Welcome variant A (mock sponsor-chats-v3): a small warm card under the
 * greeting with the horse, "Welcome to Hack Western 13!" and a thank-you
 * for their tier (Sponsor Day-Of's Tier column). The × closes it for good
 * on this device (localStorage, per sponsor).
 */
export function WelcomeCard({
  sponsor,
  tier,
}: {
  sponsor: string;
  tier: string | null;
}) {
  const key = `hw-sponsor-welcome-closed:${sponsor}`;
  // Unknown until read on the client, so a closed card never flashes in.
  const [closed, setClosed] = useState<boolean | null>(null);
  useEffect(() => setClosed(readStored(key) === "1"), [key]);
  if (closed !== false) return null;
  return (
    <section
      aria-labelledby="welcome-heading"
      className="flex min-w-0 items-center gap-3 rounded-dashboard-2xl border border-dashboard-notice-welcomeBorder bg-dashboard-notice-welcomeBg py-2.5 pl-3.5 pr-1.5"
    >
      <Image
        src="/shared/horse.svg"
        alt=""
        width={22}
        height={32}
        className="mt-[3px] shrink-0 self-start"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <h2 id="welcome-heading" className="m-0 text-base font-bold leading-snug">
          {copy.title}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.thanks(tier)}
        </p>
      </div>
      <button
        type="button"
        aria-label={copy.close}
        title={copy.closeTitle}
        onClick={() => {
          writeStored(key, "1");
          setClosed(true);
        }}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center self-start rounded-dashboard-md text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-notice-cautionBg",
          pressable,
        )}
      >
        <X aria-hidden className="size-[18px]" />
      </button>
    </section>
  );
}
