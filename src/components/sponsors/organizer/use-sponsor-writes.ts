import { useRef, useState } from "react";
import {
  addInFlight,
  removeInFlight,
  sponsorKey,
  sponsorStatusIn,
  withSponsorStatus,
} from "~/components/sponsors/organizer/status-writes";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import type { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";
import { api, type RouterOutputs } from "~/utils/api";

const copy = sponsorOrganizerCopy.board;

type SponsorStatus = (typeof SPONSOR_STATUS_VALUES)[number];
type Sponsor = RouterOutputs["sponsorDashboard"]["getSponsors"][number];

export type WriteNote = { tone: "ok" | "error"; text: string };

/**
 * Sponsor Day-Of writes shared by the Home and the old Sponsors board: the
 * Status column (arrival and booth pills) and "At CC workshop". Each saves
 * optimistically and locks only that sponsor's row until it settles; a
 * failure undoes just that sponsor and sets `note`.
 */
export function useSponsorWrites() {
  const utils = api.useUtils();
  const [note, setNote] = useState<WriteNote | null>(null);
  // A ref for the synchronous double-click check, state to render.
  const inFlightRef = useRef<ReadonlySet<string>>(new Set());
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());
  const setInFlightBoth = (next: ReadonlySet<string>) => {
    inFlightRef.current = next;
    setInFlight(next);
  };
  const settle = async (sponsorName: string) => {
    setInFlightBoth(removeInFlight(inFlightRef.current, sponsorName));
    // Refetch once nothing else is saving, so a refetch can't briefly
    // undo another sponsor's optimistic change.
    if (inFlightRef.current.size === 0) {
      await utils.sponsorDashboard.getSponsors.invalidate();
    }
  };

  const updateStatus = api.sponsorDashboard.setSponsorStatus.useMutation({
    onMutate: async ({ sponsorName, status }) => {
      await utils.sponsorDashboard.getSponsors.cancel();
      const prevStatus = sponsorStatusIn(
        utils.sponsorDashboard.getSponsors.getData(),
        sponsorName,
      );
      utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
        withSponsorStatus(old, sponsorName, status),
      );
      return { prevStatus };
    },
    onError: (err, { sponsorName }, context) => {
      const prevStatus = context?.prevStatus;
      if (prevStatus) {
        utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
          withSponsorStatus(old, sponsorName, prevStatus),
        );
      }
      setNote({ tone: "error", text: copy.statusFailed(err.message) });
    },
    // Sheet writes off: nothing was written, so the pill goes back on the
    // refetch. Say why instead of snapping back silently.
    onSuccess: (data) => {
      if (!data.sheetWritten && data.note) {
        setNote({
          tone: "ok",
          text: copy.statusNote(data.sponsorName, data.note),
        });
      }
    },
    onSettled: (_data, _err, { sponsorName }) => settle(sponsorName),
  });

  const withCcWorkshop = (
    old: Sponsor[] | undefined,
    sponsorName: string,
    attended: boolean,
  ) =>
    old?.map((s) =>
      s.name === sponsorName ? { ...s, atCcWorkshop: attended } : s,
    );
  const updateCcWorkshop =
    api.sponsorDashboard.setSponsorCcWorkshop.useMutation({
      onMutate: async ({ sponsorName, attended }) => {
        await utils.sponsorDashboard.getSponsors.cancel();
        utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
          withCcWorkshop(old, sponsorName, attended),
        );
      },
      onError: (err, { sponsorName, attended }) => {
        utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
          withCcWorkshop(old, sponsorName, !attended),
        );
        setNote({ tone: "error", text: copy.statusFailed(err.message) });
      },
      onSuccess: (data) => {
        if (!data.sheetWritten && data.note) {
          setNote({
            tone: "ok",
            text: copy.statusNote(data.sponsorName, data.note),
          });
        }
      },
      onSettled: (_data, _err, { sponsorName }) => settle(sponsorName),
    });

  const lock = (sponsorName: string) => {
    if (inFlightRef.current.has(sponsorKey(sponsorName))) return false;
    setInFlightBoth(addInFlight(inFlightRef.current, sponsorName));
    return true;
  };

  return {
    note,
    setNote,
    /** A status write for this sponsor is in flight. */
    pending: (sponsorName: string) => inFlight.has(sponsorKey(sponsorName)),
    changeStatus: (sponsorName: string, status: SponsorStatus) => {
      if (lock(sponsorName)) updateStatus.mutate({ sponsorName, status });
    },
    changeCcWorkshop: (sponsorName: string, attended: boolean) => {
      if (lock(sponsorName)) updateCcWorkshop.mutate({ sponsorName, attended });
    },
  };
}
