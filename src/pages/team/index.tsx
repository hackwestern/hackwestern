import Head from "next/head";
import Link from "next/link";
import { TeamNav } from "./teamnav";
import PrimaryButton from "~/components/internals/primary-button";
import { SubmissionCountdown } from "~/components/team/submission-countdown";
const SECTIONS = [
  {
    href: "/team/join",
    title: "Find, Join, or Create a Team",
    description: "Search existing teams, join one, or start your own.",
  },
  {
    href: "/team/manage",
    title: "Manage Your Team",
    description: "See your teammates and manage your current team.",
  },
  {
    href: "/submit",
    title: "Submit Your Project",
    description: "Add your DevPost link, repo, tracks, and member info.",
  },
];

export default function TeamDashboardPage() {
  return (
    <>
      <Head>
        <title>Team Dashboard — Hack Western 13</title>
      </Head>
      <main className="min-h-screen bg-offwhite px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <TeamNav />

          <h1 className="h1 text-heavy">Dashboard</h1>

          <SubmissionCountdown />

          <div className="flex flex-col gap-3">
            {SECTIONS.map((section) => (
              <div
                key={section.href}
                className="flex items-center justify-between rounded-lg border border-gray-1 bg-white-0 px-4 py-3"
              >
                <div>
                  <p className="p2 text-heavy">{section.title}</p>
                  <p className="p3 text-light">{section.description}</p>
                </div>
                <Link href={section.href}>
                  <PrimaryButton size="sm">Open</PrimaryButton>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}