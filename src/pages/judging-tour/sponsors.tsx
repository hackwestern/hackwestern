import SEO from "~/components/seo";
import { SponsorTour } from "~/components/judging/tour/sponsor-tour";
import { judgingTourCopy } from "~/content/judging-tour";

// Sponsor prize track judging, walked through on sample teams. Public.
export default function SponsorTourPage() {
  return (
    <>
      <SEO title={judgingTourCopy.sponsorTour.title} noindex />
      <SponsorTour />
    </>
  );
}
