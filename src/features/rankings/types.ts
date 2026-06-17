export type RankingApplicant = {
  userId: string;
  name: string;
  email: string;
  school: string | null;
  yearOfStudy: string | null;
  major: string | null;
  gender: string | null;
  resumeLink: string | null;
  githubLink: string | null;
  linkedInLink: string | null;
  otherLink: string | null;
  status: string;
  createdAt: Date;
  totalReviews: number;
  avgOriginality: number;
  avgTechnicality: number;
  avgPassion: number;
  totalScore: number;
  avgScore: number;
  avgScorePerReview: number;
};

export type RankingWeights = {
  originality: number;
  technicality: number;
  passion: number;
};

// A config-driven score adjustment: for the named applicant field, multiply the
// score by the factor mapped to the applicant's value. Which fields and factors
// are used is supplied at runtime from private server config, never hardcoded.
export type ScoreAdjustment = {
  field: string;
  multipliers: Record<string, number>;
};

export type SchoolQuotas = Record<string, number>;

export type RankingScenario = {
  name: string;
  targetAcceptanceCount: number;
  weights: RankingWeights;
  adjustments: ScoreAdjustment[];
  schoolQuotas: SchoolQuotas;
  exportCount: number;
};

export type QuotaStatus =
  | "accepted"
  | "filled_in"
  | "moved_down"
  | "below_cutoff"
  | "below_cutoff_quota_exceeded";

export type RankedApplicant = RankingApplicant & {
  rawRank: number;
  weightedRank: number;
  quotaAdjustedRank: number;
  rankDelta: number;
  weightedScore: number;
  quotaStatus: QuotaStatus;
  schoolQuota: number;
  schoolQuotaUsage: number;
};

export type DemographicDistribution = {
  men: number;
  women: number;
  other: number;
  total: number;
  menPercent: string;
  womenPercent: string;
  otherPercent: string;
};

export type SchoolDistributionItem = {
  school: string;
  count: number;
  percent: string;
};

export type SchoolDistribution = {
  schools: SchoolDistributionItem[];
  total: number;
};

export type RankingSummary = {
  accepted: number;
  acceptedFromOriginalCutoff: number;
  filledIn: number;
  movedDown: number;
  belowCutoff: number;
  schoolsAtQuota: number;
  totalApplicants: number;
};

export type RankingResult = {
  rankedApplicants: RankedApplicant[];
  acceptedApplicants: RankedApplicant[];
  movedDownApplicants: RankedApplicant[];
  belowCutoffApplicants: RankedApplicant[];
  schoolCounts: Record<string, number>;
  summary: RankingSummary;
  distributions: {
    raw: {
      gender: DemographicDistribution;
      school: SchoolDistribution;
    };
    applied: {
      gender: DemographicDistribution;
      school: SchoolDistribution;
    };
  };
};
