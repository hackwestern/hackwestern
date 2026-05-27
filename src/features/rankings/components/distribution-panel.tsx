import type { RankingResult } from "../types";

type DistributionPanelProps = {
  result: RankingResult | null;
  targetCount: number;
};

export function DistributionPanel({
  result,
  targetCount,
}: DistributionPanelProps) {
  const weightedGender = result?.distributions.applied.gender;
  const weightedSchools = result?.distributions.applied.school.schools ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <h3 className="font-semibold text-[#3b294f]">
          Top {targetCount} Weighted Gender Mix
        </h3>
        <div className="mt-4">
          <GenderBlock title="Weighted ranking" distribution={weightedGender} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <h3 className="font-semibold text-[#3b294f]">
          Top {targetCount} Weighted School Mix
        </h3>
        <div className="mt-4">
          <SchoolBlock title="Weighted ranking" schools={weightedSchools} />
        </div>
      </section>
    </div>
  );
}

type GenderBlockProps = {
  title: string;
  distribution:
    | {
        men: number;
        women: number;
        other: number;
        menPercent: string;
        womenPercent: string;
        otherPercent: string;
      }
    | undefined;
};

function GenderBlock({ title, distribution }: GenderBlockProps) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-gray-600">
        <Row
          label="Men"
          value={`${distribution?.men ?? 0} (${distribution?.menPercent ?? "0.0"}%)`}
        />
        <Row
          label="Women"
          value={`${distribution?.women ?? 0} (${distribution?.womenPercent ?? "0.0"}%)`}
        />
        <Row
          label="Other"
          value={`${distribution?.other ?? 0} (${distribution?.otherPercent ?? "0.0"}%)`}
        />
      </div>
    </div>
  );
}

type SchoolBlockProps = {
  title: string;
  schools: Array<{ school: string; count: number; percent: string }>;
};

function SchoolBlock({ title, schools }: SchoolBlockProps) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
        {schools.slice(0, 20).map((school) => (
          <Row
            key={school.school}
            label={school.school}
            value={`${school.count} (${school.percent}%)`}
          />
        ))}
        {schools.length === 0 && (
          <p className="text-sm text-gray-500">No distribution yet.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-gray-600">{label}</span>
      <span className="whitespace-nowrap font-semibold text-[#3b294f]">
        {value}
      </span>
    </div>
  );
}
