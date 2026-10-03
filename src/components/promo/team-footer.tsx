/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Meet the Team footer — Figma 402:6565 (desktop) / 585:3670 (mobile).
 *
 * The team travels in a slowly scrolling row on a black band, fading out at
 * both edges, along a smooth wave (see pathY). Sizes come from the 1440px design frame via `--u` (one design
 * px); mobile is the same layout at 0.4× (a 576px-wide frame), as in the
 * Figma. Hovering or focusing someone pauses the row, outlines them and shows
 * their name tag.
 */

export type TeamMember = {
  name: string;
  role: string;
  /** Transparent full-body cut-out, from scripts/cutout-team-photos.ts. */
  image: string;
  /** Hover outline, matching their label on the organizing team poster. */
  color: string;
  /** LinkedIn or personal site, opened when they're clicked. */
  url?: string;
};

const CUTOUTS = "/landing/meet-the-team";

const member = (
  name: string,
  role: string,
  slug: string,
  color: string,
  url?: string,
): TeamMember => ({
  name,
  role,
  image: `${CUTOUTS}/${slug}.webp`,
  color,
  url,
});

const linkedin = (handle: string) => `https://www.linkedin.com/in/${handle}`;

export const TEAM: TeamMember[] = [
  member(
    "Aleeza Jahan",
    "Design Organizer",
    "aleeza",
    "#39c9b4",
    "https://aleezajahan.com",
  ),
  member(
    "Alex Li",
    "Events Organizer",
    "alex",
    "#1b2861",
    linkedin("alexyouli"),
  ),
  member(
    "Alice Nguyen",
    "Spon Organizer",
    "alice",
    "#a19895",
    linkedin("alicebtnguyen"),
  ),
  member(
    "Allison Ye",
    "Marketing Lead",
    "allisonl",
    "#c3ba9b",
    linkedin("-allison-ye"),
  ),
  member(
    "Aniya Liu",
    "Spon Organizer",
    "aniya",
    "#729762",
    linkedin("aniyaliu"),
  ),
  member(
    "Anson Wang",
    "Marketing Organizer",
    "anson",
    "#72d428",
    linkedin("anson-wang-b187a7233"),
  ),
  member(
    "Brittney Chong",
    "Co-Director",
    "brittney",
    "#a4dfe7",
    linkedin("brittneyrachellechong"),
  ),
  member(
    "Caroline Ge",
    "Spon Organizer",
    "caroline",
    "#a38f97",
    linkedin("carolinege"),
  ),
  member(
    "Daniel Wang",
    "Spon Organizer",
    "daniel",
    "#4aae8e",
    linkedin("daniel04wang"),
  ),
  member(
    "Edmund Chen",
    "Design Organizer",
    "edmund",
    "#778d4e",
    "https://edmundchen.art",
  ),
  member(
    "Emily Liu",
    "Events Organizer",
    "emily",
    "#ad958e",
    linkedin("emiliuly"),
  ),
  member(
    "Ethan Rong",
    "Web Organizer",
    "ethan",
    "#bb694b",
    "https://ethan-rng.site",
  ),
  member(
    "Holia Zhang",
    "Web Organizer",
    "holia",
    "#1eada4",
    linkedin("holiazhang"),
  ),
  member(
    "Jamie Gao",
    "Growth Organizer",
    "jamie",
    "#c2a022",
    linkedin("jamie6551"),
  ),
  member(
    "Jasmine Gu",
    "Product Lead",
    "jasmine",
    "#a85231",
    linkedin("jasmine-gu-b2aa65201"),
  ),
  member(
    "Jessica Wang",
    "Design Lead",
    "jessica-w",
    "#808d25",
    "https://jessicaywang.co",
  ),
  member("Jessica Xing", "Events Organizer", "jessica-x", "#92a5a4"),
  member(
    "Julian Laxman",
    "Co-Director",
    "julian",
    "#c9cacd",
    "https://x.com/julianlaxman",
  ),
  member(
    "Kevin Li",
    "Web Organizer",
    "kevin",
    "#5b6e34",
    linkedin("kevinli5371"),
  ),
  member(
    "Lillian Wei",
    "Design Organizer",
    "lillian",
    "#afb095",
    linkedin("lillianhwei"),
  ),
  member(
    "Lucas Vanderwielen",
    "Web Organizer",
    "lucas",
    "#75a59b",
    linkedin("lucas-vanderwielen-5b7947338"),
  ),
  member(
    "Luka Lavric",
    "Web Lead",
    "luka",
    "#9da5ab",
    linkedin("lucianlavric"),
  ),
  member(
    "Natalie Wang",
    "Web Organizer",
    "natalie",
    "#64745e",
    linkedin("wang-natalie"),
  ),
  member(
    "Noah Medland",
    "Spon Lead",
    "noah",
    "#5d265b",
    linkedin("noah-medland-72a82b340"),
  ),
  member(
    "Pranav Varma",
    "Web Organizer",
    "pranav",
    "#9abdb0",
    linkedin("pranavarma"),
  ),
  member(
    "Sarah Lieng",
    "Events Lead",
    "sarah",
    "#42aa8c",
    linkedin("sarah-lieng"),
  ),
  member(
    "Sarina Cheng",
    "Events Lead",
    "sarina",
    "#b4b431",
    linkedin("sarinacheng"),
  ),
  member(
    "William Jiang",
    "Growth Organizer",
    "will",
    "#704181",
    linkedin("williamxjiang"),
  ),
];

const BAND_H = 354;
const FIGURE_H = 173;
const GAP = 28;
/** Room above the band for name tags, so the edge fade doesn't clip them. */
const TAG_ROOM = 60;

/** Seconds for the row to scroll by one copy of the team. */
const MARQUEE_S = 70;

/**
 * The wave the row is laid out along: a sine wave whose crests sit PATH_DROP
 * above its troughs. It's fixed to the row, so it scrolls with everyone and
 * nobody moves up or down.
 */
const PATH_TOP = 22;
const PATH_DROP = 88;
/** Target crest-to-crest distance, rounded so the loop has no seam. */
const PATH_WAVELENGTH = 480;

/** Drop below PATH_TOP, in design px, at design-px x along the row. */
function pathY(x: number, wavelength: number) {
  return (PATH_DROP / 2) * (1 - Math.cos((2 * Math.PI * x) / wavelength));
}

/**
 * Offsets each figure onto the wave by its position in the row. Each copy of
 * the team holds a whole number of waves, so both copies line up exactly.
 */
function useWaveLayout(trackRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const figures = [...track.querySelectorAll<HTMLElement>("[data-figure]")];
    if (!figures.length) return;

    const place = () => {
      // px per design px, from the figures' rendered height.
      const unit = figures[0]!.offsetHeight / FIGURE_H;
      const copyWidth = track.offsetWidth / 2 / unit;
      const waves = Math.max(1, Math.round(copyWidth / PATH_WAVELENGTH));
      figures.forEach((f) => {
        const center = (f.offsetLeft + f.offsetWidth / 2) / unit;
        const y = pathY(center, copyWidth / waves) * unit;
        f.style.transform = `translateY(${y}px)`;
      });
    };

    place();
    // Widths settle as the lazy cut-outs load, and change on resize.
    const resize = new ResizeObserver(place);
    resize.observe(track);
    return () => resize.disconnect();
  }, [trackRef]);
}

type AlphaMask = { width: number; height: number; alpha: Uint8ClampedArray };

/** Downscaled alpha channel of each cut-out, keyed by image URL. */
const masks = new Map<string, AlphaMask>();
const MASK_H = 256;
/** Pixels at least this opaque count as part of the person. */
const ALPHA_MIN = 64;

function alphaMask(img: HTMLImageElement) {
  const cached = masks.get(img.src);
  if (cached) return cached;
  if (!img.complete || !img.naturalWidth) return null;

  const height = Math.min(MASK_H, img.naturalHeight);
  const width = Math.round((img.naturalWidth * height) / img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;

  const mask = { width, height, alpha };
  masks.set(img.src, mask);
  return mask;
}

/** Hover margin around each person, in px, so the edges aren't twitchy. */
const SAFE_PX = 12;
/** How long someone stays selected after the pointer leaves their margin. */
const LEAVE_DELAY_MS = 180;

/**
 * Whether client point (x, y) is within SAFE_PX of an opaque pixel of the
 * cut-out.
 */
function hitsPerson(img: HTMLImageElement, x: number, y: number) {
  const mask = alphaMask(img);
  // Until the image has loaded there's nothing visible to hover.
  if (!mask) return false;
  const rect = img.getBoundingClientRect();
  const scale = mask.height / rect.height;
  const cx = (x - rect.left) * scale;
  const cy = (y - rect.top) * scale;
  const r = SAFE_PX * scale;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(mask.width - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(mask.height - 1, Math.ceil(cy + r));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;
      if (mask.alpha[py * mask.width + px]! >= ALPHA_MIN) return true;
    }
  }
  return false;
}

/**
 * Marks the figure whose visible pixels are under the pointer with
 * `data-active`, which outlines them, shows their tag and pauses the row.
 * Re-checked every frame while the mouse is over the row, since people
 * move under a still cursor.
 */
function usePersonHover(trackRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const figures = [...track.querySelectorAll<HTMLElement>("[data-figure]")];
    let active: HTMLElement | null = null;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let leaveTimer = 0;

    const activate = (figure: HTMLElement | null) => {
      if (figure === active) return;
      active?.removeAttribute("data-active");
      if (figure) {
        figure.setAttribute("data-active", "");
        // data-glow plays the underglow once. It's left on after leaving so
        // the glow can fade out, and re-added (after a reflow) to replay it.
        figure.removeAttribute("data-glow");
        void figure.offsetWidth;
        figure.setAttribute("data-glow", "");
      }
      active = figure;
    };
    // Switching to someone is instant; letting go waits LEAVE_DELAY_MS.
    const setActive = (figure: HTMLElement | null) => {
      if (figure) {
        clearTimeout(leaveTimer);
        leaveTimer = 0;
        activate(figure);
      } else if (active && !leaveTimer) {
        leaveTimer = window.setTimeout(() => {
          leaveTimer = 0;
          activate(null);
        }, LEAVE_DELAY_MS);
      }
    };
    /** The figure under the pointer (margin included), or null. */
    const hit = () => {
      if (!pointer) return null;
      const { x, y } = pointer;
      const on = (f: HTMLElement) => hitsPerson(f.querySelector("img")!, x, y);
      // The current person wins ties, so overlapping margins don't flicker.
      return active && on(active) ? active : (figures.find(on) ?? null);
    };
    const test = () => {
      const figure = hit();
      setActive(figure);
      return figure;
    };
    const loop = () => {
      test();
      frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer = { x: e.clientX, y: e.clientY };
      test();
      if (!frame) frame = requestAnimationFrame(loop);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      setActive(null);
    };
    // Touch has no hover: the first tap on someone selects them (showing their
    // tag), and a second tap on them opens their link.
    let tapType = "mouse";
    let tappedAgain = false;
    const onDown = (e: PointerEvent) => {
      tapType = e.pointerType;
      if (e.pointerType === "mouse") return;
      const before = active;
      pointer = { x: e.clientX, y: e.clientY };
      const figure = test();
      tappedAgain = figure !== null && figure === before;
    };
    // Links only open from the person's visible pixels, not the rest of the box.
    const onClick = (e: MouseEvent) => {
      const figure = (e.target as Element).closest("[data-figure]");
      // detail is 0 for keyboard activation, which always follows the link.
      if (!figure || e.detail === 0) return;
      const onPerson = tapType === "mouse" ? figure === active : tappedAgain;
      if (!onPerson) e.preventDefault();
    };

    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerleave", onLeave);
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(leaveTimer);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerleave", onLeave);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("click", onClick);
    };
  }, [trackRef]);
}

const u = (px: number) => `calc(${px} * var(--u))`;

type CssVars = CSSProperties & Record<`--${string}`, string>;

// Cut-out outline in the member's colour (set as --outline on the figure).
// Written out in full for both variants so Tailwind can find the classes.
const OUTLINE =
  "group-data-[active]:[filter:drop-shadow(3px_0_0_var(--outline))_drop-shadow(-3px_0_0_var(--outline))_drop-shadow(0_3px_0_var(--outline))_drop-shadow(0_-3px_0_var(--outline))] group-focus:[filter:drop-shadow(3px_0_0_var(--outline))_drop-shadow(-3px_0_0_var(--outline))_drop-shadow(0_3px_0_var(--outline))_drop-shadow(0_-3px_0_var(--outline))]";

// Solid black for the outer half of the fade, then a ramp (Figma 160px / 64px).
const EDGE_FADE =
  "linear-gradient(to right, transparent calc(var(--fade) / 2), #000 var(--fade), #000 calc(100% - var(--fade)), transparent calc(100% - var(--fade) / 2))";

export function TeamFooter({ team = TEAM }: { team?: TeamMember[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  useWaveLayout(trackRef);
  usePersonHover(trackRef);

  return (
    <footer className="relative z-10 overflow-x-clip bg-black [container-type:inline-size]">
      <div
        // Desktop: one design px per px, so the band keeps its height and wider
        // screens just show more of the marquee.
        className="relative [--fade:64px] [--u:calc(max(100cqw,576px)/1440)] md:[--fade:160px] lg:[--u:1px]"
        style={
          {
            height: u(BAND_H),
          } as CssVars
        }
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            top: u(-TAG_ROOM),
            maskImage: EDGE_FADE,
            WebkitMaskImage: EDGE_FADE,
          }}
        >
          {/* The list is rendered twice so the loop has no seam. */}
          <div
            ref={trackRef}
            className="flex w-max animate-team-marquee items-start focus-within:[animation-play-state:paused] has-[[data-active]]:[animation-play-state:paused] motion-reduce:animate-none"
            style={{
              paddingTop: u(TAG_ROOM),
              animationDuration: `${MARQUEE_S}s`,
            }}
          >
            {[0, 1].map((copy) =>
              team.map((m) => (
                <TeamFigure
                  key={`${copy}-${m.image}`}
                  member={m}
                  hidden={copy === 1}
                />
              )),
            )}
          </div>
        </div>

        <div className="absolute inset-x-[31px] bottom-[12px] flex items-center justify-between font-figtree text-[12px] font-semibold leading-none text-offwhite md:inset-x-[80px] md:bottom-[30px] md:text-[16px]">
          <p>Hack Western 2026</p>
          <a
            href="https://static.mlh.io/docs/mlh-code-of-conduct.pdf"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-offwhite/70"
          >
            MLH Code of Conduct
          </a>
        </div>
      </div>
    </footer>
  );
}

function TeamFigure({
  member,
  hidden,
}: {
  member: TeamMember;
  /** The loop's second copy: kept out of the tab order and screen readers. */
  hidden: boolean;
}) {
  return (
    <a
      href={member.url}
      target={member.url && "_blank"}
      rel="noreferrer"
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : `${member.name}, ${member.role}`}
      data-figure
      className={`group relative flex-none cursor-default outline-none ${member.url ? "data-[active]:cursor-pointer" : ""}`}
      style={
        {
          marginTop: u(PATH_TOP),
          marginRight: u(GAP),
          height: u(FIGURE_H),
          "--outline": member.color,
        } as CssVars
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-15%] bottom-[-8%] h-[22%] opacity-0 transition-opacity duration-300 group-data-[active]:opacity-100"
      >
        <div
          className="h-full w-full opacity-0 blur-md group-data-[glow]:animate-team-glow motion-reduce:hidden"
          style={{
            background:
              "radial-gradient(closest-side, var(--outline), transparent)",
          }}
        />
      </div>
      <img
        src={member.image}
        alt=""
        loading="lazy"
        draggable={false}
        className={`relative h-full w-auto select-none transition-[filter] duration-150 group-data-[active]:transition-none ${OUTLINE}`}
      />
      <NameTag member={member} />
    </a>
  );
}

function NameTag({ member }: { member: TeamMember }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[calc(100%-10px)] left-1/2 z-10 flex w-max min-w-[112px] -translate-x-1/2 flex-col items-center justify-center gap-[3px] overflow-hidden rounded-full border border-[#969696] bg-[#cacaca] px-3 py-2 opacity-0 shadow-[0px_8px_12px_0px_rgba(31,48,73,0.24),inset_0px_-14px_10px_0px_rgba(255,255,255,0.4)] transition-opacity duration-150 group-focus:opacity-100 group-data-[active]:opacity-100 md:min-w-[140px]"
    >
      <span className="absolute inset-x-[7px] -top-px h-[15px] rounded-full bg-gradient-to-b from-white/60 to-white/0" />
      <span className="relative whitespace-nowrap font-figtree text-[12px] font-semibold leading-none text-[#313a45] md:text-[14px]">
        {member.name}
      </span>
      <span className="relative whitespace-nowrap font-figtree text-[12px] leading-none text-[#313a45] md:text-[14px]">
        {member.role}
      </span>
    </div>
  );
}
