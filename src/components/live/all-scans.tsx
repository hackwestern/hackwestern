import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { ScansTable } from "~/components/scans/scans-table";
import { DeleteDialog } from "~/components/live/manage-table";
import { api, type RouterOutputs } from "~/utils/api";

type Scan = RouterOutputs["scavengerHunt"]["getAllScans"]["scans"][number];

const SCAN_FILTERS = [
  { value: "all", label: "All" },
  { value: "meals", label: "Meals" },
  { value: "activities", label: "Activities" },
  { value: "rewards", label: "Rewards" },
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

  const [deleting, setDeleting] = useState<Scan | null>(null);
  const utils = api.useUtils();
  const onDeleted = () => {
    setDeleting(null);
    void utils.scavengerHunt.getAllScans.invalidate();
  };
  const deleteScan = api.scavengerHunt.deleteScan.useMutation({
    onSuccess: onDeleted,
  });
  const deleteRedemption = api.scavengerHunt.deleteRedemption.useMutation({
    onSuccess: onDeleted,
  });
  const remove =
    deleting?.target.kind === "redemption" ? deleteRedemption : deleteScan;

  // If scans were removed and this page no longer exists, go to the last page
  useEffect(() => {
    if (data && data.page > data.pageCount) setPage(data.pageCount);
  }, [data]);

  return (
    <>
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
        onDelete={(row) =>
          setDeleting(data?.scans.find((s) => s.id === row.id) ?? null)
        }
      />
      <DeleteDialog
        name={
          deleting ? `${deleting.event} for ${deleting.hackerName}` : undefined
        }
        description={
          deleting?.target.kind === "redemption"
            ? "The hacker gets the reward's current cost back, and the reward goes back in stock."
            : "The hacker loses the points this scan gave. If they already spent them, their balance can go below 0."
        }
        error={remove.error}
        isPending={remove.isPending}
        onConfirm={() => {
          const target = deleting?.target;
          if (target?.kind === "redemption") {
            deleteRedemption.mutate({ id: target.id });
          } else if (target) {
            deleteScan.mutate(target);
          }
        }}
        onClose={() => {
          setDeleting(null);
          deleteScan.reset();
          deleteRedemption.reset();
        }}
      />
    </>
  );
};

export default AllScans;
