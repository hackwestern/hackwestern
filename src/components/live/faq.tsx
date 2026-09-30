import { useState } from "react";

/**
 * FAQ accordion item — Figma node 402:6367 ("Component 2").
 *
 * Notes on what changed going from a static card to an actual accordion:
 * - The Figma export renders one frozen state where the answer paragraph is
 *   `opacity-0` (closed) with no height collapse — fine for a static frame,
 *   not for a real component. Here the whole answer block (divider + text)
 *   is height-animated via a `grid-rows-[0fr]/[1fr]` wrapper so it actually
 *   collapses, not just fades invisible while reserving space.
 * - The header ("text" instance) is a `<button>` so it's keyboard- and
 *   screen-reader-operable (`aria-expanded`), not a `<div>` with an onClick.
 * - `text/text-heavy` (#042239) and `text/text-med` (#2E547A) are both
 *   registered tokens — used directly as `text-heavy` / `text-medium`.
 * - The two background gradient stops (#b8d9ff, #dcecff) and the `#c3c3c3`
 *   border don't match anything in `tokens.ts` — left as flagged arbitrary
 *   values below rather than guessing a token name for them.
 * - The "+" icon and the divider line were exported as their own SVG assets
 *   in Figma, but both are simple, effect-free shapes (no baked shadow like
 *   the hero wordmark had), so I recreated them directly as an inline SVG
 *   and a 1px divider rather than pulling in image assets for something
 *   this trivial — flagged below in case the source SVGs use a different
 *   stroke weight than what's here.
 */
interface FaqItemProps {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}

export function FaqItem({ question, answer, defaultOpen = false }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[30px] border border-[#c3c3c3]
                 bg-gradient-to-b from-[#b8d9ff] from-[72.861%] to-[#dcecff]
                 px-[20px] py-[18px] shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)]"
    >
      {/* Glass highlight band — same construction as the promo-site button's
          top gloss (rgba(255,255,255,0.7) -> rgba(255,255,255,0.14)). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[18.14px] right-[18.14px] h-[22px]
                   rounded-[100px] bg-gradient-to-b from-[rgba(255,255,255,0.7)]
                   to-[rgba(255,255,255,0.14)]"
        style={{ top: "-1px" }}
      />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="relative flex w-full items-center justify-between gap-[12px] text-left"
      >
        <p className="font-figtree text-[16px] leading-[1.5] text-heavy">{question}</p>
        <PlusIcon
          className={`size-[24px] shrink-0 text-heavy transition-transform duration-200 ${
            isOpen ? "rotate-45" : "rotate-0"
          }`}
        />
      </button>

      {/* Answer block. */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          isOpen ? "mt-[12px] grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mb-[12px] h-px w-full bg-[#c3c3c3]" /> {/* TODO: divider color assumed same as border; confirm against Line 1 asset if precision matters */}
          <p className="font-figtree text-[16px] font-medium leading-[1.5] text-medium">
            {answer}
          </p>
        </div>
      </div>

      {/* Bottom inset glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]
                   shadow-[inset_0px_-10px_20px_0px_rgba(214,250,255,0.6)]"
      />
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}