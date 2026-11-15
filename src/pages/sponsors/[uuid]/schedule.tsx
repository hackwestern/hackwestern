import { useState } from "react";
import { useRouter } from "next/router";
import { CoffeeChatSummary } from "~/components/sponsors/coffee-chat-summary";
import { DayPicker } from "~/components/sponsors/day-picker";
import { RepCount } from "~/components/sponsors/rep-count";
import { ScheduleList } from "~/components/sponsors/schedule-list";
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

const copy = scheduleCopy.schedule;

// A sponsor's own schedule from the run-of-show sheet (read-only; the sheet
// is the source of truth). Refreshes every minute.
export default function SponsorSchedulePage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);

  const q = api.sponsorSchedule.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 60_000, retry: 1 },
  );

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

  const data = q.data;
  // ?day=saturday opens a given day (shareable); otherwise today.
  const linkedDay = RUN_OF_SHOW_DAYS.find(
    (d) => d.toLowerCase() === String(router.query.day ?? "").toLowerCase(),
  );
  const shownDay = day ?? linkedDay ?? defaultRunOfShowDay(now);
  const items = data.items.filter((i) => i.day === shownDay);

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title(data.sponsorName)}
        intro={copy.intro}
      />
      {shownDay === "Saturday" && (
        <>
          <CoffeeChatSummary setup={data.coffeeChat} />
          <RepCount sponsor={id} groupSize={data.coffeeChat?.groupSize ?? 1} />
        </>
      )}
      <DayPicker value={shownDay} onChange={setDay} />
      <ScheduleList
        items={items}
        now={now}
        highlightSponsor={data.sponsorName}
      />
      <ReadAt iso={data.readAt} />
    </>,
  );
}
