import { useMemo, useState } from "react";
import { ScansTable } from "~/components/scans/scans-table";
import { api } from "~/utils/api";

const SCAN_FILTERS = [
  { value: "all", label: "All" },
  { value: "meals", label: "Meals" },
  { value: "activities", label: "Activities" },
];

const AllScans = () => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allQ = api.scavengerHunt.getAllScans.useQuery({ filter: "all" });
  const mealsQ = api.scavengerHunt.getAllScans.useQuery({ filter: "meals" });

  const scans = useMemo(() => {
    const all = allQ.data ?? [];
    const meals = mealsQ.data ?? [];
    const mealIds = new Set(meals.map((scan) => scan.id));
    const byFilter =
      filter === "meals"
        ? meals
        : filter === "activities"
          ? all.filter((scan) => !mealIds.has(scan.id))
          : all;

    const query = search.trim().toLowerCase();
    if (!query) return byFilter;
    return byFilter.filter(
      (scan) =>
        scan.hackerName.toLowerCase().includes(query) ||
        scan.event.toLowerCase().includes(query) ||
        scan.scanner.toLowerCase().includes(query),
    );
  }, [allQ.data, mealsQ.data, filter, search]);

  return (
    <ScansTable
      scans={scans}
      isLoading={allQ.isLoading || mealsQ.isLoading}
      filters={SCAN_FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      search={search}
      onSearchChange={setSearch}
    />
  );
};

export default AllScans;
