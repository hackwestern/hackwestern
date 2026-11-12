import SEO from "~/components/seo";
import { ClockDisplay } from "~/components/clock/clock-display";

/** Read-only clock for hackers (and the projector). */
export default function ClockPage() {
  return (
    <>
      <SEO title="Clock" description="Hack Western event clock." noindex />
      <main className="flex min-h-screen items-center justify-center">
        <ClockDisplay className="scale-125" />
      </main>
    </>
  );
}
