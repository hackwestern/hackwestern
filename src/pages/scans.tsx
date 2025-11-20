"use client";

import { useState } from "react";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import { ScansTable, type ScanRow } from "~/components/scans/scans-table";

type FilterType = "all" | "meals" | "workshops" | "activities" | "attendance" | "wins" | "bonus";

const ScansPage = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch scans based on filter from the API
  const { data: scans, isLoading } = api.scavengerHunt.getAllScans.useQuery({
    filter,
  });

  // Filter by search query (API already handles filter by type)
  const filteredScans: ScanRow[] = (scans || []).filter((scan) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      scan.hackerName.toLowerCase().includes(query) ||
      scan.event.toLowerCase().includes(query) ||
      scan.scanner.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <header className="w-full space-y-4 p-6">
        <h1 className="font-dico text-3xl font-medium text-heavy">All Scans</h1>

        {/* Search Bar - Full width on mobile, positioned above categories */}
        <div className="relative w-full md:w-[40%] md:ml-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, activity, scanner"
            className="w-full rounded-lg border-2 border-white bg-[#f5f2f6] px-4 py-2 pl-10 font-figtree text-heavy placeholder:text-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-medium"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Categories - Grid layout */}
        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
              filter === "all" ? "font-bold" : "font-medium"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("meals")}
            className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
              filter === "meals" ? "font-bold" : "font-medium"
            }`}
          >
            Meals
          </button>
          <button
            onClick={() => setFilter("workshops")}
            className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
              filter === "workshops" ? "font-bold" : "font-medium"
            }`}
          >
            Workshops
          </button>
          <button
            onClick={() => setFilter("activities")}
            className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
              filter === "activities" ? "font-bold" : "font-medium"
            }`}
          >
            Activities
          </button>
          <button
            onClick={() => setFilter("attendance")}
            className={`rounded-lg bg-white px-3 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 md:px-4 ${
              filter === "attendance" ? "font-bold" : "font-medium"
            }`}
          >
            <span className="text-sm md:text-base">Winnable Activities</span>
            <span className="text-xs md:text-sm font-normal"> (Attendance)</span>
          </button>
          <button
            onClick={() => setFilter("wins")}
            className={`rounded-lg bg-white px-3 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 md:px-4 ${
              filter === "wins" ? "font-bold" : "font-medium"
            }`}
          >
            <span className="text-sm md:text-base">Winnable Activities</span>
            <span className="text-xs md:text-sm font-normal"> (Win)</span>
          </button>
          <button
            onClick={() => setFilter("bonus")}
            className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
              filter === "bonus" ? "font-bold" : "font-medium"
            }`}
          >
            Bonus
          </button>
        </div>
      </header>

      {/* Table */}
      <main className="w-full flex-1 px-6 pb-6">
        <ScansTable scans={filteredScans} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default ScansPage;
