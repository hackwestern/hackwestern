import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

import SEO from "~/components/seo";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

export default function SponsorHackersPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);
  const hackersQ = api.sponsorPortal.getInterestedHackers.useQuery(
    { sponsor: uuid },
    { enabled: validUuid, refetchOnWindowFocus: false },
  );

  if (!router.isReady) {
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  }

  if (!validUuid || hackersQ.isError) {
    return (
      <Shell>
        <DashboardPanel className="text-center">
          <h1 className="dashboard-h1 m-0">Link not recognised</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            This private link isn&apos;t valid. Ask your Hack Western contact
            for a new one.
          </p>
        </DashboardPanel>
      </Shell>
    );
  }

  const hackers = hackersQ.data?.hackers ?? [];

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <Link
          href={`/sponsors/${uuid}`}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-dashboard-text-medium hover:text-dashboard-text-heavy"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.67} />
          Back to sponsor hub
        </Link>
        <div className="flex flex-col gap-1">
          {hackersQ.data?.sponsorName && (
            <DashboardTag className="self-start">
              {hackersQ.data.sponsorName}
            </DashboardTag>
          )}
          <h1 className="dashboard-h1 m-0">Top interested hackers</h1>
          <p className="mb-0 mt-1 text-base font-medium leading-relaxed text-dashboard-text-medium">
            The top {hackers.length} scored hackers who expressed interest in
            your company.
          </p>
        </div>

        {hackers.length === 0 ? (
          <DashboardPanel className="text-center">
            <p className="m-0 text-base font-medium text-dashboard-text-medium">
              No scored hackers have selected your company yet.
            </p>
          </DashboardPanel>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {hackers.map((hacker, index) => (
              <li
                key={`${hacker.name}-${index}`}
                className="rounded-dashboard-2xl border-[1.5px] border-dashboard-border-default bg-dashboard-bg-surface p-4 shadow-dashboard-card"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-nav text-sm font-bold text-dashboard-text-medium">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-base font-semibold text-dashboard-text-heavy">
                      {hacker.name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {hacker.resumeUrl && (
                        <a
                          href={hacker.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-dashboard-sm bg-dashboard-bg-nav px-2.5 py-1.5 text-sm font-semibold text-dashboard-text-medium hover:text-dashboard-text-heavy"
                        >
                          <FileText className="size-4" aria-hidden="true" />
                          Resume
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                      {hacker.extraLink && (
                        <a
                          href={hacker.extraLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-dashboard-sm bg-dashboard-bg-nav px-2.5 py-1.5 text-sm font-semibold text-dashboard-text-medium hover:text-dashboard-text-heavy"
                        >
                          Extra link
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Shell>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card"
        />
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEO title="Top interested hackers" noindex />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-medium">
              Hack Western 13
            </span>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
