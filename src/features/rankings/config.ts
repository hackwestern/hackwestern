import type { RankingScenario } from "./types";

export const DEFAULT_TARGET_ACCEPTANCE_COUNT = 450;

export const defaultRankingScenario = {
  name: "Default rankings scenario",
  targetAcceptanceCount: DEFAULT_TARGET_ACCEPTANCE_COUNT,
  weights: {
    originality: 1,
    technicality: 1,
    passion: 1,
  },
  adjustments: [],
  schoolQuotas: {},
  exportCount: DEFAULT_TARGET_ACCEPTANCE_COUNT,
} satisfies RankingScenario;
