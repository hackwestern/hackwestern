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
import { LoadingOverlay } from "~/components/ui/loading-overlay";
import { useLoadingOverlay } from "~/hooks/use-loading-overlay";

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
  const { isLoading: isOverlayLoading, withLoading } = useLoadingOverlay();

  // Handle refresh with loading overlay
  const handleRefresh = async () => {
    await withLoading(async () => {
      await refetch();
    });
  };

  // Applied state (what's currently being used for calculations)
  const [weights, setWeights] = useState({
    originality: [1.0],
    technicality: [1.0],
    passion: [1.0],
    gender: [1.0], // Gender weight (1.0 = no bias, >1.0 = favor men, <1.0 = favor women)
  });

  const [schoolQuotas, setSchoolQuotas] = useState<Record<string, number>>({});

  // Local state (temporary values before applying)
  const [localWeights, setLocalWeights] = useState({
    originality: [1.0],
    technicality: [1.0],
    passion: [1.0],
    gender: [1.0],
  });

  const [localSchoolQuotas, setLocalSchoolQuotas] = useState<Record<string, number>>({});

  // Check if there are pending changes
  const hasPendingChanges = () => {
    const weightsChanged = 
      localWeights.originality[0] !== weights.originality[0] ||
      localWeights.technicality[0] !== weights.technicality[0] ||
      localWeights.passion[0] !== weights.passion[0] ||
      localWeights.gender[0] !== weights.gender[0];
    
    const quotasChanged = JSON.stringify(localSchoolQuotas) !== JSON.stringify(schoolQuotas);
    
    return weightsChanged || quotasChanged;
  };

  // Apply filters function with loading overlay
  const applyFilters = async () => {
    await withLoading(async () => {
      setWeights(localWeights);
      setSchoolQuotas(localSchoolQuotas);
    });
  };

  // Reset filters function
  const resetFilters = () => {
    const defaultWeights = {
      originality: [1.0],
      technicality: [1.0],
      passion: [1.0],
      gender: [1.0],
    };
    setLocalWeights(defaultWeights);
    setLocalSchoolQuotas({});
    setWeights(defaultWeights);
    setSchoolQuotas({});
  };

  // Calculate weighted scores using applied weights (for actual data processing)
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

  // Calculate weighted scores using local weights (for preview only - no expensive operations)
  const calculatePreviewWeightedScore = (application: any) => {
    const originalityWeight = localWeights.originality[0] ?? 1.0;
    const technicalityWeight = localWeights.technicality[0] ?? 1.0;
    const passionWeight = localWeights.passion[0] ?? 1.0;
    const genderWeight = localWeights.gender[0] ?? 1.0;

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
    const top400 = data?.slice(0, 400) || [];

    const men = top400.filter((app) => app.gender === "Male").length;
    const women = top400.filter((app) => app.gender === "Female").length;
    const other = top400.filter((app) => 
      app.gender === "Prefer not to say" || 
      app.gender === "—" || 
      !app.gender || 
      app.gender.trim() === ""
    ).length;
    const total = men + women + other;

    return {
      men,
      women,
      other,
      total,
      menPercent: total > 0 ? ((men / total) * 100).toFixed(1) : "0.0",
      womenPercent: total > 0 ? ((women / total) * 100).toFixed(1) : "0.0",
      otherPercent: total > 0 ? ((other / total) * 100).toFixed(1) : "0.0",
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

  // Apply school quotas to rankings
  const applySchoolQuotas = (data: any[]) => {
    const schoolCounts: Record<string, number> = {};
    const quotaExceeded: any[] = [];
    const accepted: any[] = [];

    // Process each student in order of their weighted ranking
    data.forEach((student) => {
      const school = student.school || "Unknown";
      const currentCount = schoolCounts[school] || 0;
      const quota = schoolQuotas[school] || 0; // 0 means unlimited

      if (quota === 0 || currentCount < quota) {
        // Student is accepted
        accepted.push({
          ...student,
          quotaStatus: "accepted",
        });
        schoolCounts[school] = currentCount + 1;
      } else {
        // Quota exceeded, student is rejected
        quotaExceeded.push({
          ...student,
          quotaStatus: "quota_exceeded",
        });
      }
    });

    // Add extras to maintain exactly 400 students in top 400
    const extrasNeeded = Math.max(0, 400 - accepted.length);
    
    // Get the next best students from the original data (after the first 400)
    const allStudents = data;
    const studentsAfterTop400 = allStudents.slice(400); // Students ranked 401+
    const extras = studentsAfterTop400.slice(0, extrasNeeded).map((student, index) => ({
      ...student,
      quotaStatus: "promoted_extra",
    }));

    // Remaining quota exceeded students
    const remainingQuotaExceeded = quotaExceeded.slice(extrasNeeded);

    // Debug logging
    console.log("Quota Debug:", {
      accepted: accepted.length,
      quotaExceeded: quotaExceeded.length,
      extrasNeeded,
      extras: extras.length,
      schoolCounts
    });

    return { 
      accepted, 
      quotaExceeded: remainingQuotaExceeded, 
      extras,
      schoolCounts 
    };
  };

  // Apply quotas to the weighted rankings
  const quotaResults = applySchoolQuotas(filteredData || []);
  
  // Create the top 400 with accepted students + extras
  const top400 = [...quotaResults.accepted, ...quotaResults.extras];
  
  // Assign new ranks to the top 400
  const top400WithRanks = top400.map((student, index) => ({
    ...student,
    rank: index + 1,
  }));
  
  // Create final rankings: top 400 + remaining quota exceeded
  const finalRankings = [...top400WithRanks, ...quotaResults.quotaExceeded];

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
              onClick={handleRefresh}
              disabled={isLoading || isOverlayLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading || isOverlayLoading ? "animate-spin" : ""}`}
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
    <>
      <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 px-4 py-4">
        <CanvasBackground />
        <div className="z-10 mb-4 flex w-full max-w-[85vw] items-center justify-between">
        <h1 className="text-3xl">Application Rankings</h1>
        <div className="flex gap-3">
          <Button 
            variant="primary" 
            onClick={handleRefresh}
            disabled={isLoading || isOverlayLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading || isOverlayLoading ? "animate-spin" : ""}`}
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
        
        <LoadingOverlay 
          isLoading={isOverlayLoading} 
          loadingText="Refreshing rankings data..."
        >
          <div className="overflow-x-auto rounded-lg border bg-white/90 backdrop-blur-sm">
            <DataTable columns={rankingsColumns} data={finalRankings ?? []} />
          </div>
        </LoadingOverlay>

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
                  {(localWeights.originality[0] ?? 1.0).toFixed(2)}x
                </span>
              </div>
              <Slider
                value={localWeights.originality}
                onValueChange={(value) =>
                  setLocalWeights((prev) => ({ ...prev, originality: value }))
                }
                min={0}
                max={2.0}
                step={0.05}
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
                  {(localWeights.technicality[0] ?? 1.0).toFixed(2)}x
                </span>
              </div>
              <Slider
                value={localWeights.technicality}
                onValueChange={(value) =>
                  setLocalWeights((prev) => ({ ...prev, technicality: value }))
                }
                min={0}
                max={2.0}
                step={0.05}
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
                  {(localWeights.passion[0] ?? 1.0).toFixed(2)}x
                </span>
              </div>
              <Slider
                value={localWeights.passion}
                onValueChange={(value) =>
                  setLocalWeights((prev) => ({ ...prev, passion: value }))
                }
                min={0}
                max={2.0}
                step={0.05}
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
              <strong>Preview Weight Distribution:</strong>{" "}
              {hasPendingChanges() && (
                <span className="ml-2 text-xs text-yellow-600 font-medium">
                  (Changes pending - click Apply to update)
                </span>
              )}
            </div>
              {(() => {
                const origWeight = localWeights.originality[0] ?? 1.0;
                const techWeight = localWeights.technicality[0] ?? 1.0;
                const passionWeight = localWeights.passion[0] ?? 1.0;
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
                  {(localWeights.gender[0] ?? 1.0).toFixed(2)}x
                </span>
              </div>
              <Slider
                value={localWeights.gender}
                onValueChange={(value) =>
                  setLocalWeights((prev) => ({ ...prev, gender: value }))
                }
                min={0}
                max={2.0}
                step={0.05}
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Other:</span>
                  <span className="text-sm font-bold text-gray-600">
                    {avgScoreGenderDist.other} (
                    {avgScoreGenderDist.otherPercent}%)
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Other:</span>
                  <span className="text-sm font-bold text-gray-600">
                    {weightedScoreGenderDist.other} (
                    {weightedScoreGenderDist.otherPercent}%)
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

        {/* School Quota Management */}
        <div className="mt-6 rounded-lg border bg-white/90 p-4 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold">School Quota Management</h3>
          <div className="mb-4 text-sm text-gray-600">
            Set maximum students per school (0 = unlimited). Students beyond quota will be moved to the bottom.
          </div>
          
          {/* Get unique schools from the data */}
          {(() => {
            const uniqueSchools = Array.from(
              new Set(
                (rankingsData || [])
                  .map((app) => app.school)
                  .filter((school) => school && school.trim() !== "")
              )
            ).sort();

            return (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {uniqueSchools.map((school) => (
                  <div key={school} className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700 min-w-0 flex-1">
                      {school}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={localSchoolQuotas[school!] || ""}
                      onChange={(e) => {
                        const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                        setLocalSchoolQuotas((prev) => ({
                          ...prev,
                          [school!]: value,
                        }));
                      }}
                      className="w-20 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">
                      / {quotaResults.schoolCounts[school!] || 0} ({(() => {
                        // Count how many students from this school are in the top 400 (accepted)
                        const acceptedFromSchool = quotaResults.accepted.filter(
                          (student) => student.school === school
                        ).length;
                        return acceptedFromSchool;
                      })()})
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Quota Summary */}
          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <div className="text-sm text-gray-600">
              <strong>Quota Summary:</strong>{" "}
              {quotaResults.accepted.length} accepted, {quotaResults.extras.length} promoted extras, {quotaResults.quotaExceeded.length} quota exceeded
            </div>
            <div className="text-sm text-gray-600 mt-1">
              <strong>Top 400 Status:</strong>{" "}
              {quotaResults.accepted.length + quotaResults.extras.length} total in top 400 (400 target)
            </div>
            <div className="text-sm text-gray-600 mt-1">
              <strong>Debug:</strong>{" "}
              Extras needed: {Math.max(0, 400 - quotaResults.accepted.length)}, 
              Total quota exceeded: {quotaResults.extras.length + quotaResults.quotaExceeded.length}
            </div>
          </div>
        </div>

        {/* Apply/Reset Filters Buttons */}
        <div className="mt-6 flex justify-center gap-4">
          <Button 
            variant="primary" 
            onClick={applyFilters}
            className="px-8"
            disabled={!hasPendingChanges() || isOverlayLoading}
          >
            {isOverlayLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Applying Filters...
              </>
            ) : hasPendingChanges() ? (
              'Apply Filters (Pending Changes)'
            ) : (
              'Apply Filters'
            )}
          </Button>
          <Button 
            variant="primary" 
            onClick={resetFilters}
            className="px-8"
          >
            Reset Filters
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};

export default Rankings;
