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
      <SEO title="Organizer home" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-[#f8f9fc] px-6 pb-16 pt-12 font-figtree text-[#0b2238] md:px-16">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <h1 className="m-0 text-4xl font-semibold">Organizer home</h1>
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-5">
              <h2 className="m-0 text-2xl font-semibold">{section.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.cards.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="flex flex-col gap-3 rounded-xl bg-white p-6 text-[#0b2238] no-underline shadow-[0_2px_12px_rgba(11,34,56,0.08)] transition hover:shadow-[0_4px_18px_rgba(11,34,56,0.14)]"
                  >
                    <h3 className="m-0 text-xl font-semibold text-[#0b2238]">
                      {c.title}
                    </h3>
                    <p className="m-0 text-base text-[#4a5d73]">
                      {c.description}
                    </p>
                    {c.note && (
                      <p className="m-0 text-sm text-[#4a5d73]">{c.note}</p>
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
