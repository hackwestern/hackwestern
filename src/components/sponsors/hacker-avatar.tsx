import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "~/lib/utils";

const USERNAME = /^[A-Za-z0-9-]{1,39}$/;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/**
 * The GitHub username in a profile link ("https://github.com/octocat",
 * "github.com/octocat/", "@octocat" or "octocat"), or null. Strict on
 * purpose: only a github.com host and a valid username ever build an image
 * URL, so no arbitrary URL is loaded.
 */
export function githubUsername(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const bare = raw.replace(/^@/, "");
  if (USERNAME.test(bare)) return bare;
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
  const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
  return USERNAME.test(first) ? first : null;
}

/** Up to two initials, by code point (so emoji and accents stay whole). */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = [words[0], words.length > 1 ? words.at(-1) : undefined]
    .map((w) => (w ? (Array.from(w)[0] ?? "") : ""))
    .join("");
  return letters.toLocaleUpperCase();
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

/**
 * A hacker's round photo from their GitHub profile, with their initials on a
 * dashboard-tinted circle underneath: shown when there's no username, while
 * the photo loads, and if it fails. Sponsors only ever get a GitHub link for
 * hackers who agreed to share, so no consent means no photo.
 *
 * A plain <img>: github.com isn't in next.config's image domains, and that
 * file is shared. Decorative (alt=""): the name is always next to it.
 */
export function HackerAvatar({
  name,
  github,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  /** The application's GitHub link (or a username). */
  github?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const username = githubUsername(github);
  const src = username
    ? `https://github.com/${encodeURIComponent(username)}.png?size=96`
    : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const el = img.current;
    if (src && el?.complete && el.naturalWidth > 0) setLoaded(src);
  }, [src]);

  const initials = initialsOf(name);
  const showImage = src !== null && failed !== src;

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-dashboard-bg-highlight font-semibold text-dashboard-text-active",
        SIZES[size],
        className,
      )}
    >
      {initials || <UserRound className="size-1/2" strokeWidth={1.75} />}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={src}
          alt=""
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none",
            loaded === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
