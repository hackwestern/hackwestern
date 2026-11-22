import { JudgingTour } from "~/components/judging/tour/judging-tour";
import SEO from "~/components/seo";
import { judgingTourCopy } from "~/content/judging-tour";

// The judging walkthrough for judges and hackers: both screens, stop by stop,
// on sample data. Public, so it opens from a QR code without signing in.
export default function JudgingTourPage() {
  return (
    <>
      <SEO title={judgingTourCopy.title} noindex />
      <JudgingTour />
    </>
  );
}
