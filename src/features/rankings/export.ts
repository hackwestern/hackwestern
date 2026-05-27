import type { RankedApplicant, RankingScenario } from "./types";

function escapeCsvField(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadTextFile(
  contents: string,
  filename: string,
  type = "text/plain",
) {
  const blob = new Blob([contents], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function buildEmailCsv(applicants: RankedApplicant[]) {
  return ["Email", ...applicants.map((applicant) => applicant.email)].join("\n");
}

export function buildDetailedCsv(applicants: RankedApplicant[]) {
  const header = [
    "Weighted Rank",
    "Pre-Quota Weighted Rank",
    "Quota Shift",
    "Name",
    "Email",
    "School",
    "Gender",
    "Status",
    "Quota Status",
    "Avg Originality",
    "Avg Technicality",
    "Avg Passion",
    "Avg Score Per Review",
    "Weighted Score",
    "School Quota",
    "School Quota Usage",
  ];

  const rows = applicants.map((applicant) =>
    [
      applicant.quotaAdjustedRank,
      applicant.weightedRank,
      applicant.rankDelta,
      applicant.name,
      applicant.email,
      applicant.school ?? "Unknown",
      applicant.gender ?? "Not specified",
      applicant.status,
      applicant.quotaStatus,
      applicant.avgOriginality.toFixed(1),
      applicant.avgTechnicality.toFixed(1),
      applicant.avgPassion.toFixed(1),
      applicant.avgScorePerReview.toFixed(1),
      applicant.weightedScore.toFixed(1),
      applicant.schoolQuota || "Unlimited",
      applicant.schoolQuotaUsage,
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export function buildScenarioJson(scenario: RankingScenario) {
  return JSON.stringify(scenario, null, 2);
}

export function datedFilename(prefix: string, extension: string) {
  return `${prefix}-${new Date().toISOString().split("T")[0]}.${extension}`;
}
