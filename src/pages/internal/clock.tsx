import { type GetServerSidePropsContext } from "next";
import Link from "next/link";
import SEO from "~/components/seo";
import { ClockDisplay } from "~/components/clock/clock-display";
import { HeroScene } from "~/components/clock/hero-scene";
import { InternalPage } from "~/components/internals/page-shell";
import { authRedirectOrganizer } from "~/utils/redirect";

// Read only: it mirrors the round timer judges see. Start, pause and end
// rounds from the Judging controls.
export default function InternalClock() {
  return (
    <>
      <SEO title="Round Clock" description="Organizer clock." noindex />
      <InternalPage
        title="Round clock"
        subtitle="The round timer judges see, read only. Rounds are started, paused and ended in Judging controls."
        actions={
          <Link
            href="/internal/judging"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-[#5b3fa0] px-4 text-[15px] font-bold text-[#5b3fa0] no-underline hover:bg-white"
          >
            Judging controls
          </Link>
        }
      >
        <HeroScene className="h-[min(74vh,560px)] rounded-2xl border border-[#d6dbe5]">
          <ClockDisplay className="mt-[9cqh]" />
          <p className="m-0 mt-auto pb-[5cqh] text-sm text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            Hackers see this at <code>/clock</code>. Updates reach them within
            ~2 seconds.
          </p>
        </HeroScene>
      </InternalPage>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
