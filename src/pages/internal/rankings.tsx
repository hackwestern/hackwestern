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
import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { Slider } from "~/components/ui/slider";
import { LoadingOverlay } from "~/components/ui/loading-overlay";
import { useLoadingOverlay } from "~/hooks/use-loading-overlay";

// Type for application data
type ApplicationData = {
  userId: string;
  name: string;
  email: string;
  school: string | null;
  levelOfStudy: string | null;
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
  originalRank?: number;
  rank?: number;
  quotaStatus?: string;
  weightedScore?: number;
};

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
      // Process data after refresh
      setTimeout(() => {
        processData();
      }, 100);
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
  
  // Accepted students management
  const [acceptedNumber] = useState(370); // Configurable number of accepted students

  // Local state (temporary values before applying)
  const [localWeights, setLocalWeights] = useState({
    originality: [1.0],
    technicality: [1.0],
    passion: [1.0],
    gender: [1.0],
  });

  const [localSchoolQuotas, setLocalSchoolQuotas] = useState<
    Record<string, number>
  >({});

  // Check if there are pending changes
  const hasPendingChanges = () => {
    const weightsChanged =
      localWeights.originality[0] !== weights.originality[0] ||
      localWeights.technicality[0] !== weights.technicality[0] ||
      localWeights.passion[0] !== weights.passion[0] ||
      localWeights.gender[0] !== weights.gender[0];

    const quotasChanged =
      JSON.stringify(localSchoolQuotas) !== JSON.stringify(schoolQuotas);

    return weightsChanged || quotasChanged;
  };

  // Apply filters function with loading overlay
  const applyFilters = async () => {
    await withLoading(async () => {
      setWeights(localWeights);
      setSchoolQuotas(localSchoolQuotas);
      // Process data with new settings
      processData();
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
    // Process data with reset settings
    processData();
  };

  // Export accepted emails to CSV
  const exportAcceptedEmails = () => {
    // Use the final accepted list (includes promoted students)
    const emails = finalRankings.map(student => student.email).filter(Boolean);
    
    // Create CSV content
    const csvContent = emails.join(',\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accepted-students-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Calculate weighted scores using applied weights (for actual data processing)
  const calculateWeightedScore = (application: ApplicationData) => {
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
    // genderWeight: 0 = favor women, 1.0 = no bias, 2.0 = favor men
    
    let genderMultiplier = 1.0;
    
    if (application.gender === "Male") {
      // For men: use the weight directly
      genderMultiplier = genderWeight;
    } else {
      // For women: use the inverse weight
      // This ensures that when genderWeight = 1.0, both get 1.0x (no bias)
      genderMultiplier = 2.0 - genderWeight;
    }
    
    // Apply a more aggressive bias to make the effect more visible
    // This helps overcome the natural bias in the dataset
    const biasStrength = 1.0; // Increase this to make the effect more pronounced
    genderMultiplier = 1.0 + (genderMultiplier - 1.0) * biasStrength;

    return baseWeightedScore * genderMultiplier;
  };


  // Create the final accepted list with school quotas applied
  const createAcceptedList = (data: ApplicationData[]) => {
    return createAcceptedListWithQuotas(data, schoolQuotas);
  };

  // Create the final accepted list with specific quotas
  const createAcceptedListWithQuotas = (data: ApplicationData[], quotas: Record<string, number>) => {
    const schoolCounts: Record<string, number> = {};
    const accepted: ApplicationData[] = [];
    const rejected: ApplicationData[] = [];

    // Step 1: Process students in order of their weighted ranking
    // Accept students until we hit school quotas or reach 400 students
    for (const student of data) {
      const school = student.school ?? "Unknown";
      const currentCount = schoolCounts[school] ?? 0;
      const quota = quotas[school] ?? 0; // 0 means unlimited
      
      // Check if we can accept this student
      const canAccept = quota === 0 || currentCount < quota;
      const hasSpace = accepted.length < acceptedNumber;
      
      if (canAccept && hasSpace) {
        // Student is accepted
        accepted.push({
          ...student,
          quotaStatus: "accepted",
        });
        schoolCounts[school] = currentCount + 1;
      } else {
        // Student is rejected (either quota exceeded or no space)
        rejected.push({
          ...student,
          quotaStatus: quota === 0 ? "no_space" : "quota_exceeded",
        });
      }
    }

    // Step 2: If we have space and rejected students, promote the best ones
    const spaceLeft = acceptedNumber - accepted.length;
    if (spaceLeft > 0 && rejected.length > 0) {
      // Get the best rejected students (those rejected due to quota, not merit)
      const quotaRejected = rejected.filter(s => s.quotaStatus === "quota_exceeded");
      const promoted = quotaRejected.slice(0, spaceLeft).map(student => ({
        ...student,
        quotaStatus: "promoted",
      }));
      
      // Add promoted students to accepted list
      accepted.push(...promoted);
    }

    // Debug logging
    console.log("Accepted List Debug:", {
      totalProcessed: data.length,
      accepted: accepted.length,
      rejected: rejected.length,
      spaceLeft: acceptedNumber - accepted.length,
      schoolCounts,
      promoted: accepted.filter(s => s.quotaStatus === "promoted").length,
    });

    return {
      accepted,
      rejected,
      schoolCounts,
    };
  };

  // State to store the processed results (only updated when Apply Filters is clicked)
  const [processedResults, setProcessedResults] = useState<{
    finalRankings: ApplicationData[];
    acceptedListResult: {
      accepted: ApplicationData[];
      rejected: ApplicationData[];
      schoolCounts: Record<string, number>;
    };
    genderDistribution: {
      avgScore: {
        men: number;
        women: number;
        other: number;
        total: number;
        menPercent: string;
        womenPercent: string;
        otherPercent: string;
      };
      weightedScore: {
        men: number;
        women: number;
        other: number;
        total: number;
        menPercent: string;
        womenPercent: string;
        otherPercent: string;
      };
    };
  } | null>(null);

  // Function to process data (only called when Apply Filters is clicked)
  const processData = () => {
    if (!rankingsData) return;

    // Process and rank all students by weighted score using CURRENT localWeights
    const processedData = rankingsData
      .map((application, index) => {
        // Use localWeights instead of weights for immediate processing
        const originalityWeight = localWeights.originality[0] ?? 1.0;
        const technicalityWeight = localWeights.technicality[0] ?? 1.0;
        const passionWeight = localWeights.passion[0] ?? 1.0;
        const genderWeight = localWeights.gender[0] ?? 1.0;

        // Base weighted score
        const baseWeightedScore =
          application.avgOriginality * originalityWeight +
          application.avgTechnicality * technicalityWeight +
          application.avgPassion * passionWeight;

        // Apply gender bias using current localWeights
        let genderMultiplier = 1.0;
        
        if (application.gender === "Male") {
          genderMultiplier = genderWeight;
        } else {
          genderMultiplier = 2.0 - genderWeight;
        }
        
        const biasStrength = 1.0;
        genderMultiplier = 1.0 + (genderMultiplier - 1.0) * biasStrength;

        const weightedScore = baseWeightedScore * genderMultiplier;

        return {
          ...application,
          originalRank: index + 1,
          weightedScore,
        };
      })
      .sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0)) // Sort by weighted score descending
      .map((application, index) => ({
        ...application,
        rank: index + 1, // New rank based on weighted score
      }));

    // Create the final accepted list with school quotas applied using CURRENT localSchoolQuotas
    const acceptedListResult = createAcceptedListWithQuotas(processedData, localSchoolQuotas);
    
    // Calculate gender distribution with the processed data
    const avgScoreGenderDist = getGenderDistribution(
      rankingsData.map((application, index) => ({
        ...application,
        originalRank: index + 1,
      }))
    );
    
    const weightedScoreGenderDist = getGenderDistribution(acceptedListResult.accepted);
    
    // Store the results
    setProcessedResults({
      finalRankings: acceptedListResult.accepted,
      acceptedListResult,
      genderDistribution: {
        avgScore: avgScoreGenderDist,
        weightedScore: weightedScoreGenderDist,
      },
    });
  };

  // Use processed results or fallback to empty array
  const finalRankings = processedResults?.finalRankings ?? [];
  const acceptedListResult = processedResults?.acceptedListResult ?? {
    accepted: [],
    rejected: [],
    schoolCounts: {},
  };

  // Process data when rankingsData is first loaded
  useEffect(() => {
    if (rankingsData && rankingsData.length > 0 && !processedResults) {
      processData();
    }
  }, [rankingsData]);

  // Apply search filter to the final rankings
  const filteredData = finalRankings?.filter((application) => {
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
  const getGenderDistribution = (data: ApplicationData[]) => {
    const top400 = data?.slice(0, 400) ?? [];

    const men = top400.filter((app) => app.gender === "Male").length;
    const women = top400.filter((app) => app.gender === "Female").length;
    const other = top400.filter(
      (app) =>
        app.gender === "Prefer not to say" ||
        app.gender === "—" ||
        !app.gender ||
        (app.gender && app.gender.trim() === ""),
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

  // Use gender distribution from processed results (ensures consistency)
  const avgScoreGenderDist: {
    men: number;
    women: number;
    other: number;
    total: number;
    menPercent: string;
    womenPercent: string;
    otherPercent: string;
  } = processedResults?.genderDistribution?.avgScore ?? getGenderDistribution([]);
  const weightedScoreGenderDist: {
    men: number;
    women: number;
    other: number;
    total: number;
    menPercent: string;
    womenPercent: string;
    otherPercent: string;
  } = processedResults?.genderDistribution?.weightedScore ?? getGenderDistribution([]);


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
          Click &quot;Load Rankings&quot; to fetch and display application rankings
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
              {filteredData?.length} accepted students found (showing {finalRankings?.length} total accepted)
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
              <DataTable columns={rankingsColumns} data={filteredData ?? []} />
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
                    setLocalWeights((prev) => ({
                      ...prev,
                      technicality: value,
                    }))
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
                  <span className="ml-2 text-xs font-medium text-yellow-600">
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
                      {avgScoreGenderDist.men} ({avgScoreGenderDist.menPercent}
                      %)
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
                      style={{
                        width: `${weightedScoreGenderDist.menPercent}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* School Quota Management */}
          <div className="mt-6 rounded-lg border bg-white/90 p-4 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-semibold">
              School Quota Management
            </h3>
            <div className="mb-4 text-sm text-gray-600">
              Set maximum students per school (0 = unlimited). Students beyond
              quota will be moved to the bottom.
            </div>

            {/* Get unique schools from the data */}
            {(() => {
              const uniqueSchools = Array.from(
                new Set(
                  (rankingsData ?? [])
                    .map((app) => app.school)
                    .filter((school) => school && school.trim() !== ""),
                ),
              ).sort();

              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {uniqueSchools.map((school) => (
                    <div key={school} className="flex items-center space-x-2">
                      <label className="min-w-0 flex-1 text-sm font-medium text-gray-700">
                        {school}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={localSchoolQuotas[school!] ?? ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === ""
                              ? 0
                              : parseInt(e.target.value);
                          setLocalSchoolQuotas((prev) => ({
                            ...prev,
                            [school!]: value,
                          }));
                        }}
                        className="w-20 text-center"
                        placeholder="0"
                      />
                      <span className="text-xs text-gray-500">
                        / {acceptedListResult.schoolCounts[school!] ?? 0} (
                        {(() => {
                          // Count how many students from this school are in the accepted list
                          const acceptedFromSchool =
                            finalRankings.filter(
                              (student) => student.school === school,
                            ).length;
                          return acceptedFromSchool;
                        })()}
                        )
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Quota Summary */}
            <div className="mt-4 rounded-md bg-gray-50 p-3">
              <div className="text-sm text-gray-600">
                <strong>Accepted Students:</strong> {finalRankings.length} total ({acceptedNumber} target)
              </div>
              <div className="mt-1 text-sm text-gray-600">
                <strong>Breakdown:</strong>{" "}
                {finalRankings.filter(s => s.quotaStatus === "accepted").length} accepted,{" "}
                {finalRankings.filter(s => s.quotaStatus === "promoted").length} promoted,{" "}
                {acceptedListResult.rejected.length} rejected
              </div>
              <div className="mt-1 text-sm text-gray-600">
                <strong>Status:</strong>{" "}
                {finalRankings.length === acceptedNumber ? (
                  <span className="text-green-600 font-medium">✓ Complete ({acceptedNumber} students)</span>
                ) : (
                  <span className="text-yellow-600 font-medium">
                    ⚠ {acceptedNumber - finalRankings.length} students needed
                  </span>
                )}
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
                "Apply Filters (Pending Changes)"
              ) : (
                "Apply Filters"
              )}
            </Button>
            <Button variant="primary" onClick={resetFilters} className="px-8">
              Reset Filters
            </Button>
            <Button variant="primary" onClick={exportAcceptedEmails} className="px-8">
              Export to CSV
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Rankings;
