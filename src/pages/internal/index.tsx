import Link from "next/link";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { authRedirectOrganizer } from "~/utils/redirect";

type Card = { href: string; title: string; description: string; note?: string };

const SECTIONS: { title: string; cards: Card[] }[] = [
  {
    title: "Judging",
    cards: [
      {
        href: "/internal/judging",
        title: "Judging Controls",
        description: "Queue, judge progress, rankings and sponsor tracks.",
        note: "API not wired up yet",
      },
      {
        href: "/internal/roster",
        title: "Judge Roster",
        description: "See judges and add new ones.",
      },
      {
        href: "/internal/rubric",
        title: "Rubric",
        description: "Preview the judging rubric.",
      },
      {
        href: "/internal/team-results",
        title: "Team Results",
        description: "Scores and results per team.",
        note: "API not wired up yet",
      },
      {
        href: "/judge",
        title: "My judging",
        description: "The judge phone view.",
        note: "API not wired up yet",
      },
    ],
  },
  {
    title: "Integrity",
    cards: [
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
    cards: [
      {
        href: "/scavenger",
        title: "Scan activities",
        description:
          "Pick a meal, workshop or activity, then scan hacker passes.",
      },
      {
        href: "/scavenger/redeem",
        title: "Scavenger hunt redeem",
        description: "Redeem scavenger hunt points for prizes.",
      },
    ],
  },
  {
    title: "Applications & sponsors",
    cards: [
      {
        href: "/internal/review",
        title: "Applicant Review",
        description: "Review hacker applications.",
      },
      {
        href: "/internal/sponsors",
        title: "Sponsors",
        description: "Sponsor roster and check-in status.",
      },
    ],
  },
];

export default function InternalIndex() {
  return (
    <>
      <SEO title="Internal" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-8 font-figtree text-[#0b2238]">
        <div className="mx-auto flex max-w-[800px] flex-col gap-5">
          <h1 className="m-0 text-[28px] font-bold">Internal</h1>
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="m-0 text-xl font-bold">{section.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.cards.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="rounded-xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:shadow-md"
                  >
                    <h3 className="m-0 text-lg font-bold text-primary-600">
                      {c.title}
                    </h3>
                    <p className="m-0 mt-1 text-sm text-slate-600">
                      {c.description}
                    </p>
                    {c.note && (
                      <p className="m-0 mt-2 text-xs text-slate-500">
                        {c.note}
                      </p>
                    )}
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
