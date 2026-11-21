import { type GetServerSidePropsContext } from "next";
import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { signOut } from "next-auth/react";
import SEO from "~/components/seo";
import { FilmStrip } from "~/components/promo/film-strip";
import { Button } from "~/components/ui/button";
import { LIVE_ACCESS_PAGE, liveAccessRedirect } from "~/lib/live-access";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a16bc7] focus-visible:ring-offset-2";

// Where /live sends hackers who aren't confirmed, so the homepage's Live site
// button explains itself instead of bouncing them back home. Same look and
// copy as the team finder's "for confirmed hackers" screen.
export default function LiveAccess({ email }: { email: string | null }) {
  return (
    <>
      <SEO title="Live site" noindex />
      <main className="relative flex min-h-[100svh] w-full items-center overflow-x-clip bg-[#1f1029] font-figtree text-white">
        <div className="pointer-events-none fixed inset-x-0 top-0 -translate-y-[6px]">
          <FilmStrip />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 translate-y-[10px]">
          <FilmStrip />
        </div>
        <div className="mx-auto flex w-full max-w-xl items-start gap-4 px-5 py-28 sm:gap-5 sm:px-8">
          <Link
            href="/"
            aria-label="Hack Western home"
            className={`mt-0.5 shrink-0 rounded-md transition-transform hover:-rotate-6 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} focus-visible:ring-white focus-visible:ring-offset-transparent`}
          >
            <Image
              src="/shared/horse.svg"
              alt=""
              width={40}
              height={60}
              className="h-[60px] w-auto"
              priority
              draggable={false}
            />
          </Link>
          <div className="min-w-0">
            <h1 className="text-balance font-cossetteTexte text-[34px] font-bold leading-[1.1] sm:text-[48px]">
              The live site is for confirmed hackers
            </h1>
            <p className="mt-3 text-pretty text-[17px] leading-relaxed">
              It’s open to hackers who confirmed their spot for Hack Western 13.
              {email && (
                <>
                  {" "}
                  You’re signed in as{" "}
                  <span className="font-semibold">{email}</span>.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button
                asChild
                variant="primary"
                className="h-12 min-h-0 px-6 py-0 font-figtree font-medium"
              >
                <Link href="/">Back to home</Link>
              </Button>
              <button
                type="button"
                onClick={() =>
                  void signOut({ callbackUrl: "/login?callbackUrl=/live" })
                }
                className={`rounded-sm text-[15px] font-semibold underline underline-offset-4 hover:text-[#e1c8fa] ${FOCUS} focus-visible:ring-offset-transparent`}
              >
                Use a different account
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const user = session
    ? await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
        columns: { type: true },
      })
    : undefined;
  const application =
    session && user?.type === "hacker"
      ? await db.query.applications.findFirst({
          where: (applications, { eq }) =>
            eq(applications.userId, session.user.id),
          columns: { status: true },
        })
      : undefined;

  // Only for hackers /live turns away; everyone else goes where /live sends them
  const destination = liveAccessRedirect(
    session ? { type: user?.type ?? null, status: application?.status } : null,
  );
  if (destination !== LIVE_ACCESS_PAGE) {
    return {
      redirect: { destination: destination ?? "/live", permanent: false },
    };
  }
  return { props: { email: session?.user.email ?? null } };
};
