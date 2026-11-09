import { useState } from "react";

import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "~/components/judging/judge-ui";

type Mode = "slider" | "rubric";

const MODE_KEY = "hw13-judge-scoring-mode";

// Storage can throw (private mode, blocked site data): fall back to the slider.
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "rubric" ? "rubric" : "slider";
  } catch {
    return "slider";
  }
}

function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not persisted; the choice still applies to this team.
  }
}

const CRITERIA = [
  {
    key: "idea",
    label: "Idea",
    low: "seen it many times",
    mid: "fresh angle on a known problem",
    high: "new and clearly useful",
  },
  {
    key: "technical",
    label: "Technical",
    low: "mostly slides",
    mid: "core feature works live",
    high: "hard problem, works end to end",
  },
  {
    key: "design",
    label: "Design",
    low: "hard to follow",
    mid: "clear enough to use",
    high: "polished and intuitive",
  },
  {
    key: "pitch",
    label: "Pitch",
    low: "unclear what it does",
    mid: "clear demo",
    high: "compelling, handled questions",
  },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

/** What gets saved (0–100) and how it reads back to the judge ("72", "14/20"). */
export interface ScoreChoice {
  score: number;
  label: string;
}

export type ScoringBusy = "submit-next" | "submit-pause" | "skip" | null;

interface JudgeScoringProps {
  busy: ScoringBusy;
  onSubmit: (choice: ScoreChoice, then: "next" | "pause") => void;
  onSkip: () => void;
}

/** Score + actions for the team being judged. Keyed by team, so it resets per team. */
export function JudgeScoring({ busy, onSubmit, onSkip }: JudgeScoringProps) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [sliderScore, setSliderScore] = useState(70);
  const [ratings, setRatings] = useState<Partial<Record<CriterionKey, number>>>(
    {},
  );
  const [guideOpen, setGuideOpen] = useState(false);

  const picked = CRITERIA.filter((c) => ratings[c.key] !== undefined).length;
  // Shown in the submit label ("Submit 14/20 & next team"), as in the mock.
  const total = CRITERIA.reduce((sum, c) => sum + (ratings[c.key] ?? 0), 0);
  const complete = mode === "slider" || picked === CRITERIA.length;
  // 4 criteria x 1–5 = 4–20, stretched onto the 0–100 score the backend stores.
  const choice: ScoreChoice =
    mode === "slider"
      ? { score: sliderScore, label: String(sliderScore) }
      : { score: Math.round(((total - 4) / 16) * 100), label: `${total}/20` };
  const disabled = busy !== null;

  const pickMode = (next: Mode) => {
    setMode(next);
    saveMode(next);
  };

  return (
    <>
      <section
        aria-label="Score this team"
        className={`${card} flex flex-col gap-2 px-3.5 py-3`}
      >
        <div className="flex items-center justify-between gap-3">
          <div role="group" aria-label="Scoring method" className="flex">
            {(["slider", "rubric"] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => pickMode(m)}
                className={`min-h-[44px] border-[1.5px] px-4 text-sm font-semibold ${
                  i === 0 ? "rounded-l-xl" : "-ml-[1.5px] rounded-r-xl"
                } ${
                  mode === m
                    ? "relative border-[#5b3fa0] bg-[#5b3fa0] text-white"
                    : "border-[#c3cad8] bg-white text-[#0b2238] hover:bg-[#f6f7fa]"
                } ${focusRing}`}
              >
                {m === "slider" ? "Slider" : "Rubric"}
              </button>
            ))}
          </div>
          {mode === "rubric" && (
            <button
              type="button"
              aria-expanded={guideOpen}
              aria-controls="rubric-guide"
              onClick={() => setGuideOpen((o) => !o)}
              className={`min-h-[44px] text-sm font-bold text-[#5b3fa0] hover:text-[#3f2a75] ${focusRing}`}
            >
              {guideOpen ? "Hide what 1–5 mean" : "What do 1–5 mean?"}
            </button>
          )}
        </div>

        {mode === "slider" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="judge-score"
                className="text-[15px] font-semibold"
              >
                Score
              </label>
              <output
                htmlFor="judge-score"
                className="text-[40px] font-bold tabular-nums leading-none text-[#3f2a75]"
              >
                {sliderScore}
              </output>
            </div>
            <input
              id="judge-score"
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderScore}
              onChange={(e) => setSliderScore(Number(e.target.value))}
              className={`h-11 w-full cursor-pointer accent-[#5b3fa0] ${focusRing}`}
            />
            <div className="flex justify-between text-xs text-[#4a5d73]">
              <span>0 weak</span>
              <span>50 solid</span>
              <span>100 best</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {CRITERIA.map((c) => (
              <div
                key={c.key}
                role="group"
                aria-labelledby={`rubric-${c.key}`}
                className="grid grid-cols-[76px_repeat(5,minmax(0,1fr))] items-center gap-[5px]"
              >
                <span id={`rubric-${c.key}`} className="text-[15px] font-bold">
                  {c.label}
                </span>
                {[1, 2, 3, 4, 5].map((value) => {
                  const on = ratings[c.key] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${c.label} ${value} of 5`}
                      onClick={() =>
                        setRatings((r) => ({ ...r, [c.key]: value }))
                      }
                      className={`min-h-[44px] rounded-[10px] border-[1.5px] text-lg font-bold ${
                        on
                          ? "border-[#5b3fa0] bg-[#5b3fa0] text-white"
                          : "border-[#c3cad8] bg-white text-[#0b2238] hover:bg-[#f6f7fa]"
                      } ${focusRing}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            ))}
            {guideOpen && (
              <dl
                id="rubric-guide"
                className="flex flex-col gap-2 text-xs leading-snug text-[#4a5d73]"
              >
                {CRITERIA.map((c) => (
                  <div key={c.key} className="flex flex-col gap-px">
                    <dt className="font-bold text-[#0b2238]">{c.label}</dt>
                    <dd>
                      1 {c.low} · 3 {c.mid} · 5 {c.high}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        disabled={!complete || disabled}
        onClick={() => onSubmit(choice, "next")}
        className={primaryButton}
      >
        {busy === "submit-next"
          ? "Saving…"
          : complete
            ? `Submit ${choice.label} & next team`
            : `${picked} of 4 scored`}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!complete || disabled}
          onClick={() => onSubmit(choice, "pause")}
          className={secondaryButton}
        >
          {busy === "submit-pause" ? "Saving…" : "Submit & pause"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onSkip}
          className={secondaryButton}
        >
          {busy === "skip" ? "Skipping…" : "Skip: not there"}
        </button>
      </div>
    </>
  );
}
