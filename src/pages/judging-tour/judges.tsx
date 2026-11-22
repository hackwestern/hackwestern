import SEO from "~/components/seo";
import { JudgeBriefing } from "~/components/judging/tour/judge-briefing";
import { judgingTourCopy } from "~/content/judging-tour";

// The judges' briefing on one screen, for the projector. Public.
export default function JudgeBriefingPage() {
  return (
    <>
      <SEO title={judgingTourCopy.judgeBriefing.title} noindex />
      <JudgeBriefing />
    </>
  );
}
