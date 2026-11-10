import { TableMap } from "~/components/judging/map/table-map";

interface VenueMapProps {
  /** Every table this judge covers. */
  tables: number[];
  /** The table to go to now. */
  current: number | undefined;
}

/**
 * The judge's view of the room map: next table highlighted, the rest of their
 * tables marked, track blocks in colour. "Near me" zooms in on the next table.
 */
export function VenueMap({ tables, current }: VenueMapProps) {
  return (
    <TableMap
      focus={current}
      focusLabel="Next table"
      mine={tables}
      mineLabel="Your other tables"
      showTrackColors={false}
      zoomable
    />
  );
}