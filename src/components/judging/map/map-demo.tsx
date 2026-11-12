import { type ReactNode, useState } from "react";

import { DashboardChip } from "~/components/internals/dashboard-chip";
import { TableMap } from "~/components/judging/map/table-map";
import { PLACEHOLDER_JUDGES_SCORED } from "~/components/judging/map/map-data";
import { TableMapPrintSheet } from "~/components/judging/map/map-print";
import { card } from "~/components/judging/shared/judge-ui";

type Role = "hacker" | "judge" | "sponsor" | "organizer" | "print";

const ROLES: { id: Role; label: string; shows: string; where: string }[] = [
  {
    id: "hacker",
    label: "Hacker",
    shows:
      "Their own table is highlighted. Search finds any team or table. No track colours.",
    where: "Opened from the notification link, on the hacker Home.",
  },
  {
    id: "judge",
    label: "Judge",
    shows:
      "The next table is highlighted and the rest of their tables are marked. “Near me” zooms in. No track colours.",
    where: "Inside the judge dashboard and the judge app.",
  },
  {
    id: "sponsor",
    label: "Sponsor",
    shows: "Only their own track's block is coloured. Every other table stays plain.",
    where: "Sponsor view.",
  },
  {
    id: "organizer",
    label: "Organizer",
    shows: "Each table shows how many of its 3 judges have scored it.",
    where: "Judge dashboard and the big screen.",
  },
  {
    id: "print",
    label: "Door printout",
    shows: "Every table numbered with its track letter, readable in black and white.",
    where: "Printed backup for the door.",
  },
];

/**
 * Temporary review page: the same map as each audience sees it.
 * Every table, team, track and highlight here is a placeholder.
 */
export function TableMapDemo() {
  const [role, setRole] = useState<Role>("judge");
  const current = ROLES.find((r) => r.id === role) ?? ROLES[0];

  let map: ReactNode;
  if (role === "hacker") {
    map = (
      <TableMap
        focus={23}
        focusLabel="Your table"
        showTrackColors={false}
        showPath={false}
        searchable
        labels
      />
    );
  } else if (role === "judge") {
    map = (
      <TableMap
        focus={44}
        focusLabel="Next table"
        mine={[44, 45, 46]}
        mineLabel="Your other tables"
        showTrackColors={false}
        searchable
        listToggle
      />
    );
  } else if (role === "sponsor") {
    map = <TableMap highlightTrack="c" searchable labels listToggle />;
  } else if (role === "organizer") {
    map = (
      <TableMap
        judgesScored={PLACEHOLDER_JUDGES_SCORED}
        searchable
        labels
        listToggle
      />
    );
  } else {
    map = <TableMapPrintSheet />;
  }

  return (
    <div className="flex flex-col gap-5 font-figtree text-dashboard-text-heavy">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-3xl font-bold leading-tight">Table map</h1>
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          One map, shown the way each audience sees it. Temporary review page,
          with placeholder tables, teams and tracks.
        </p>
      </header>

      <div role="group" aria-label="View as" className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <DashboardChip
            key={r.id}
            selected={role === r.id}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </DashboardChip>
        ))}
      </div>

      {current && (
        <section className={`${card} flex flex-col gap-1 px-4 py-3`}>
          <h2 className="m-0 text-base font-bold">{current.label}</h2>
          <p className="m-0 text-base font-medium">{current.shows}</p>
          <p className="m-0 text-sm font-medium text-dashboard-text-light">
            {current.where}
          </p>
        </section>
      )}

      <section
        aria-label={`${current?.label ?? "Table"} map`}
        className={`${card} p-4`}
      >
        {map}
      </section>
    </div>
  );
}