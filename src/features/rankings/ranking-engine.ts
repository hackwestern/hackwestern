import type {
  DemographicDistribution,
  RankedApplicant,
  RankingApplicant,
  RankingResult,
  RankingScenario,
  SchoolDistribution,
} from "./types";

const UNKNOWN_SCHOOL = "Unknown";

function getSchool(applicant: RankingApplicant) {
  const school = applicant.school?.trim();
  return school && school.length > 0 ? school : UNKNOWN_SCHOOL;
}

function roundScore(score: number) {
  return Math.round(score * 10) / 10;
}

export function calculateWeightedScore(
  applicant: RankingApplicant,
  scenario: RankingScenario,
) {
  const baseWeightedScore =
    applicant.avgOriginality * scenario.weights.originality +
    applicant.avgTechnicality * scenario.weights.technicality +
    applicant.avgPassion * scenario.weights.passion;

  const genderMultiplier =
    applicant.gender === "Male"
      ? scenario.weights.gender
      : applicant.gender == null || applicant.gender === "Prefer not to answer"
        ? 1
        : 2 - scenario.weights.gender;

  return baseWeightedScore * genderMultiplier;
}

export function getUniqueSchools(applicants: RankingApplicant[]) {
  return Array.from(
    new Set(
      applicants
        .map((applicant) => applicant.school?.trim())
        .filter((school): school is string => Boolean(school)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function getDemographicDistribution(
  applicants: Pick<RankingApplicant, "gender">[],
  limit: number,
): DemographicDistribution {
  const selected = applicants.slice(0, limit);
  const men = selected.filter(
    (applicant) => applicant.gender === "Male",
  ).length;
  const women = selected.filter(
    (applicant) => applicant.gender === "Female",
  ).length;
  const other = selected.length - men - women;
  const total = selected.length;
  const percent = (count: number) =>
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return {
    men,
    women,
    other,
    total,
    menPercent: percent(men),
    womenPercent: percent(women),
    otherPercent: percent(other),
  };
}

export function getSchoolDistribution(
  applicants: Pick<RankingApplicant, "school">[],
  limit: number,
): SchoolDistribution {
  const selected = applicants.slice(0, limit);
  const counts = selected.reduce<Record<string, number>>((acc, applicant) => {
    const schoolName = applicant.school?.trim();
    const school =
      schoolName && schoolName.length > 0 ? schoolName : UNKNOWN_SCHOOL;
    acc[school] = (acc[school] ?? 0) + 1;
    return acc;
  }, {});

  const schools = Object.entries(counts)
    .map(([school, count]) => ({
      school,
      count,
      percent:
        selected.length > 0
          ? ((count / selected.length) * 100).toFixed(1)
          : "0.0",
    }))
    .sort((a, b) => b.count - a.count || a.school.localeCompare(b.school));

  return {
    schools,
    total: selected.length,
  };
}

export function rankApplicants(
  applicants: RankingApplicant[],
  scenario: RankingScenario,
): RankingResult {
  const targetCount = Math.max(0, scenario.targetAcceptanceCount);
  const rawRankByUserId = new Map(
    applicants.map((applicant, index) => [applicant.userId, index + 1]),
  );

  const weightedApplicants = applicants
    .map((applicant) => ({
      ...applicant,
      rawRank: rawRankByUserId.get(applicant.userId) ?? 0,
      weightedRank: 0,
      quotaAdjustedRank: 0,
      rankDelta: 0,
      weightedScore: roundScore(calculateWeightedScore(applicant, scenario)),
      quotaStatus: "below_cutoff" as const,
      schoolQuota: scenario.schoolQuotas[getSchool(applicant)] ?? 0,
      schoolQuotaUsage: 0,
    }))
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        a.rawRank - b.rawRank ||
        a.name.localeCompare(b.name),
    )
    .map((applicant, index) => ({
      ...applicant,
      weightedRank: index + 1,
    }));

  const schoolCounts: Record<string, number> = {};
  const withinQuota: RankedApplicant[] = [];
  const movedDownApplicants: RankedApplicant[] = [];
  const belowCutoffApplicants: RankedApplicant[] = [];

  let currentIndex = 0;

  while (
    withinQuota.length < targetCount &&
    currentIndex < weightedApplicants.length
  ) {
    const applicant = weightedApplicants[currentIndex]!;
    const school = getSchool(applicant);
    const currentCount = schoolCounts[school] ?? 0;
    const quota = scenario.schoolQuotas[school] ?? 0;
    const canAccept = quota === 0 || currentCount < quota;
    const isInWeightedTop = currentIndex < targetCount;

    if (canAccept) {
      const usage = currentCount + 1;
      schoolCounts[school] = usage;
      withinQuota.push({
        ...applicant,
        quotaStatus: isInWeightedTop ? "accepted" : "filled_in",
        schoolQuota: quota,
        schoolQuotaUsage: usage,
      });
    } else if (isInWeightedTop) {
      movedDownApplicants.push({
        ...applicant,
        quotaStatus: "moved_down",
        schoolQuota: quota,
        schoolQuotaUsage: currentCount,
      });
    } else {
      belowCutoffApplicants.push({
        ...applicant,
        quotaStatus: "below_cutoff_quota_exceeded",
        schoolQuota: quota,
        schoolQuotaUsage: currentCount,
      });
    }

    currentIndex++;
  }

  while (currentIndex < weightedApplicants.length) {
    const applicant = weightedApplicants[currentIndex]!;
    const school = getSchool(applicant);
    belowCutoffApplicants.push({
      ...applicant,
      quotaStatus: "below_cutoff",
      schoolQuota: scenario.schoolQuotas[school] ?? 0,
      schoolQuotaUsage: schoolCounts[school] ?? 0,
    });
    currentIndex++;
  }

  const rankedApplicants = [
    ...withinQuota,
    ...movedDownApplicants,
    ...belowCutoffApplicants,
  ].map((applicant, index) => {
    const quotaAdjustedRank = index + 1;
    return {
      ...applicant,
      quotaAdjustedRank,
      rankDelta: applicant.weightedRank - quotaAdjustedRank,
    };
  });

  const acceptedApplicants = rankedApplicants.slice(0, targetCount);
  const acceptedFromOriginalCutoff = acceptedApplicants.filter(
    (applicant) => applicant.quotaStatus === "accepted",
  ).length;
  const filledIn = acceptedApplicants.filter(
    (applicant) => applicant.quotaStatus === "filled_in",
  ).length;
  const movedDown = rankedApplicants.filter(
    (applicant) => applicant.quotaStatus === "moved_down",
  ).length;
  const belowCutoff = rankedApplicants.length - acceptedApplicants.length;
  const schoolsAtQuota = Object.entries(scenario.schoolQuotas).filter(
    ([school, quota]) => quota > 0 && (schoolCounts[school] ?? 0) >= quota,
  ).length;

  return {
    rankedApplicants,
    acceptedApplicants,
    movedDownApplicants: rankedApplicants.filter(
      (applicant) => applicant.quotaStatus === "moved_down",
    ),
    belowCutoffApplicants: rankedApplicants.filter(
      (applicant) =>
        applicant.quotaStatus === "below_cutoff" ||
        applicant.quotaStatus === "below_cutoff_quota_exceeded",
    ),
    schoolCounts,
    summary: {
      accepted: acceptedApplicants.length,
      acceptedFromOriginalCutoff,
      filledIn,
      movedDown,
      belowCutoff,
      schoolsAtQuota,
      totalApplicants: rankedApplicants.length,
    },
    distributions: {
      raw: {
        gender: getDemographicDistribution(applicants, targetCount),
        school: getSchoolDistribution(applicants, targetCount),
      },
      applied: {
        gender: getDemographicDistribution(acceptedApplicants, targetCount),
        school: getSchoolDistribution(acceptedApplicants, targetCount),
      },
    },
  };
}
