/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

/**
 * Meet the Team footer — Figma 402:6565 (desktop) / 585:3670 (mobile).
 *
 * The team stands in a slowly scrolling row on a black band, fading out at
 * both edges. Sizes come from the 1440px design frame via `--u` (one design
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
};

const CUTOUTS = "/landing/meet-the-team";

const member = (
  name: string,
  role: string,
  slug: string,
  color: string,
): TeamMember => ({
  name,
  role,
  image: `${CUTOUTS}/${slug}.webp`,
  color,
});

export const TEAM: TeamMember[] = [
  member("Aleeza Jahan", "Design Organizer", "aleeza", "#39c9b4"),
  member("Alex Li", "Events Organizer", "alex", "#1b2861"),
  member("Alice Nguyen", "Spon Organizer", "alice", "#a19895"),
  member("Allison Ye", "Marketing Lead", "allisonl", "#c3ba9b"),
  member("Aniya Liu", "Spon Organizer", "aniya", "#729762"),
  member("Anson Wang", "Marketing Organizer", "anson", "#72d428"),
  member("Brittney Chong", "Co-Director", "brittney", "#a4dfe7"),
  member("Caroline Ge", "Spon Organizer", "caroline", "#a38f97"),
  member("Daniel Wang", "Spon Organizer", "daniel", "#4aae8e"),
  member("Edmund Chen", "Design Organizer", "edmund", "#778d4e"),
  member("Emily Liu", "Events Organizer", "emily", "#ad958e"),
  member("Ethan Rong", "Web Organizer", "ethan", "#bb694b"),
  member("Holia Zhang", "Web Organizer", "holia", "#1eada4"),
  member("Jamie Gao", "Growth Organizer", "jamie", "#c2a022"),
  member("Jasmine Gu", "Product Lead", "jasmine", "#a85231"),
  member("Jessica Wang", "Design Lead", "jessica-w", "#808d25"),
  member("Jessica Xu", "Events Organizer", "jessica-x", "#92a5a4"),
  member("Julian Laxman", "Co-Director", "julian", "#c9cacd"),
  member("Kevin Li", "Web Organizer", "kevin", "#5b6e34"),
  member("Lillian Wei", "Design Organizer", "lillian", "#afb095"),
  member("Lucas Vanderwielen", "Web Organizer", "lucas", "#75a59b"),
  member("Luka Lavric", "Web Lead", "luka", "#9da5ab"),
  member("Natalie Wang", "Web Organizer", "natalie", "#64745e"),
  member("Noah Medland", "Spon Lead", "noah", "#5d265b"),
  member("Pranav Varma", "Web Organizer", "pranav", "#9abdb0"),
  member("Sarah Lieng", "Events Lead", "sarah", "#42aa8c"),
  member("Sarina Cheng", "Events Lead", "sarina", "#b4b431"),
  member("William Jiang", "Growth Organizer", "will", "#704181"),
];

const BAND_H = 354;
const FIGURE_H = 173;
const GAP = 28;
/** Room above the band for name tags, so the edge fade doesn't clip them. */
const TAG_ROOM = 60;

/** Staggered drop of each figure from the band's top, cycled (Figma). */
const OFFSETS = [56, 77, 88, 110, 88, 61, 56, 45, 31, 22, 43, 64];

const u = (px: number) => `calc(${px} * var(--u))`;

type CssVars = CSSProperties & Record<`--${string}`, string>;

// Cut-out outline in the member's colour (set as --outline on the figure).
const OUTLINE =
  "group-hover:[filter:drop-shadow(2.5px_0_0_var(--outline))_drop-shadow(-2.5px_0_0_var(--outline))_drop-shadow(0_2.5px_0_var(--outline))_drop-shadow(0_-2.5px_0_var(--outline))] group-focus:[filter:drop-shadow(2.5px_0_0_var(--outline))_drop-shadow(-2.5px_0_0_var(--outline))_drop-shadow(0_2.5px_0_var(--outline))_drop-shadow(0_-2.5px_0_var(--outline))]";

// Solid black for the outer half of the fade, then a ramp (Figma 160px / 64px).
const EDGE_FADE =
  "linear-gradient(to right, transparent calc(var(--fade) / 2), #000 var(--fade), #000 calc(100% - var(--fade)), transparent calc(100% - var(--fade) / 2))";

export function TeamFooter({ team = TEAM }: { team?: TeamMember[] }) {
  return (
    <footer className="relative z-10 overflow-x-clip bg-black [container-type:inline-size]">
      <div
        className="relative [--fade:64px] md:[--fade:160px]"
        style={
          {
            "--u": "calc(max(100cqw, 576px) / 1440)",
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
            className="flex w-max animate-team-marquee items-start focus-within:[animation-play-state:paused] hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ paddingTop: u(TAG_ROOM) }}
          >
            {[0, 1].map((copy) =>
              team.map((m, i) => (
                <TeamFigure
                  key={`${copy}-${m.image}`}
                  member={m}
                  offset={OFFSETS[i % OFFSETS.length]!}
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
  offset,
  hidden,
}: {
  member: TeamMember;
  offset: number;
  /** The loop's second copy: kept out of the tab order and screen readers. */
  hidden: boolean;
}) {
  return (
    <div
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : `${member.name}, ${member.role}`}
      className="group relative flex-none outline-none"
      style={
        {
          marginTop: u(offset),
          marginRight: u(GAP),
          height: u(FIGURE_H),
          "--outline": member.color,
        } as CssVars
      }
    >
      <img
        src={member.image}
        alt=""
        loading="lazy"
        draggable={false}
        className={`h-full w-auto select-none ${OUTLINE}`}
      />
      <NameTag member={member} />
    </div>
  );
}

function NameTag({ member }: { member: TeamMember }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[calc(100%-10px)] left-1/2 z-10 flex w-max min-w-[112px] -translate-x-1/2 flex-col items-center justify-center gap-[3px] overflow-hidden rounded-full border border-[#969696] bg-[#cacaca] px-3 py-2 opacity-0 shadow-[0px_8px_12px_0px_rgba(31,48,73,0.24),inset_0px_-14px_10px_0px_rgba(255,255,255,0.4)] transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100 md:min-w-[140px]"
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
