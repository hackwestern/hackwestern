import {
  ExternalLink,
  FileText,
  Github,
  Globe,
  Link as LinkIcon,
  Linkedin,
} from "lucide-react";
import {
  DevpostLogo,
  GitHubLogo,
  LinkedInLogo,
} from "~/components/sponsors/brand-icons";
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
/** The icon version (mock sponsor-chats-v3): LinkedIn, GitHub and Devpost
 * as their logos in brand colour, Résumé and Website as line icons. */
const ICONS = [
  {
    key: "resume",
    label: copy.links.resumeIcon,
    icon: <FileText className="size-5" strokeWidth={1.8} />,
    tone: "text-dashboard-text-link",
  },
  {
    key: "linkedIn",
    label: copy.links.linkedIn,
    icon: <LinkedInLogo className="size-5" />,
    tone: "text-dashboard-brand-linkedin",
  },
  {
    key: "github",
    label: copy.links.github,
    icon: <GitHubLogo className="size-5" />,
    tone: "text-dashboard-brand-github",
  },
  {
    key: "extraLink",
    label: copy.links.extraIcon,
    icon: <Globe className="size-5" strokeWidth={1.8} />,
    tone: "text-dashboard-text-link",
  },
  {
    key: "devpost",
    label: copy.links.devpost,
    icon: <DevpostLogo className="size-5" />,
    tone: "text-dashboard-brand-devpost",
  },
] as const;

export function HackerLinks({
  name,
  links: fields,
  icons = false,
}: {
  name: string;
  links: HackerLinkFields;
  /** 44px icon buttons with a tooltip, only for the links they have. */
  icons?: boolean;
}) {
  if (icons) {
    const shown = ICONS.flatMap((l) => {
      const href = fields[l.key];
      return href ? [{ ...l, href }] : [];
    });
    if (shown.length === 0) return null;
    return (
      <ul
        aria-label={copy.links.label(name)}
        className="m-0 flex list-none flex-wrap gap-2 p-0"
      >
        {shown.map((l) => (
          <li key={l.key}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.links.opensIn(l.label, name)}
              title={l.label}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
                l.tone,
                pressable,
              )}
            >
              {l.icon}
            </a>
          </li>
        ))}
      </ul>
    );
  }
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
