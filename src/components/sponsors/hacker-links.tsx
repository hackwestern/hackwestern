import {
  ExternalLink,
  FileText,
  Github,
  Link as LinkIcon,
  Linkedin,
} from "lucide-react";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorHackersCopy as copy } from "~/content/sponsor-hackers";
import { cn } from "~/lib/utils";

const LINKS = [
  { key: "resume", label: copy.links.resume, Icon: FileText },
  { key: "github", label: copy.links.github, Icon: Github },
  { key: "linkedIn", label: copy.links.linkedIn, Icon: Linkedin },
  { key: "devpost", label: copy.links.devpost, Icon: ExternalLink },
  { key: "extraLink", label: copy.links.extra, Icon: LinkIcon },
] as const;

export type HackerLinkFields = {
  resume: string | null;
  github: string | null;
  linkedIn: string | null;
  devpost: string | null;
  /** The extra link from the hacker interest form, if any. */
  extraLink?: string | null;
};

/**
 * A hacker's Resume / GitHub / LinkedIn / Devpost (and interest form extra
 * link) buttons. The server only sends links (already made safe by
 * safeProfileUrl) the hacker agreed to share with sponsors.
 */
export function HackerLinks({
  name,
  links: fields,
}: {
  name: string;
  links: HackerLinkFields;
}) {
  const links = LINKS.flatMap(({ key, label, Icon }) => {
    const href = fields[key];
    return href ? [{ key, label, Icon, href }] : [];
  });
  if (links.length === 0) return null;

  return (
    <ul
      aria-label={copy.links.label(name)}
      className="m-0 flex list-none flex-wrap gap-2 p-0"
    >
      {links.map(({ key, label, Icon, href }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.links.opensIn(label, name)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:border-dashboard-border-control [@media(hover:hover)]:hover:text-dashboard-text-heavy",
              pressable,
            )}
          >
            <Icon
              aria-hidden
              className="size-4 shrink-0 text-dashboard-text-light"
            />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
