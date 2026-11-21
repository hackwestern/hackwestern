import { type GetServerSidePropsContext } from "next";
import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { ClockDisplay } from "~/components/clock/clock-display";
import { HeroScene } from "~/components/clock/hero-scene";
import { InternalPage } from "~/components/internals/page-shell";
import { useClock } from "~/hooks/use-clock";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

export default function InternalClock() {
  const { state } = useClock();
  const utils = api.useUtils();
  const { toast } = useToast();

  const options = {
    onSuccess: (data: Parameters<typeof utils.clock.get.setData>[1]) =>
      utils.clock.get.setData(undefined, data),
    onError: (e: { message: string }) =>
      toast({ title: "Clock update failed", description: e.message }),
  };
  const start = api.clock.start.useMutation(options);
  const pause = api.clock.pause.useMutation(options);
  const resume = api.clock.resume.useMutation(options);
  const reset = api.clock.reset.useMutation(options);

  const busy =
    start.isPending || pause.isPending || resume.isPending || reset.isPending;
  const status = state?.status;

  return (
    <>
      <SEO title="Clock Control" description="Organizer clock." noindex />
      <InternalPage
        title="Pitch clock"
        subtitle="Start, pause and reset the shared 5-minute clock."
      >
        <HeroScene className="h-[min(74vh,560px)] rounded-2xl border border-[#d6dbe5]">
          <ClockDisplay className="mt-[9cqh]" />
          <div className="mt-auto flex flex-col items-center gap-3 pb-[5cqh]">
            <div className="flex gap-3">
              <Button
                disabled={busy || !state || status === "running"}
                onClick={() => (status === "paused" ? resume : start).mutate()}
              >
                {status === "paused" ? "Resume" : "Start 5:00"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || status !== "running"}
                onClick={() => pause.mutate()}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                disabled={busy || !state || status === "idle"}
                onClick={() => reset.mutate()}
              >
                Reset
              </Button>
            </div>
            <p className="m-0 text-sm text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
              Hackers see this at <code>/clock</code>. Updates reach them within
              ~2 seconds.
            </p>
          </div>
        </HeroScene>
      </InternalPage>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
