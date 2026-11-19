import { TableMap } from "~/components/judging/map/table-map";

interface VenueMapProps {
  /** Every table this judge covers. */
  tables: number[];
  /** The table to go to now. */
  current: number | undefined;
  /** Tables this judge has already scored, drawn grey. */
  seen?: number[];
  /**
   * "preview": a still picture for the home page. No buttons, and a tap opens
   * the map page. "page": the map page itself, filling the screen height.
   */
  variant?: "preview" | "page";
  /** Called when the preview is tapped. */
  onOpen?: () => void;
}

/**
 * The judge's view of the room map: next table highlighted and the rest of
 * their tables marked. Track colours are off for judges.
 */
export function VenueMap({
  tables,
  current,
  seen = [],
  variant = "preview",
  onOpen,
}: VenueMapProps) {
  if (variant === "page") {
    return (
      <TableMap
        focus={current}
        focusLabel="Next table"
        mine={tables}
        mineLabel={current === undefined ? "Your tables" : "Your other tables"}
        seen={seen}
        showTrackColors={false}
        fill
        fitButton
        rotateButton
        labels
        controls={false}
      />
    );
  }
  return (
    <TableMap
      focus={current}
      focusLabel="Next table"
      mine={tables}
      mineLabel={current === undefined ? "Your tables" : "Your other tables"}
      seen={seen}
      showTrackColors={false}
      pannable={false}
      fullscreenable={false}
      controls={false}
      onOpen={onOpen}
    />
  );
}
