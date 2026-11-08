"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import { ActivityCard } from "~/components/internals/activity-card";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "meals", label: "Meals" },
  { value: "activities", label: "Activities" },
];

const Scan = () => {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const { data: items, isLoading } =
    api.scavengerHunt.getAllScavengerHuntItems.useQuery();

  const filteredItems = (items ?? []).filter((item) => {
    if (filter === "meals") return item.type === "meal";
    if (filter === "activities") return item.type !== "meal";
    return true;
  });

  return (
    <div className="flex h-screen w-screen flex-col bg-dashboard-bg-page md:flex-row">
      <Topbar title="Scan" isOrganizer />
      <Sidebar isOrganizer />
      <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-10 pt-6 font-figtree md:gap-10 md:p-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="dashboard-h1">Choose an activity</h1>
          <DashboardButton
            variant="outline"
            onClick={() => {
              void router.push("/scavenger/redeem");
            }}
          >
            Redeem Points
          </DashboardButton>
        </header>

        <div className="flex flex-col gap-6 md:max-w-[640px]">
          <div
            role="group"
            aria-label="Filter activities"
            className="flex flex-wrap gap-2"
          >
            {FILTERS.map((option) => (
              <DashboardChip
                key={option.value}
                selected={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </DashboardChip>
            ))}
          </div>

          {isLoading || filteredItems.length === 0 ? (
            <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
              {isLoading ? "Loading activities..." : "No activities found"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map((item) => (
                <ActivityCard
                  key={item.id}
                  kind={item.type === "meal" ? "meal" : "activity"}
                  title={item.description ?? item.code}
                  onClick={() => {
                    void router.push(`/scan/${item.id}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Scan;
