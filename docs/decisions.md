# Decisions

## 2026-10-02 — Section photos show at full height; strips sit on the seams

**Decision:** On desktop, the hero, About and Sponsors photo boxes are at least as tall as their photo at the current screen width (`height / width` of the file × `100vw`), with the old fixed heights as the minimum. Film strips overlap each seam. The page grows on wide screens (7230px → 7619px at 1440, 11072px at 2560).

**Why:** With fixed heights, wide screens cover-cropped the photos. The hero lost its bottom third, which is where the scroll path and story pins sit, so the hero scroll animation looked broken at 2560 wide. About and Sponsors lost the tops and bottoms of their photos too.

**Alternatives:**
- Keep fixed heights and anchor the hero art to the bottom: the path would stay visible but the peaks would get cropped. Rejected because the full art was wanted.
- Export one long image with the strips baked in: rejected because the hero has parallax layers, the ASCII and folders are placed per section, mobile uses different art, the file would be heavy, and the vector strips would blur.

Content placed by percentage of a section's height (the sponsors window) was moved to fixed px so it doesn't drift as sections grow.

## 2026-10-02 — Desktop content scales up on wide screens, capped at 1.33×

**Decision:** On desktop, the promo page's 1440 layout (hero text, About windows, Projects stage and title, Sponsors column and window, footer team strip) scales by `--ui-scale` = screen width ÷ 1440, clamped between 1 and 4/3. A script in `_document.tsx` sets it before first paint. From 1920 wide up, the 1.33× layout stays centred. Nothing changes at 1440 and below.

**Why:** 1440 (the Figma frame, close to a 13" MacBook) is the base size. On large displays the photos grew but the content stayed 1440-sized and looked lost. The cap keeps text near MacBook size on a 27" 2560 display, which has only ~15% smaller pixels than a MacBook.

**Alternatives:** fully proportional (1.78× at 2560 makes text look zoomed in); a gentler 1.2× cap; CSS `zoom` (affects layout, but interacts unpredictably with the `vw` units and scroll measurements the page relies on).
