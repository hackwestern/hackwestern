import SEO from "~/components/seo";
import { ClockDisplay } from "~/components/clock/clock-display";
import { HeroScene } from "~/components/clock/hero-scene";

/** Read-only clock for hackers (and the projector). */
export default function ClockPage() {
  return (
    <>
      <SEO title="Clock" description="Hack Western event clock." noindex />
      <main>
        <HeroScene className="h-screen w-screen">
          <ClockDisplay className="mt-[12cqh]" />
        </HeroScene>
      </main>
    </>
  );
}
