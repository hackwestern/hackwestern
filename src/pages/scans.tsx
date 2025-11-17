"use client";

import { useState } from "react";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import { ScansTable, type ScanRow } from "~/components/scans/scans-table";

type FilterType = "all" | "meals" | "activities";

// Fake data for testing
const FAKE_SCANS: ScanRow[] = [
  {
    id: "1",
    hackerName: "Alex Johnson",
    event: "Friday Dinner",
    scanner: "Organizer",
    day: "Jan 17",
    time: "6:30 PM",
    createdAt: new Date(),
  },
  {
    id: "2",
    hackerName: "Sarah Chen",
    event: "AI Workshop",
    scanner: "Organizer",
    day: "Jan 18",
    time: "10:15 AM",
    createdAt: new Date(),
  },
  {
    id: "3",
    hackerName: "Marcus Williams",
    event: "Saturday Breakfast",
    scanner: "Organizer",
    day: "Jan 18",
    time: "8:00 AM",
    createdAt: new Date(),
  },
  {
    id: "4",
    hackerName: "Emily Rodriguez",
    event: "Web Development Workshop",
    scanner: "Organizer",
    day: "Jan 18",
    time: "2:45 PM",
    createdAt: new Date(),
  },
  {
    id: "5",
    hackerName: "David Kim",
    event: "Saturday Lunch",
    scanner: "Organizer",
    day: "Jan 18",
    time: "12:30 PM",
    createdAt: new Date(),
  },
  {
    id: "6",
    hackerName: "Jessica Park",
    event: "Machine Learning Workshop",
    scanner: "Organizer",
    day: "Jan 18",
    time: "3:20 PM",
    createdAt: new Date(),
  },
  {
    id: "7",
    hackerName: "Ryan Thompson",
    event: "Friday Dinner",
    scanner: "Organizer",
    day: "Jan 17",
    time: "7:00 PM",
    createdAt: new Date(),
  },
  {
    id: "8",
    hackerName: "Olivia Brown",
    event: "Design Thinking Workshop",
    scanner: "Organizer",
    day: "Jan 18",
    time: "11:00 AM",
    createdAt: new Date(),
  },
];

const ScansPage = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch scans based on filter
  // TODO: This API call is being implemented
  const { data: scans, isLoading } = api.scavengerHunt.getAllScans.useQuery({
    filter,
  });

  // Use fake data if no real data, or use fake data for testing
  const allScans = scans && scans.length > 0 ? scans : FAKE_SCANS;

  // Filter by meals/activities
  const filteredByType = allScans.filter((scan) => {
    if (filter === "all") return true;
    const mealEvents = [
      "Friday Dinner",
      "Saturday Breakfast",
      "Saturday Lunch",
    ];
    if (filter === "meals") {
      return mealEvents.includes(scan.event);
    }
    if (filter === "activities") {
      return !mealEvents.includes(scan.event);
    }
    return true;
  });

  // Filter by search query
  const filteredScans: ScanRow[] = filteredByType.filter((scan) => {
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

        {/* Tabs and Search Bar */}
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex flex-shrink-0 gap-4">
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
              onClick={() => setFilter("activities")}
              className={`rounded-lg bg-white px-4 py-2 font-figtree text-heavy transition-colors hover:bg-violet-100 ${
                filter === "activities" ? "font-bold" : "font-medium"
              }`}
            >
              Activities
            </button>
          </div>

          {/* Search Bar - Right aligned to table width */}
          <div className="relative ml-auto w-[40%]">
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
        </div>
      </header>

      {/* Table */}
      <main className="w-full flex-1 px-6 pb-6">
        <ScansTable scans={filteredScans} isLoading={false} />
      </main>
    </div>
  );
};

export default ScansPage;
