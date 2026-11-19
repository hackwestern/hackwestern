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

  // ?time=HH:MM (a room hold's "Scan a badge") preselects that start time
  // when it's still open; otherwise the earliest open one is picked.
  const time =
    typeof router.query.time === "string" &&
    /^\d{2}:\d{2}$/.test(router.query.time)
      ? router.query.time
      : null;

  // Only to tell a wrong link apart early; per-hacker times load after a scan.
  const sponsorQ = api.coffeeChatRequests.freeTimes.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: false, refetchOnWindowFocus: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.seoTitle}>{children}</SponsorShell>
  );

  if (!router.isReady) return shell(<ScheduleSkeleton />);
  if (!validUuid || sponsorQ.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={hacker ? copy.offerTitle : copy.title}
        intro={hacker ? copy.offerIntro : copy.intro}
      />
      <BadgeScanner
        key={hacker ?? ""}
        sponsor={id}
        initialCode={hacker}
        preferredTime={time}
      />
    </>,
  );
}
