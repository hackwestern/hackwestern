import { useRouter } from "next/router";
import { BadgeScanner } from "~/components/sponsors/badge-scanner";
import {
  InvalidLink,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorScanCopy as copy } from "~/content/sponsor-scan";
import { badgeCodeOf } from "~/lib/use-qr-scanner";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

// Sponsor badge scanner: scan a hacker's badge or /live QR, then add them
// to "Met at your booth" so they're invited to a coffee chat first.
// ?hacker=<code or user id> skips the camera and opens that hacker's card.
export default function SponsorScanPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const hacker =
    typeof router.query.hacker === "string"
      ? badgeCodeOf(router.query.hacker)
      : null;

  // Only to tell a wrong link apart early (and it warms the rep list).
  const sponsorQ = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: false, refetchOnWindowFocus: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.seoTitle} heading={hacker ? copy.offerTitle : copy.title}>
      {children}
    </SponsorShell>
  );

  if (!router.isReady) return shell(<ScheduleSkeleton />);
  if (!validUuid || sponsorQ.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }

  return shell(
    <>
      {/* The intro stays on phones too: it says what scanning does. */}
      <p className="m-0 max-w-[62ch] text-base text-dashboard-text-medium">
        {hacker ? copy.offerIntro : copy.intro}
      </p>
      <BadgeScanner
        key={hacker ?? ""}
        sponsor={id}
        initialCode={hacker}
      />
    </>,
  );
}
