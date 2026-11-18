import Link from "next/link";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { authRedirectOrganizer } from "~/utils/redirect";

const PAGES = [
  {
    href: "/internal/judging",
    title: "Judging",
    description: "Coming soon.",
  },
  {
    href: "/internal/sponsors",
    title: "Sponsors",
    description: "Sponsor roster and check-in status.",
  },
  {
    href: "/internal/review",
    title: "Applicant Review",
    description: "Review hacker applications.",
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
          <div className="grid gap-4 sm:grid-cols-2">
            {PAGES.map((p) => (
              <Link
                key={p.title}
                href={p.href}
                className="rounded-xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:shadow-md"
              >
                <h2 className="m-0 text-lg font-bold text-primary-600">
                  {p.title}
                </h2>
                <p className="m-0 mt-1 text-sm text-slate-600">
                  {p.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
