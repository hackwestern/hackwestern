import { useRouter } from "next/router";
import { ExternalLink, FileText, Github, Linkedin, Users } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import {
  InvalidLink,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorHackersCopy as copy } from "~/content/sponsor-hackers";
import type { ShortlistedHacker } from "~/server/api/utils/sponsor-shortlist";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const LINKS = [
  { key: "resume", label: copy.links.resume, Icon: FileText },
  { key: "github", label: copy.links.github, Icon: Github },
  { key: "linkedIn", label: copy.links.linkedIn, Icon: Linkedin },
  { key: "devpost", label: copy.links.devpost, Icon: ExternalLink },
] as const;

// Read-only list of hackers who ranked this sponsor on /live (and agreed to
// share their profile). Offering a coffee chat happens by scanning a badge,
// not from here.
export default function SponsorHackersPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);

  const q = api.sponsorShortlist.list.useQuery(
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
  if (!q.data) {
    return shell(
      <DashboardPanel className="text-center">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.loadError}
        </p>
        <DashboardButton
          variant="outline"
          className="mx-auto h-11"
          onClick={() => void q.refetch()}
        >
          {copy.retry}
        </DashboardButton>
      </DashboardPanel>,
    );
  }

  const { sponsorName, hackers } = q.data;

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title(sponsorName)}
        intro={copy.intro}
      />
      <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-medium">
        {copy.offerHint}
      </p>

      {hackers.length === 0 ? (
        <DashboardPanel className="items-center text-center">
          <Users
            aria-hidden
            className="size-6 text-dashboard-text-light"
            strokeWidth={1.67}
          />
          <p className="m-0 text-base text-dashboard-text-medium">
            {copy.empty}
          </p>
        </DashboardPanel>
      ) : (
        <section
          aria-labelledby="hackers-count"
          className="flex flex-col gap-3"
        >
          <h2
            id="hackers-count"
            className="dashboard-section-label m-0 text-dashboard-text-light"
          >
            {copy.count(hackers.length)}
          </h2>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {hackers.map((h, i) => (
              <li key={h.hackerId ?? `${i}-${h.name}`}>
                <HackerCard hacker={h} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </>,
  );
}

function HackerCard({ hacker }: { hacker: ShortlistedHacker }) {
  const name = hacker.name || copy.unnamed;
  const links = LINKS.flatMap(({ key, label, Icon }) => {
    const href = hacker[key];
    return href ? [{ key, label, Icon, href }] : [];
  });

  return (
    <DashboardPanel className="gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 break-words text-lg font-semibold text-dashboard-text-heavy">
            {name}
          </h3>
          <span className="break-words text-sm text-dashboard-text-light">
            {hacker.team ?? copy.noTeam}
          </span>
        </div>
        <DashboardTag className="shrink-0">
          {copy.pick(hacker.rank)}
        </DashboardTag>
      </div>
      {links.length > 0 && (
        <ul
          aria-label={copy.links.label(name)}
          className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:flex sm:flex-wrap"
        >
          {links.map(({ key, label, Icon, href }) => (
            <li key={key}>
              <DashboardButton
                variant="outline"
                asChild
                className="h-11 w-full sm:w-auto"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.links.opensIn(label, name)}
                >
                  <Icon aria-hidden />
                  {label}
                </a>
              </DashboardButton>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
