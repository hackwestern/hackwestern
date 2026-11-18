import {
  ExternalLink,
  FileText,
  Github,
  Link as LinkIcon,
  Linkedin,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorHackersCopy as copy } from "~/content/sponsor-hackers";

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
      className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:flex sm:flex-wrap"
    >
      {links.map(({ key, label, Icon, href }) => (
        <li key={key}>
          <DashboardButton
            variant="outline"
            asChild
            className="h-11 w-full sm:w-auto"
          >
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.links.opensIn(label, name)}
            >
              <Icon aria-hidden />
              {label}
            </a>
          </DashboardButton>
        </li>
      ))}
    </ul>
  );
}
