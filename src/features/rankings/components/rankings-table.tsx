import Link from "next/link";
import type { RankedApplicant } from "../types";

type RankingsTableProps = {
  applicants: RankedApplicant[];
};

const quotaLabels: Record<RankedApplicant["quotaStatus"], string> = {
  accepted: "Accepted",
  filled_in: "Filled in",
  moved_down: "Moved down",
  below_cutoff: "Below cutoff",
  below_cutoff_quota_exceeded: "Below cutoff, quota full",
};

const quotaClasses: Record<RankedApplicant["quotaStatus"], string> = {
  accepted: "bg-green-100 text-green-800",
  filled_in: "bg-blue-100 text-blue-800",
  moved_down: "bg-red-100 text-red-800",
  below_cutoff: "bg-gray-100 text-gray-700",
  below_cutoff_quota_exceeded: "bg-orange-100 text-orange-800",
};

export function RankingsTable({ applicants }: RankingsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-sm backdrop-blur">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-wide text-gray-500">
            <tr className="border-b">
              <th className="px-4 py-3">Weighted Rank</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3 text-right">Weighted Score</th>
              <th className="px-4 py-3 text-right">Quota Shift</th>
              <th className="px-4 py-3">Quota</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {applicants.map((applicant) => {
              const isAcceptedInQuota =
                applicant.quotaStatus === "accepted" ||
                applicant.quotaStatus === "filled_in";

              return (
                <tr key={applicant.userId} className="hover:bg-purple-50/60">
                  <td className="px-4 py-3">
                    <div
                      className={`text-lg font-bold ${
                        isAcceptedInQuota ? "text-green-600" : "text-[#3b294f]"
                      }`}
                    >
                      #{applicant.quotaAdjustedRank}
                    </div>
                    <div className="text-xs text-gray-500">
                      pre-quota #{applicant.weightedRank}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/internal/review?applicant=${applicant.userId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#3b294f] hover:text-purple-700"
                    >
                      {applicant.name || "Unnamed applicant"}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {applicant.email}
                    </div>
                  </td>
                  <td className="max-w-56 px-4 py-3">
                    <div className="truncate">
                      {applicant.school ?? "Unknown"}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {applicant.major ?? "Major not specified"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{applicant.gender ?? "Not set"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">
                    {applicant.weightedScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        applicant.rankDelta > 0
                          ? "text-green-700"
                          : applicant.rankDelta < 0
                            ? "text-red-700"
                            : "text-gray-500"
                      }
                    >
                      {applicant.rankDelta > 0 ? "+" : ""}
                      {applicant.rankDelta}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${quotaClasses[applicant.quotaStatus]}`}
                    >
                      {quotaLabels[applicant.quotaStatus]}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      {applicant.schoolQuota
                        ? `${applicant.schoolQuotaUsage}/${applicant.schoolQuota}`
                        : "Unlimited"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {applicant.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
            {applicants.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  No applicants match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
