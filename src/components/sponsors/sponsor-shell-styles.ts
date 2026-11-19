/**
 * Press feedback for anything tappable on the sponsor pages and the hacker
 * coffee chats: a quick 0.97 scale on press (ease-out, 150ms), none when the
 * user asks for reduced motion. Transitions name their properties, never
 * `all`. (A shared token for the curve and scale would replace these
 * arbitrary values; see the redesign report.)
 */
export const pressable =
  "transition-[transform,background-color,border-color,color,box-shadow] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

/** Hover tint only on devices that really hover, so taps don't stick. */
export const hoverTint =
  "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight";

/** A white sponsor card (the mock's .card): the Map page's booth layout
 * and floor plans. */
export const sponsorCard =
  "rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card md:p-6";

/** The 52px tap row shared by the phone tab bar and the booth grid. */
export const tapRow = "min-h-[52px]";
