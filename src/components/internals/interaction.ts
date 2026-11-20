// Shared interaction classes for the dashboard (Emil Kowalski's rules):
// - press: a quick, subtle scale-down so a tap feels heard (0.97, 150ms,
//   ease-out, none with reduced motion).
// - hover: hover styles only where the pointer can hover, so taps on
//   phones don't leave a "stuck" hover colour. Full class strings, so
//   Tailwind can see them; a `hover-hover:` variant in tailwind.config.ts
//   would replace these (shared config, not changed here).

export const press =
  "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out active:scale-[0.97]";

export const hover = {
  highlight: "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  highlightSubtle:
    "[@media(hover:hover)]:hover:bg-dashboard-bg-highlightSubtle",
  nav: "[@media(hover:hover)]:hover:bg-dashboard-bg-nav",
  surface: "[@media(hover:hover)]:hover:bg-dashboard-bg-surface",
  textHeavy: "[@media(hover:hover)]:hover:text-dashboard-text-heavy",
  underline: "[@media(hover:hover)]:hover:underline",
  solidBorder: "[@media(hover:hover)]:hover:border-solid",
} as const;
