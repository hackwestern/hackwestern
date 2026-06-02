import { RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import type { RankingScenario } from "../types";

type ScenarioControlsProps = {
  draftScenario: RankingScenario;
  appliedScenario: RankingScenario;
  uniqueSchools: string[];
  schoolCounts: Record<string, number>;
  hasPendingChanges: boolean;
  isApplying: boolean;
  onDraftScenarioChange: (scenario: RankingScenario) => void;
  onApply: () => void;
  onReset: () => void;
};

const weightControls = [
  {
    key: "originality",
    label: "Originality",
    color: "text-blue-600",
    step: 0.05,
  },
  {
    key: "technicality",
    label: "Technicality",
    color: "text-green-600",
    step: 0.05,
  },
  {
    key: "passion",
    label: "Passion",
    color: "text-purple-600",
    step: 0.05,
  },
] as const;

export function ScenarioControls({
  draftScenario,
  appliedScenario,
  uniqueSchools,
  schoolCounts,
  hasPendingChanges,
  isApplying,
  onDraftScenarioChange,
  onApply,
  onReset,
}: ScenarioControlsProps) {
  const setWeight = (
    key: keyof RankingScenario["weights"],
    value: number[],
  ) => {
    onDraftScenarioChange({
      ...draftScenario,
      weights: {
        ...draftScenario.weights,
        [key]: value[0] ?? draftScenario.weights[key],
      },
    });
  };

  const setQuota = (school: string, value: string) => {
    const parsed = value === "" ? 0 : Math.max(0, Number.parseInt(value, 10));
    onDraftScenarioChange({
      ...draftScenario,
      schoolQuotas: {
        ...draftScenario.schoolQuotas,
        [school]: Number.isNaN(parsed) ? 0 : parsed,
      },
    });
  };

  const setNumber = (
    key: "targetAcceptanceCount" | "exportCount",
    value: string,
  ) => {
    const parsed = Math.max(1, Number.parseInt(value, 10));
    onDraftScenarioChange({
      ...draftScenario,
      [key]: Number.isNaN(parsed) ? draftScenario[key] : parsed,
    });
  };

  const totalWeight =
    draftScenario.weights.originality +
    draftScenario.weights.technicality +
    draftScenario.weights.passion;
  const weightTotalForDisplay = totalWeight > 0 ? totalWeight : 1;

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#3b294f]">
              Scenario Controls
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Changes must be applied to be visualized.
            </p>
          </div>
          <div className="flex justify-end">
            <span
              className={`rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition-opacity ${
                hasPendingChanges ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={!hasPendingChanges}
            >
              Unapplied
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Target accepted
            <Input
              type="number"
              min="1"
              value={draftScenario.targetAcceptanceCount}
              onChange={(event) =>
                setNumber("targetAcceptanceCount", event.target.value)
              }
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Export count
            <Input
              type="number"
              min="1"
              value={draftScenario.exportCount}
              onChange={(event) => setNumber("exportCount", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <h3 className="font-semibold text-[#3b294f]">Score Weights</h3>
        <div className="mt-4 space-y-5">
          {weightControls.map((control) => (
            <div key={control.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {control.label}
                </label>
                <span className={`text-sm font-bold ${control.color}`}>
                  {draftScenario.weights[control.key].toFixed(2)}x
                </span>
              </div>
              <Slider
                value={[draftScenario.weights[control.key]]}
                onValueChange={(value) => setWeight(control.key, value)}
                min={0}
                max={2}
                step={control.step}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          Orig:{" "}
          {(
            (draftScenario.weights.originality / weightTotalForDisplay) *
            100
          ).toFixed(1)}
          %, Tech:{" "}
          {(
            (draftScenario.weights.technicality / weightTotalForDisplay) *
            100
          ).toFixed(1)}
          %, Pasn:{" "}
          {(
            (draftScenario.weights.passion / weightTotalForDisplay) *
            100
          ).toFixed(1)}
          %
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <h3 className="font-semibold text-[#3b294f]">Gender Multiplier</h3>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Bias control</span>
            <span className="font-bold text-pink-600">
              {draftScenario.weights.gender.toFixed(2)}x
            </span>
          </div>
          <Slider
            value={[draftScenario.weights.gender]}
            onValueChange={(value) => setWeight("gender", value)}
            min={0}
            max={2}
            step={0.01}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Favor Women</span>
            <span>No Bias</span>
            <span>Favor Men</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#3b294f]">School Quotas</h3>
          <span className="text-xs text-gray-500">0 = unlimited</span>
        </div>
        <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {uniqueSchools.map((school) => (
            <div
              key={school}
              className="grid grid-cols-[minmax(0,1fr)_5rem_4rem] items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
            >
              <span className="truncate text-sm font-medium text-gray-700">
                {school}
              </span>
              <Input
                type="number"
                min="0"
                value={draftScenario.schoolQuotas[school] ?? ""}
                onChange={(event) => setQuota(school, event.target.value)}
                className="text-center"
                placeholder="0"
              />
              <span className="text-right text-xs text-gray-500">
                {schoolCounts[school] ?? 0} kept
              </span>
            </div>
          ))}
          {uniqueSchools.length === 0 && (
            <p className="text-sm text-gray-500">
              Load rankings to see schools.
            </p>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 flex gap-3 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur">
        <Button
          variant="primary"
          onClick={onApply}
          disabled={!hasPendingChanges || isApplying}
          className="flex-1"
        >
          {isApplying ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Applying
            </>
          ) : (
            "Apply Filters"
          )}
        </Button>
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Weighted target: {appliedScenario.targetAcceptanceCount}. Exports use
        the weighted snapshot, not draft controls.
      </p>
    </aside>
  );
}
