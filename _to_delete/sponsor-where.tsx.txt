import { useState } from "react";
import { useRouter } from "next/router";
import { CompanyLocationsView } from "~/components/sponsors/company-locations";
import { DayPicker } from "~/components/sponsors/day-picker";
import {
  InvalidLink,
  LoadError,
  PageIntro,
  ReadAt,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { useNow } from "~/components/sponsors/use-now";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = scheduleCopy.where;

// "Where is everyone": every sponsor's workshops, coffee chat room and the
// Sponsor Bay, from the run-of-show sheet. Refreshes every minute.
export default function WhereIsEveryonePage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);

  const opts = { enabled: validUuid, refetchInterval: 60_000, retry: 1 };
  const q = api.sponsorSchedule.companies.useQuery({ sponsor: id }, opts);
  // Only used to mark "You"; both reads share the server's 60s sheet cache.
  const me = api.sponsorSchedule.get.useQuery({ sponsor: id }, opts);

  const shell = (children: React.ReactNode) => (
    <SponsorShell
      title={copy.seoTitle}
      backHref={validUuid ? `/sponsors/${id}` : undefined}
    >
      {children}
    </SponsorShell>
  );

  if (!router.isReady || (validUuid && q.isLoading)) {
    return shell(<ScheduleSkeleton />);
  }
  if (!validUuid || q.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  // ?day=saturday opens a given day (shareable); otherwise today.
  const linkedDay = RUN_OF_SHOW_DAYS.find(
    (d) => d.toLowerCase() === String(router.query.day ?? "").toLowerCase(),
  );
  const shownDay = day ?? linkedDay ?? defaultRunOfShowDay(now);

  return shell(
    <>
      <PageIntro eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <DayPicker value={shownDay} onChange={setDay} />
      <CompanyLocationsView
        data={q.data}
        day={shownDay}
        now={now}
        highlightSponsor={me.data?.sponsorName}
      />
      <ReadAt iso={q.data.readAt} />
    </>,
  );
}
