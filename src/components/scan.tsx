"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ScanLine } from "lucide-react";
import { api, type RouterOutputs } from "~/utils/api";
import { formatEventTime } from "~/lib/date";
import { ActivityCard } from "~/components/internals/activity-card";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";

type Item = RouterOutputs["scavengerHunt"]["getAllScavengerHuntItems"][number];

const FILTERS: { value: Item["type"] | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "meal", label: "Meals" },
  { value: "workshop", label: "Workshops" },
  { value: "sponsor_workshop", label: "Sponsor Workshops" },
  { value: "activity", label: "Activities" },
  { value: "bonus", label: "Bonus" },
];

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

// Ex: "6:00 – 8:00 PM · Rm 1230", or "No set time · Rm 1230"
const itemMeta = (item: Item) => {
  if (!item.startsAt || !item.endsAt) {
    return ["No set time", item.room].filter(Boolean).join(" · ");
  }
  const start = formatEventTime(item.startsAt, TIME);
  const end = formatEventTime(item.endsAt, TIME);
  const sameHalf = start.slice(-2) === end.slice(-2);
  const when = `${sameHalf ? start.slice(0, -3) : start} – ${end}`;
  return [when, item.room].filter(Boolean).join(" · ");
};

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const Scan = () => {
  const router = useRouter();
  const now = useNow();
  const [filter, setFilter] = useState<Item["type"] | "all">("all");
  const { data: items, isLoading } =
    api.scavengerHunt.getAllScavengerHuntItems.useQuery();

  const active = (items ?? []).filter(
    (item) => item.deletedAt === null || item.deletedAt > now,
  );
  const byStart = (a: Item, b: Item) =>
    (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0);

  // An item with no set time is never happening now
  const happeningNow = active
    .filter(
      (item) =>
        item.startsAt &&
        item.endsAt &&
        item.startsAt <= now &&
        item.endsAt > now,
    )
    .sort(byStart);

  const listed = active.filter((item) => {
    if (happeningNow.includes(item)) return false;
    return filter === "all" || item.type === filter;
  });

  // Section order: later today, one group per upcoming day, no set time, past items
  const today = formatEventTime(now, { dateStyle: "short" });
  const upcoming = new Map<string, Item[]>();
  const untimed: Item[] = [];
  const earlier: Item[] = [];
  for (const item of [...listed].sort(byStart)) {
    if (!item.startsAt || !item.endsAt) {
      untimed.push(item);
    } else if (item.endsAt <= now) {
      earlier.unshift(item);
    } else {
      const day = formatEventTime(item.startsAt, { dateStyle: "short" });
      const label =
        day === today
          ? "Later today"
          : formatEventTime(item.startsAt, { weekday: "long" });
      upcoming.set(label, [...(upcoming.get(label) ?? []), item]);
    }
  }
  const groups = [
    ...upcoming.entries(),
    ["No set time", untimed] as const,
    ["Earlier", earlier] as const,
  ].filter(([, group]) => group.length > 0);

  const openScanner = (item: Item) => {
    void router.push(`/scan/${item.id}`);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-dashboard-bg-page md:flex-row">
      <Topbar title="Scan" isOrganizer />
      <Sidebar isOrganizer />
      <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-10 pt-6 font-figtree md:gap-10 md:p-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="dashboard-h1">Choose an activity</h1>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              variant="outline"
              onClick={() => {
                void router.push("/scavenger/redeem");
              }}
            >
              Redeem Points
            </DashboardButton>
            <DashboardButton
              variant="outline"
              onClick={() => {
                void router.push("/scan/project");
              }}
            >
              Hardware return
            </DashboardButton>
          </div>
        </header>

        <div className="flex flex-col gap-6 md:max-w-[640px]">
          {happeningNow.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="dashboard-section-label flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-dashboard-status-live"
                />
                Happening now
              </h2>
              {happeningNow.map((item) => (
                <ActivityCard
                  key={item.id}
                  variant="featured"
                  kind={item.type === "meal" ? "meal" : "activity"}
                  title={item.name}
                  meta={itemMeta(item)}
                >
                  <DashboardButton
                    className="md:w-full"
                    onClick={() => openScanner(item)}
                  >
                    <ScanLine />
                    Start scanning
                  </DashboardButton>
                </ActivityCard>
              ))}
            </section>
          )}

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

          {isLoading || groups.length === 0 ? (
            <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
              {isLoading ? "Loading activities..." : "No activities found"}
            </p>
          ) : (
            groups.map(([label, group]) => (
              <section key={label} className="flex flex-col gap-2">
                <h2 className="dashboard-section-label">{label}</h2>
                {group.map((item) => (
                  <ActivityCard
                    key={item.id}
                    kind={item.type === "meal" ? "meal" : "activity"}
                    title={item.name}
                    meta={itemMeta(item)}
                    onClick={() => openScanner(item)}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Scan;
