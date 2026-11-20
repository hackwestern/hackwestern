import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, type RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  CELL,
  DISABLED,
  DeleteDialog,
  FIELD,
  LABEL,
  RowMenu,
  SearchBox,
  StatusName,
  errorText,
} from "~/components/live/manage-table";

type Reward = RouterOutputs["scavengerHunt"]["getScavengerHuntRewards"][number];

// Phones show only Name and Cost; the rest opens in a row below
const COLUMNS = [
  { header: "Name", mobile: true },
  { header: "Description", mobile: false },
  { header: "Cost", mobile: true },
  { header: "Left", mobile: false },
  { header: "Redeemed", mobile: false },
];

// No quantity means unlimited, so it is always in stock
const STOCK_FILTERS = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "sold_out", label: "Sold out" },
] as const;
type StockFilter = (typeof STOCK_FILTERS)[number]["value"];
const isSoldOut = (r: Reward) => r.quantity !== null && r.quantity <= 0;

const Rewards = () => {
  const [filter, setFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const [deleting, setDeleting] = useState<Reward | null>(null);

  const utils = api.useUtils();
  const { data: rewards, isLoading } =
    api.scavengerHunt.getScavengerHuntRewards.useQuery();
  const invalidate = () =>
    utils.scavengerHunt.getScavengerHuntRewards.invalidate();
  const setStatus = api.scavengerHunt.setRewardStatus.useMutation({
    onSuccess: invalidate,
  });
  const remove = api.scavengerHunt.deleteReward.useMutation({
    onSuccess: () => {
      setDeleting(null);
      void invalidate();
    },
  });

  const query = search.trim().toLowerCase();
  const rows = (rewards ?? []).filter(
    (r) =>
      (filter === "all" || (filter === "sold_out") === isSoldOut(r)) &&
      (!query || r.name.toLowerCase().includes(query)),
  );

  return (
    <div className="flex w-full flex-col gap-6 font-figtree md:min-h-0 md:flex-1">
      <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label="Filter rewards"
          className="flex flex-wrap gap-2"
        >
          {STOCK_FILTERS.map((f) => (
            <DashboardChip
              key={f.value}
              selected={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </DashboardChip>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <SearchBox
            label="Search rewards"
            value={search}
            onChange={setSearch}
          />
          <DashboardButton onClick={() => setEditing("new")}>
            New reward
          </DashboardButton>
        </div>
      </div>

      {setStatus.error && (
        <p
          role="alert"
          className="rounded-dashboard-sm bg-dashboard-bg-inset p-3 text-sm font-medium text-dashboard-text-warning"
        >
          Couldn&apos;t update the reward: {errorText(setStatus.error)}
        </p>
      )}

      {isLoading || rows.length === 0 ? (
        <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
          {isLoading ? "Loading rewards..." : "No rewards found"}
        </p>
      ) : (
        <div className="w-full overflow-x-auto md:min-h-0 md:flex-1 md:overflow-y-auto">
          <Table className="w-full font-figtree leading-default md:min-w-[720px]">
            <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-dashboard-bg-page [&_tr]:border-dashboard-border-faint">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.header}
                    className={cn(
                      "h-auto px-2 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light md:px-3",
                      !column.mobile && "hidden md:table-cell",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
                <TableHead className="w-0 px-0 md:hidden">
                  <span className="sr-only">Details</span>
                </TableHead>
                <TableHead className="w-0 px-2 md:px-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const isExpanded = expanded.has(r.id);
                // Index-based stripes, because the details row breaks odd/even
                const stripe = i % 2 === 0 && "bg-dashboard-bg-highlightSubtle";
                const details = [
                  ["Description", r.description ?? "—"],
                  [
                    "Left",
                    r.quantity === null ? "Unlimited" : String(r.quantity),
                  ],
                  ["Redeemed", String(r.redemptions)],
                ] as const;
                return (
                  <Fragment key={r.id}>
                    <TableRow
                      className={cn(
                        "border-0 hover:bg-dashboard-bg-highlight",
                        stripe,
                      )}
                    >
                      <TableCell
                        className={cn(CELL, "text-dashboard-text-heavy")}
                      >
                        <StatusName row={r} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          CELL,
                          "hidden max-w-xs text-dashboard-text-light md:table-cell",
                        )}
                      >
                        {details[0][1]}
                      </TableCell>
                      <TableCell
                        className={cn(
                          CELL,
                          "whitespace-nowrap text-dashboard-text-light",
                        )}
                      >
                        {r.costPoints} pts
                      </TableCell>
                      {details.slice(1).map(([label, value]) => (
                        <TableCell
                          key={label}
                          className={cn(
                            CELL,
                            "hidden text-dashboard-text-light md:table-cell",
                          )}
                        >
                          {value}
                        </TableCell>
                      ))}
                      <TableCell className="w-0 px-0 py-3 md:hidden">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "Show"} details for ${r.name}`}
                          onClick={() => toggleExpanded(r.id)}
                          className="flex cursor-pixel-hover rounded-dashboard-xs p-1 text-dashboard-text-light hover:bg-dashboard-bg-nav hover:text-dashboard-text-heavy"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="w-0 px-2 py-3 md:px-3">
                        <RowMenu
                          row={r}
                          onEdit={() => setEditing(r)}
                          onDelete={() => setDeleting(r)}
                          onToggleDisabled={() =>
                            setStatus.mutate({
                              id: r.id,
                              status:
                                r.status === "disabled" ? "active" : "disabled",
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className={cn("border-0 md:hidden", stripe)}>
                        <TableCell colSpan={4} className="px-2 pb-4 pt-3">
                          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                            {details.map(([label, value]) => (
                              <Fragment key={label}>
                                <dt className="text-xs font-semibold uppercase leading-5 text-dashboard-text-light">
                                  {label}
                                </dt>
                                <dd className="font-medium text-dashboard-text-light">
                                  {value}
                                </dd>
                              </Fragment>
                            ))}
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <RewardDialog
          reward={editing === "new" ? null : editing}
          rewards={rewards ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void invalidate();
          }}
        />
      )}

      <DeleteDialog
        name={deleting?.name}
        description="Past redemptions of this reward will not be deleted."
        error={remove.error}
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
      />
    </div>
  );
};

const RewardDialog = ({
  reward,
  rewards,
  onClose,
  onSaved,
}: {
  reward: Reward | null;
  rewards: Reward[]; // Checked for a duplicate name before saving
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isNew = reward === null;
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [cost, setCost] = useState(String(reward?.costPoints ?? 0));
  const [quantity, setQuantity] = useState(
    reward?.quantity == null ? "" : String(reward.quantity),
  );

  const save = api.scavengerHunt.saveReward.useMutation({
    onSuccess: onSaved,
  });

  const isDuplicateName = rewards.some(
    (r) =>
      r.id !== reward?.id && r.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const isWhole = (v: string, max: number) =>
    /^\d+$/.test(v.trim()) && Number(v) <= max;
  const costInvalid = !isWhole(cost, 32767);
  // Empty means unlimited
  const quantityInvalid =
    quantity.trim() !== "" && !isWhole(quantity, 2147483647);
  const canSave =
    name.trim() !== "" && !isDuplicateName && !costInvalid && !quantityInvalid;

  const submit = (status?: "draft" | "active") =>
    save.mutate({
      id: reward?.id,
      name,
      description,
      costPoints: Number(cost),
      quantity: quantity.trim() === "" ? null : Number(quantity),
      status,
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-dashboard-lg border-dashboard-border-default bg-dashboard-bg-surface font-figtree">
        <DialogTitle className="text-lg font-semibold text-dashboard-text-heavy">
          {isNew ? "New reward" : "Edit reward"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Set the name, description, cost and quantity of the reward.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(reward?.status === "draft" || isNew ? "active" : undefined);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Name</span>
            <input
              required
              className={FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hack Western Hoodie"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Description</span>
            <textarea
              className={cn(FIELD, "h-20 resize-none py-2")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Cost (points)</span>
              <input
                type="number"
                min={0}
                className={FIELD}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Quantity left</span>
              <input
                type="number"
                min={0}
                className={FIELD}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Unlimited"
              />
            </label>
          </div>

          {isDuplicateName && (
            <p className="text-sm text-dashboard-text-warning">
              A reward with this name already exists.
            </p>
          )}
          {costInvalid && (
            <p className="text-sm text-dashboard-text-warning">
              Cost must be a whole number from 0 to 32767.
            </p>
          )}
          {quantityInvalid && (
            <p className="text-sm text-dashboard-text-warning">
              Quantity must be a whole number, or empty for unlimited.
            </p>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-dashboard-text-warning">
              {errorText(save.error)}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {(isNew || reward.status === "draft") && (
              <DashboardButton
                type="button"
                variant="outline"
                disabled={save.isPending || !canSave}
                className={DISABLED}
                onClick={() => submit("draft")}
              >
                Save as draft
              </DashboardButton>
            )}
            <DashboardButton
              type="submit"
              disabled={save.isPending || !canSave}
              className={DISABLED}
            >
              {isNew
                ? "Create"
                : reward.status === "draft"
                  ? "Publish"
                  : "Save"}
            </DashboardButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Rewards;
