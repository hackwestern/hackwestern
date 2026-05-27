import type { RankingResult } from "../types";

type ImpactSummaryProps = {
  result: RankingResult | null;
  targetCount: number;
};

export function ImpactSummary({ result, targetCount }: ImpactSummaryProps) {
  const summary = result?.summary;

  const cards = [
    {
      label: "Accepted",
      value: summary?.accepted ?? 0,
      detail: `Target ${targetCount}`,
    },
    {
      label: "Filled In",
      value: summary?.filledIn ?? 0,
      detail: "Moved into accepted range",
    },
    {
      label: "Moved Down",
      value: summary?.movedDown ?? 0,
      detail: "Past school quota",
    },
    {
      label: "Schools At Quota",
      value: summary?.schoolsAtQuota ?? 0,
      detail: "Active quota caps",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {card.label}
          </div>
          <div className="mt-2 text-3xl font-bold text-[#3b294f]">
            {card.value}
          </div>
          <div className="mt-1 text-xs text-gray-500">{card.detail}</div>
        </div>
      ))}
    </div>
  );
}
