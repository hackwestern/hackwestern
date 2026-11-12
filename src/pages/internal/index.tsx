import Link from "next/link";
import { InternalNavbar } from "~/components/internals/navbar";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import SEO from "~/components/seo";
import { authRedirectOrganizer } from "~/utils/redirect";

type HubLink = {
  href: string;
  title: string;
  description: string;
  note?: string;
};

type HubSection = { title: string; links: HubLink[] };

// Add a page to the hub by adding one entry here.
const SECTIONS: HubSection[] = [
  {
    title: "Judging",
    links: [
      {
        href: "/internal/judging",
        title: "Control room",
        description: "Live queue, judges, progress and ranking.",
      },
      {
        href: "/internal/roster",
        title: "Judge roster",
        description: "Manage the judge list.",
        note: "UI only, mock data",
      },
      {
        href: "/judge",
        title: "My judging",
        description: "The judge phone view.",
      },
    ],
  },
  {
    title: "Integrity",
    links: [
      {
        href: "/internal/cheat-check",
        title: "Cheat checks",
        description: "Automated checks on teams and members.",
        note: "Locked on production",
      },
    ],
  },
  {
    title: "Scanning",
    links: [
      {
        href: "/scan/scan",
        title: "Scan activities",
        description:
          "Pick a meal, workshop or activity, then scan hacker passes.",
        note: "Locked on production",
      },
      {
        href: "/scavenger/redeem",
        title: "Scavenger hunt redeem",
        description: "Redeem scavenger hunt points for prizes.",
      },
    ],
  },
  {
    title: "Applications",
    links: [
      {
        href: "/internal/dashboard",
        title: "My dashboard",
        description: "Reviewer leaderboard and the reviews you have done.",
      },
      {
        href: "/internal/review",
        title: "Applicant review",
        description: "Score and comment on applications.",
      },
    ],
  },
];

export default function InternalHub() {
  return (
    <>
      <SEO title="Organizer home" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-offwhite px-4 pb-12 pt-8 font-figtree sm:px-5">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
          <h1 className="m-0 text-3xl font-bold">Organizer home</h1>
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="m-0 text-lg font-semibold">{section.title}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-dashboard-lg no-underline transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2"
                  >
                    <DashboardPanel title={link.title} className="h-full">
                      <p className="m-0 text-sm text-dashboard-text-light">
                        {link.description}
                      </p>
                      {link.note && (
                        <p className="m-0 text-xs text-dashboard-text-light">
                          {link.note}
                        </p>
                      )}
                    </DashboardPanel>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
