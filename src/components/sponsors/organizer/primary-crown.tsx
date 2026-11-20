import { Crown } from "lucide-react";

/**
 * The crown that marks a sponsor's main contact, always with its label
 * beside it ("Main contact"), so nobody has to guess what it means.
 */
export function PrimaryCrownIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-dashboard-text-medium">
      <Crown
        aria-hidden
        className="size-4 fill-current text-dashboard-border-task"
        strokeWidth={1.5}
      />
      {label}
    </span>
  );
}
