import SEO from "~/components/seo";
import { HackerBriefing } from "~/components/judging/tour/hacker-briefing";
import { judgingTourCopy } from "~/content/judging-tour";

// Judging for hackers on one screen, for the projector. Public.
export default function HackerBriefingPage() {
  return (
    <>
      <SEO title={judgingTourCopy.hackerBriefing.title} noindex />
      <HackerBriefing />
    </>
  );
}
