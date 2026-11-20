import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { ScansTable } from "~/components/scans/scans-table";
import { api } from "~/utils/api";

const SCAN_FILTERS = [
  { value: "all", label: "All" },
  { value: "meals", label: "Meals" },
  { value: "activities", label: "Activities" },
] as const;
type ScanFilterValue = (typeof SCAN_FILTERS)[number]["value"];

const AllScans = () => {
  const [filter, setFilter] = useState<ScanFilterValue>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const scansQ = api.scavengerHunt.getAllScans.useQuery(
    { filter, search: debouncedSearch, page, pageSize: 25 },
    // Keep showing the current page while the next one loads
    { placeholderData: (previous) => previous },
  );
  const data = scansQ.data;

  // If scans were removed and this page no longer exists, go to the last page
  useEffect(() => {
    if (data && data.page > data.pageCount) setPage(data.pageCount);
  }, [data]);

  return (
    <ScansTable
      scans={data?.scans ?? []}
      isLoading={scansQ.isLoading}
      filters={[...SCAN_FILTERS]}
      activeFilter={filter}
      onFilterChange={(value) => {
        setFilter(value as ScanFilterValue);
        setPage(1);
      }}
      search={search}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      pagination={
        data && {
          page: data.page,
          pageCount: data.pageCount,
          total: data.total,
          pageSize: data.pageSize,
          onPageChange: setPage,
        }
      }
    />
  );
};

export default AllScans;
