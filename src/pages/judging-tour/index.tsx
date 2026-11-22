import Link from "next/link";
import { useRouter } from "next/router";

import SEO from "~/components/seo";
import {
  JudgingWalkthrough,
  type WalkRole,
} from "~/components/judging/tour/judging-walkthrough";
import { judgingTourCopy } from "~/content/judging-tour";

const copy = judgingTourCopy.walkthrough;
const ROLES: readonly WalkRole[] = ["both", "judge", "hacker"];

// The judging tour: pick who you are, then the real screens on sample data
// with the sponsor portal's spotlight. ?role=both|judge|hacker opens a tour
// straight away (for QR codes). Public.
export default function JudgingTourPage() {
  const router = useRouter();
  const raw = router.query.role;
  const role = ROLES.find((r) => r === raw);

  return (
    <>
      <SEO title={copy.title} noindex />
      {role ? (
        <JudgingWalkthrough
          key={role}
          role={role}
          onChange={() => void router.push("/judging-tour")}
        />
      ) : (
        <main className="flex min-h-dvh items-center bg-dashboard-bg-page px-[max(16px,env(safe-area-inset-left,0px))] py-12 font-figtree text-dashboard-text-heavy">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <header className="flex flex-col gap-3">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-active">
                {copy.chooser.eyebrow}
              </p>
              <h1 className="m-0 text-balance text-4xl font-bold leading-tight md:text-5xl">
                {copy.chooser.heading}
              </h1>
              <p className="m-0 max-w-[60ch] text-lg text-dashboard-text-medium">
                {copy.chooser.body}
              </p>
            </header>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
              {ROLES.map((r) => (
                <li key={r}>
                  <Link
                    href={`/judging-tour?role=${r}`}
                    className={`flex h-full flex-col gap-1 rounded-2xl border p-5 transition-colors hover:border-dashboard-action-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary ${
                      r === "both"
                        ? "border-dashboard-action-primary bg-dashboard-bg-highlight"
                        : "border-dashboard-border-default bg-dashboard-bg-surface"
                    }`}
                  >
                    <span className="text-xl font-bold">
                      {copy.chooser.options[r].title}
                    </span>
                    <span className="text-dashboard-text-medium">
                      {copy.chooser.options[r].body}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}
    </>
  );
}
