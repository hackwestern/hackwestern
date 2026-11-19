import { Crown } from "lucide-react";

/** The crown that marks a sponsor's primary contact. */
export function PrimaryCrownIcon({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex text-dashboard-border-task"
    >
      <Crown aria-hidden className="size-4 fill-current" strokeWidth={1.5} />
    </span>
  );
}
