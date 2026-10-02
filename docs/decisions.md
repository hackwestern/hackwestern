# Decisions

## 2026-10-02 — Section photos show at full height; strips sit on the seams

**Decision:** On desktop, the hero, About and Sponsors photo boxes are at least as tall as their photo at the current screen width (`height / width` of the file × `100vw`), with the old fixed heights as the minimum. Film strips overlap each seam. The page grows on wide screens (7230px → 7619px at 1440, 11072px at 2560).

**Why:** With fixed heights, wide screens cover-cropped the photos. The hero lost its bottom third, which is where the scroll path and story pins sit, so the hero scroll animation looked broken at 2560 wide. About and Sponsors lost the tops and bottoms of their photos too.

**Alternatives:**
- Keep fixed heights and anchor the hero art to the bottom: the path would stay visible but the peaks would get cropped. Rejected because the full art was wanted.
- Export one long image with the strips baked in: rejected because the hero has parallax layers, the ASCII and folders are placed per section, mobile uses different art, the file would be heavy, and the vector strips would blur.

Content placed by percentage of a section's height (the sponsors window) was moved to fixed px so it doesn't drift as sections grow.
