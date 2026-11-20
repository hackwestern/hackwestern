import { type GetServerSidePropsContext } from "next";
import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { ClockDisplay } from "~/components/clock/clock-display";
import { InternalNavbar } from "~/components/internals/navbar";
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
      <InternalNavbar />
      <main className="flex flex-col items-center gap-8 py-12">
        <ClockDisplay />
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
        <p className="text-sm text-slate-500">
          Hackers see this at <code>/clock</code>. Updates reach them within ~2
          seconds.
        </p>
      </main>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
