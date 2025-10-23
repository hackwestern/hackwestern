import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { rankingsColumns } from "~/components/columns";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import CanvasBackground from "~/components/canvas-background";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Slider } from "~/components/ui/slider";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  if (user?.type !== "organizer") {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}

const Rankings = () => {
  const {
    data: rankingsData,
    isLoading,
    refetch,
  } = api.application.getAllForRankings.useQuery(undefined, {
    enabled: false, // Don't fetch on page load
  });
  const [search, setSearch] = useState("");

  // Weight sliders state (0 to 2.0 range, default 1.0)
  const [weights, setWeights] = useState({
    originality: [1.0],
    technicality: [1.0],
    passion: [1.0],
    gender: [1.0], // Gender weight (1.0 = no bias, >1.0 = favor men, <1.0 = favor women)
  });

  // Calculate weighted scores
  const calculateWeightedScore = (application: any) => {
    const originalityWeight = weights.originality[0] ?? 1.0;
    const technicalityWeight = weights.technicality[0] ?? 1.0;
    const passionWeight = weights.passion[0] ?? 1.0;
    const genderWeight = weights.gender[0] ?? 1.0;

    // Base weighted score
    const baseWeightedScore =
      application.avgOriginality * originalityWeight +
      application.avgTechnicality * technicalityWeight +
      application.avgPassion * passionWeight;

    // Apply gender bias (1.0 = no bias, >1.0 = favor men, <1.0 = favor women)
    const genderMultiplier =
      application.gender === "Male" ? genderWeight : 2.0 - genderWeight;

    return baseWeightedScore * genderMultiplier;
  };

  const filteredData = rankingsData
    ?.map((application, index) => {
      const weightedScore = calculateWeightedScore(application);
      return {
        ...application,
        originalRank: index + 1,
        weightedScore,
      };
    })
    ?.sort((a, b) => b.weightedScore - a.weightedScore) // Sort by weighted score descending
    ?.map((application, index) => ({
      ...application,
      rank: index + 1, // New rank based on weighted score
    }))
    ?.filter((application) => {
      return (
        application.email.toLowerCase().includes(search.toLowerCase()) ||
        application.name.toLowerCase().includes(search.toLowerCase()) ||
        (application.school?.toLowerCase().includes(search.toLowerCase()) ??
          false) ||
        (application.major?.toLowerCase().includes(search.toLowerCase()) ??
          false)
      );
    });

  // Calculate gender distribution for top 400
  const getGenderDistribution = (data: any[], useWeighted = false) => {
    const top400 =
      data
        ?.slice(0, 400)
        ?.filter((app) => app.gender === "Male" || app.gender === "Female") ||
      [];

    const men = top400.filter((app) => app.gender === "Male").length;
    const women = top400.filter((app) => app.gender === "Female").length;
    const total = men + women;

    return {
      men,
      women,
      total,
      menPercent: total > 0 ? ((men / total) * 100).toFixed(1) : "0.0",
      womenPercent: total > 0 ? ((women / total) * 100).toFixed(1) : "0.0",
    };
  };

  // Get gender distribution for both scoring methods
  const avgScoreGenderDist = getGenderDistribution(
    rankingsData?.map((application, index) => ({
      ...application,
      originalRank: index + 1,
    })) || [],
  );

  const weightedScoreGenderDist = getGenderDistribution(filteredData || []);

  if (isLoading) {
    return (
      <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4">
        <CanvasBackground />
        <div className="z-10 text-xl">Loading rankings data...</div>
      </div>
    );
  }

  if (!rankingsData) {
    return (
      <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4">
        <CanvasBackground />
        <div className="z-10 mb-4 flex w-full max-w-[85vw] items-center justify-between">
          <h1 className="text-3xl">Application Rankings</h1>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Load Rankings
            </Button>
            <Link href="/internal/dashboard">
              <Button variant="primary">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
        <div className="z-10 text-xl text-gray-600">
          Click "Load Rankings" to fetch and display application rankings
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 px-4 py-4">
      <CanvasBackground />
      <div className="z-10 mb-4 flex w-full max-w-[85vw] items-center justify-between">
        <h1 className="text-3xl">Application Rankings</h1>
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link href="/internal/dashboard">
            <Button variant="primary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="z-10 mb-4 w-full max-w-[85vw]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {filteredData?.length} applications found
          </div>
          <div className="relative">
            <Input
              placeholder="Search by name, email, school, or major..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white/90 backdrop-blur-sm">
          <DataTable columns={rankingsColumns} data={filteredData ?? []} />
        </div>

        {/* Weight Adjustment Sliders - Moved to bottom */}
        <div className="mt-6 rounded-lg border bg-white/90 p-4 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">
            Score Weight Adjustment
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Originality Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Originality Weight
                </label>
                <span className="text-sm font-bold text-blue-600">
                  {(weights.originality[0] ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <Slider
                value={weights.originality}
                onValueChange={(value) =>
                  setWeights((prev) => ({ ...prev, originality: value }))
                }
                min={0}
                max={2.0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Technicality Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Technicality Weight
                </label>
                <span className="text-sm font-bold text-green-600">
                  {(weights.technicality[0] ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <Slider
                value={weights.technicality}
                onValueChange={(value) =>
                  setWeights((prev) => ({ ...prev, technicality: value }))
                }
                min={0}
                max={2.0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Passion Weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Passion Weight
                </label>
                <span className="text-sm font-bold text-purple-600">
                  {(weights.passion[0] ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <Slider
                value={weights.passion}
                onValueChange={(value) =>
                  setWeights((prev) => ({ ...prev, passion: value }))
                }
                min={0}
                max={2.0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>

          {/* Weight Summary */}
          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <div className="text-sm text-gray-600">
              <strong>Current Weight Distribution:</strong>{" "}
              {(() => {
                const origWeight = weights.originality[0] ?? 1.0;
                const techWeight = weights.technicality[0] ?? 1.0;
                const passionWeight = weights.passion[0] ?? 1.0;
                const totalWeight = origWeight + techWeight + passionWeight;
                return (
                  <>
                    Originality: {((origWeight / totalWeight) * 100).toFixed(1)}
                    % | Technicality:{" "}
                    {((techWeight / totalWeight) * 100).toFixed(1)}% | Passion:{" "}
                    {((passionWeight / totalWeight) * 100).toFixed(1)}%
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Gender Weight Adjustment */}
        <div className="mt-6 rounded-lg border bg-white/90 p-4 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">
            Gender Weight Adjustment
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Gender Bias
                </label>
                <span className="text-sm font-bold text-pink-600">
                  {(weights.gender[0] ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <Slider
                value={weights.gender}
                onValueChange={(value) =>
                  setWeights((prev) => ({ ...prev, gender: value }))
                }
                min={0}
                max={2.0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Favor Women</span>
                <span>No Bias</span>
                <span>Favor Men</span>
              </div>
              <div className="text-center text-xs text-gray-500">
                1.0 = No bias | &gt;1.0 = Favor men | &lt;1.0 = Favor women
              </div>
            </div>
          </div>
        </div>

        {/* Gender Distribution Display */}
        <div className="mt-6 rounded-lg border bg-white/90 p-4 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">
            Top 400 Gender Distribution
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Average Score Distribution */}
            <div className="space-y-3">
              <h4 className="text-md font-medium text-gray-800">
                Based on Average Score
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Men:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {avgScoreGenderDist.men} ({avgScoreGenderDist.menPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Women:</span>
                  <span className="text-sm font-bold text-pink-600">
                    {avgScoreGenderDist.women} (
                    {avgScoreGenderDist.womenPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${avgScoreGenderDist.menPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Weighted Score Distribution */}
            <div className="space-y-3">
              <h4 className="text-md font-medium text-gray-800">
                Based on Weighted Score
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Men:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {weightedScoreGenderDist.men} (
                    {weightedScoreGenderDist.menPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Women:</span>
                  <span className="text-sm font-bold text-pink-600">
                    {weightedScoreGenderDist.women} (
                    {weightedScoreGenderDist.womenPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${weightedScoreGenderDist.menPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rankings;
