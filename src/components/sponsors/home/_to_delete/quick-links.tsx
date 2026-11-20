import { ExternalLink, Link2 } from "lucide-react";
import { card, CardTitle } from "~/components/sponsors/portal-ui";
import { sponsorHomeCopy } from "~/content/sponsor-home";

const copy = sponsorHomeCopy.quickLinks;

/**
 * Home's Quick links, above Key rooms: the portal walkthrough deck embedded
 * (Google Slides /embed), with a link to open it full size.
 */
export function QuickLinks() {
  const guide = copy.guide;
  return (
    <section aria-labelledby="quicklinks-heading" className={card}>
      <CardTitle id="quicklinks-heading" icon={<Link2 aria-hidden />}>
        {copy.title}
      </CardTitle>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <b className="font-semibold">{guide.label}</b>
          <a
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-dashboard-text-light underline-offset-2 hover:underline focus-visible:underline"
          >
            {guide.open}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-nav">
          <iframe
            src={guide.embedUrl}
            title={guide.frameTitle}
            loading="lazy"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    </section>
  );
}
