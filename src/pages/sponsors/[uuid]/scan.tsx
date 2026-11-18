import { useRouter } from "next/router";
import { BadgeScanner } from "~/components/sponsors/badge-scanner";
import {
  InvalidLink,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorScanCopy as copy } from "~/content/sponsor-scan";
import { badgeCodeOf } from "~/lib/use-qr-scanner";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

// Sponsor badge scanner: scan a hacker's badge or /live QR, then offer them
// a coffee chat at an open start time. The hacker accepts on /live.
// ?hacker=<user id> (the candidates list's Offer coffee chat button) skips
// the camera and opens the offer for that hacker.
export default function SponsorScanPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const hacker =
    typeof router.query.hacker === "string"
      ? badgeCodeOf(router.query.hacker)
      : null;

  // Only to tell a wrong link apart early; per-hacker times load after a scan.
  const sponsorQ = api.coffeeChatRequests.freeTimes.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: false, refetchOnWindowFocus: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell
      title={copy.seoTitle}
      backHref={validUuid ? `/sponsors/${id}` : undefined}
    >
      {children}
    </SponsorShell>
  );

  if (!router.isReady) return shell(<ScheduleSkeleton />);
  if (!validUuid || sponsorQ.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }

  return shell(
    <>
      <PageIntro eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <BadgeScanner key={hacker ?? ""} sponsor={id} initialCode={hacker} />
    </>,
  );
}
