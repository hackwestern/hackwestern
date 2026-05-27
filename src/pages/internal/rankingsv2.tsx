import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import CanvasBackground from "~/components/canvas-background";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { LoadingOverlay } from "~/components/ui/loading-overlay";
import { defaultRankingScenario } from "~/features/rankings/config";
import { DistributionPanel } from "~/features/rankings/components/distribution-panel";
import { ExportPanel } from "~/features/rankings/components/export-panel";
import { ImpactSummary } from "~/features/rankings/components/impact-summary";
import { RankingsTable } from "~/features/rankings/components/rankings-table";
import { ScenarioControls } from "~/features/rankings/components/scenario-controls";
import { getUniqueSchools, rankApplicants } from "~/features/rankings/ranking-engine";
import type {
  RankingApplicant,
  RankingResult,
  RankingScenario,
} from "~/features/rankings/types";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";

function cloneDefaultScenario(): RankingScenario {
  return {
    ...defaultRankingScenario,
    weights: { ...defaultRankingScenario.weights },
    schoolQuotas: { ...defaultRankingScenario.schoolQuotas },
  };
}

function normalizeScenario(scenario: RankingScenario): RankingScenario {
  return {
    ...scenario,
    targetAcceptanceCount: Math.max(1, scenario.targetAcceptanceCount),
    exportCount: Math.max(1, scenario.exportCount),
    weights: { ...scenario.weights },
    schoolQuotas: Object.fromEntries(
      Object.entries(scenario.schoolQuotas).filter(([, quota]) => quota > 0),
    ),
  };
}

function searchApplicants(applicants: RankingResult["rankedApplicants"], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return applicants;

  return applicants.filter((applicant) => {
    return (
      applicant.name.toLowerCase().includes(query) ||
      applicant.email.toLowerCase().includes(query) ||
      (applicant.school?.toLowerCase().includes(query) ?? false) ||
      (applicant.major?.toLowerCase().includes(query) ?? false) ||
      (applicant.levelOfStudy?.toLowerCase().includes(query) ?? false)
    );
  });
}

function scenariosEqual(a: RankingScenario, b: RankingScenario) {
  return JSON.stringify(normalizeScenario(a)) === JSON.stringify(normalizeScenario(b));
}

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

export default function RankingsV2() {
  const {
    data: rankingsData,
    isFetching,
    refetch,
  } = api.application.getAllForRankings.useQuery(undefined, {
    enabled: false,
  });

  const [draftScenario, setDraftScenario] = useState<RankingScenario>(() =>
    cloneDefaultScenario(),
  );
  const [appliedScenario, setAppliedScenario] = useState<RankingScenario>(() =>
    cloneDefaultScenario(),
  );
  const [appliedResult, setAppliedResult] = useState<RankingResult | null>(null);
  const [search, setSearch] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const applicants = useMemo(
    () => (rankingsData ?? []) as RankingApplicant[],
    [rankingsData],
  );
  const uniqueSchools = useMemo(() => getUniqueSchools(applicants), [applicants]);
  const visibleApplicants = useMemo(
    () => searchApplicants(appliedResult?.rankedApplicants ?? [], search),
    [appliedResult, search],
  );
  const hasPendingChanges = !scenariosEqual(draftScenario, appliedScenario);

  const applyScenario = (scenario: RankingScenario, data = applicants) => {
    const normalizedScenario = normalizeScenario(scenario);
    setIsApplying(true);
    try {
      setAppliedScenario(normalizedScenario);
      setDraftScenario(normalizedScenario);
      setAppliedResult(rankApplicants(data, normalizedScenario));
    } finally {
      setIsApplying(false);
    }
  };

  const handleLoad = async () => {
    const result = await refetch();
    const loadedApplicants = (result.data ?? []) as RankingApplicant[];
    applyScenario(appliedScenario, loadedApplicants);
  };

  const handleApply = () => {
    applyScenario(draftScenario);
  };

  const handleReset = () => {
    applyScenario(cloneDefaultScenario());
  };

  return (
    <main className="bg-hw-linear-gradient-day min-h-screen bg-primary-100 px-4 py-5">
      <CanvasBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-[92rem] flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-purple-700">
              Internal Tool
            </div>
            <h1 className="mt-1 text-3xl font-bold text-[#3b294f]">
              Application Rankings v2
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Build a stable weighted ranking snapshot, apply school quotas, and
              export from the weighted result. Search narrows the table without
              changing each applicant&apos;s true rank.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={handleLoad}
              disabled={isFetching || isApplying}
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching || isApplying ? "animate-spin" : ""}`}
              />
              {rankingsData ? "Refresh" : "Load Rankings"}
            </Button>
            <Link href="/internal/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>
        </header>

        <ImpactSummary
          result={appliedResult}
          targetCount={appliedScenario.targetAcceptanceCount}
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#3b294f]">
                    Weighted Ranking
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Showing {visibleApplicants.length} of{" "}
                    {appliedResult?.rankedApplicants.length ?? 0} applicants.
                    Ranked by weighted score.
                  </p>
                </div>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search name, email, school, major..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9 pr-10"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            <LoadingOverlay
              isLoading={isFetching || isApplying}
              loadingText={isFetching ? "Loading rankings..." : "Applying filters..."}
            >
              <RankingsTable applicants={visibleApplicants} />
            </LoadingOverlay>

            <DistributionPanel
              result={appliedResult}
              targetCount={appliedScenario.targetAcceptanceCount}
            />

            <ExportPanel
              appliedScenario={appliedScenario}
              appliedApplicants={appliedResult?.rankedApplicants ?? []}
            />
          </div>

          <ScenarioControls
            draftScenario={draftScenario}
            appliedScenario={appliedScenario}
            uniqueSchools={uniqueSchools}
            schoolCounts={appliedResult?.schoolCounts ?? {}}
            hasPendingChanges={hasPendingChanges}
            isApplying={isApplying}
            onDraftScenarioChange={setDraftScenario}
            onApply={handleApply}
            onReset={handleReset}
          />
        </div>
      </div>
    </main>
  );
}
