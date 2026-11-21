import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  addInFlight,
  removeInFlight,
  sponsorKey,
} from "~/components/sponsors/organizer/status-writes";
import {
  applyPins,
  sponsorWritePins,
} from "~/components/sponsors/organizer/write-pins";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import type { SponsorStatus } from "~/lib/sponsor-status";
import { api, type RouterOutputs } from "~/utils/api";

const copy = sponsorOrganizerCopy.board;

type Sponsor = RouterOutputs["sponsorDashboard"]["getSponsors"][number];

export type WriteNote = { tone: "ok" | "error"; text: string };

/** How often the sponsor board re-reads the sheet. */
const SHEET_SPONSORS_REFRESH_MS = 30_000;

/**
 * The organizer board's sheet sponsors (getSponsors), with this page's own
 * recent writes kept over what the server answers (write-pins.ts), so a
 * poll served by a server instance with an older copy can't flip a pill
 * back. Every getSponsors reader on the board uses this.
 */
export function useSheetSponsors() {
  const pins = useSyncExternalStore(
    sponsorWritePins.subscribe,
    sponsorWritePins.get,
    sponsorWritePins.get,
  );
  const select = useCallback(
    (data: Sponsor[]) => applyPins(data, pins, Date.now()),
    [pins],
  );
  return api.sponsorDashboard.getSponsors.useQuery(undefined, {
    refetchInterval: SHEET_SPONSORS_REFRESH_MS,
    select,
  });
}

/**
 * Sponsor Day-Of writes shared by the Home and the old Sponsors board: the
 * Status column (arrival and booth pills) and "At CC workshop". Each shows
 * at once (a pin, see useSheetSponsors) and locks only that sponsor's row
 * until it settles; a failure drops just that sponsor's pin and sets
 * `note`.
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
    // One refetch once nothing else is saving (a burst of taps reads the
    // sheet once); the pins hold every new value meanwhile.
    if (inFlightRef.current.size === 0) {
      await utils.sponsorDashboard.getSponsors.invalidate();
    }
  };

  // Not written (sheet writes off): the pill goes back on the refetch.
  // Say why instead of snapping back silently.
  const notWritten = (data: {
    sponsorName: string;
    sheetWritten: boolean;
    note?: string;
  }) => {
    if (!data.sheetWritten && data.note) {
      setNote({
        tone: "ok",
        text: copy.statusNote(data.sponsorName, data.note),
      });
    }
  };

  const updateStatus = api.sponsorDashboard.setSponsorStatus.useMutation({
    onMutate: async ({ sponsorName, status }) => {
      await utils.sponsorDashboard.getSponsors.cancel();
      sponsorWritePins.pin(sponsorName, "status", status);
    },
    onError: (err, { sponsorName }) => {
      sponsorWritePins.unpin(sponsorName, "status");
      setNote({ tone: "error", text: copy.statusFailed(err.message) });
    },
    onSuccess: (data, { sponsorName, status }) => {
      // Pinned from now, not from the tap: a slow write still gets the
      // full window over other instances' older copies.
      if (data.sheetWritten)
        sponsorWritePins.pin(sponsorName, "status", status);
      else sponsorWritePins.unpin(sponsorName, "status");
      notWritten(data);
    },
    onSettled: (_data, _err, { sponsorName }) => settle(sponsorName),
  });

  const updateCcWorkshop =
    api.sponsorDashboard.setSponsorCcWorkshop.useMutation({
      onMutate: async ({ sponsorName, attended }) => {
        await utils.sponsorDashboard.getSponsors.cancel();
        sponsorWritePins.pin(sponsorName, "atCcWorkshop", attended);
      },
      onError: (err, { sponsorName }) => {
        sponsorWritePins.unpin(sponsorName, "atCcWorkshop");
        setNote({ tone: "error", text: copy.statusFailed(err.message) });
      },
      onSuccess: (data, { sponsorName, attended }) => {
        if (data.sheetWritten) {
          sponsorWritePins.pin(sponsorName, "atCcWorkshop", attended);
        } else sponsorWritePins.unpin(sponsorName, "atCcWorkshop");
        notWritten(data);
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
