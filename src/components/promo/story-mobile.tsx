import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { Window } from "~/components/internals/window";
import { PIN_DATA } from "./hero-path";

/**
 * Mobile version of the hero's story: the three "You have a message" windows
 * that desktop opens from pins along the mountain path, in the same order
 * (PIN_DATA). Shown below `sm`.
 *
 * It sits right after the hero inside a shared wrapper where the hero is
 * sticky (see index.tsx), and overlays it with a pinned, full-screen stage.
 * Scrolling rolls the windows up from the bottom of the screen one at a time;
 * each settles below the hero's sign-up button on top of the last, a title bar
 * lower, while the one before it fades away. Once all three are in, the
 * wrapper ends and the hero, the stack and everything below scroll on together
 * into "Discover past projects".
 */

// How much lower each window rests than the one before: a title bar's worth.
const STACK_OFFSET = 34;
// Least space kept between the bottom of the stack and the bottom of the
// screen, if the stack is too tall to sit centred below the hero's button.
const BOTTOM_GUTTER = 10;

type Phase = { start: number; rest: number };

/**
 * Where each window comes to rest (its top, on the stage) and the stretch of
 * scroll it rises over, laid end to end. The stack rests centred in the space
 * between `ceiling` (the bottom of the hero's sign-up button) and the bottom
 * of the screen, dropping lower only if it wouldn't otherwise fit.
 */
function planStack(heights: number[], screen: number, ceiling: number) {
  const stackHeight = Math.max(...heights.map((h, i) => i * STACK_OFFSET + h));
  const firstTop = Math.min(
    ceiling + (screen - ceiling - stackHeight) / 2,
    screen - BOTTOM_GUTTER - stackHeight,
  );
  let cursor = 0;
  const phases: Phase[] = heights.map((_, i) => {
    const rest = firstTop + i * STACK_OFFSET;
    const phase = { start: cursor, rest };
    cursor += screen - rest; // rises 1:1 with the scroll from the bottom edge
    return phase;
  });
  return { phases, total: cursor };
}

/** How far a window has risen, 0 (below the screen) to 1 (at rest). */
const riseProgress = (scrolled: number, phase: Phase, screen: number) =>
  Math.min(1, Math.max(0, (scrolled - phase.start) / (screen - phase.rest)));

export function MobileStoryStack() {
  const reduceMotion = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);
  const windowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [scrollLength, setScrollLength] = React.useState(0);

  React.useEffect(() => {
    const section = sectionRef.current;
    const els = windowRefs.current;
    if (reduceMotion === true || !section || els.some((el) => !el)) return;

    let screen = window.innerHeight;
    let plan = planStack([], screen, 0);
    // The hero's sign-up button: the stack rests in the space below it.
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");

    const place = () => {
      const scrolled = Math.min(
        Math.max(-section.getBoundingClientRect().top, 0),
        plan.total,
      );
      const rise = plan.phases.map((ph) => riseProgress(scrolled, ph, screen));
      els.forEach((el, i) => {
        const { rest } = plan.phases[i]!;
        const top = screen - (screen - rest) * rise[i]!;
        // Fades out as the next window rolls up over it.
        const fade = 1 - (rise[i + 1] ?? 0);
        el!.style.transform = `translateY(${top}px)`;
        el!.style.opacity = String(fade);
        el!.style.pointerEvents = fade > 0 ? "" : "none";
      });
    };
    const measure = () => {
      screen = window.innerHeight;
      // Where the button sits while pinned: the stage and the hero are pinned
      // together, so its offset from the stage's top is fixed.
      const ceiling = cta
        ? cta.getBoundingClientRect().bottom -
          section.getBoundingClientRect().top
        : 0;
      plan = planStack(
        els.map((el) => el!.offsetHeight),
        screen,
        ceiling,
      );
      setScrollLength(plan.total);
      place();
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };

    measure();
    // Capture, so this hears whichever element scrolls the page (on mobile
    // it's <body>, not the window).
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", measure);
    const resize = new ResizeObserver(measure);
    els.forEach((el) => resize.observe(el!));
    if (cta) resize.observe(cta);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", measure);
      resize.disconnect();
    };
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <section className="relative z-10 flex flex-col gap-16 px-[10px] pb-[10px] sm:hidden">
        {PIN_DATA.map((pin) => (
          <StoryWindow key={pin.title} title={pin.title} body={pin.body} />
        ))}
      </section>
    );
  }

  return (
    // Pulled up a screen so the stage overlays the (sticky) hero from the
    // start; its height is that screen plus the scroll the windows use.
    <section
      ref={sectionRef}
      className="pointer-events-none relative z-10 -mt-[100svh] sm:hidden"
      style={{ height: `calc(100svh + ${scrollLength}px)` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {PIN_DATA.map((pin, i) => (
          <div
            key={pin.title}
            ref={(el) => {
              windowRefs.current[i] = el;
            }}
            // Parked below the screen until the scroll script places it.
            className="pointer-events-auto absolute inset-x-[10px] top-0 translate-y-[100svh] will-change-transform"
          >
            <StoryWindow title={pin.title} body={pin.body} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Same window and type as the desktop story pins (StoryPin in hero.tsx). */
function StoryWindow({ title, body }: { title: string; body: string }) {
  return (
    <Window fluid draggable={false} disableControls title="You have a message">
      <div className="flex flex-col gap-2 px-5 py-4 text-left">
        <h2 className="font-cossetteTexte text-[22px] font-bold leading-tight tracking-[-0.02em] text-[#111]">
          {title}
        </h2>
        <p className="font-figtree text-[16px] leading-normal text-[#555]">
          {body}
        </p>
      </div>
    </Window>
  );
}
