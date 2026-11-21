import { Coffee } from "lucide-react";
import Link from "next/link";
import { btn, card } from "~/components/sponsors/portal-ui";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";

const copy = sponsorSetupCopy.noChatsPage;

/**
 * Chats or Scan opened by a sponsor without coffee chats (decisions
 * 2026-11-20): one short line instead of the forms.
 */
export function NoChats({ homeHref }: { homeHref: string }) {
  return (
    <section className={cn(card, "items-start gap-3")}>
      <h2 className="m-0 flex items-center gap-2 text-xl font-semibold">
        <Coffee
          aria-hidden
          className="size-5 shrink-0 text-dashboard-text-light"
        />
        {copy.title}
      </h2>
      <p className="m-0 text-base text-dashboard-text-medium">{copy.body}</p>
      <Link href={homeHref} className={btn.outline}>
        {copy.home}
      </Link>
    </section>
  );
}
