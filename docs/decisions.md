# Decisions

## 2026-10-02 — Desktop sections keep fixed heights; wide screens crop photos

**Decision:** On desktop every section keeps its 1440-design height at every screen width (hero scene 1275px, About 1109px, Projects 1167px, Sponsors 1790px). Photos fill the width and are cropped top and bottom. The hero art is cropped from the top only, so its valley, where the scroll path and story pins sit, stays in view. Content stays its 1440 size and doesn't scale up. About's windows sit in a centred 1440 box, like the Projects stage, and the Projects clouds drift across the full width.

**Why:** Letting sections grow with width (to show each photo whole, and then scaling the content 1.33× to match) made the page much taller on large displays: 11559px at 2560 vs 7230px. Fixed heights were the preferred trade-off.

**Alternatives (tried the same day, then reverted):**
- Section photos at full height, with the strips on the seams: the whole photo shows, but the page grows with width.
- Content scaling with width, capped at 1.33× (`--ui-scale`): looks like a zoomed MacBook layout, but grows height too.
- Scaling by the smaller of width ÷ 1440 and height ÷ 900: not chosen.
- One long background image with the strips baked in: rejected because the hero has parallax layers, the ASCII and folders are placed per section, mobile uses different art, the file would be heavy, and the vector strips would blur.
