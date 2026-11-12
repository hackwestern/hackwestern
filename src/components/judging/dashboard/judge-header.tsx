import Link from "next/link";

import { DashboardTag } from "~/components/internals/dashboard-tag";

interface JudgeHeaderProps {
  name: string;
  /** "Organizer" or "Sponsor · <track>"; null while loading or for non-judges. */
  role: string | null;
  showControlRoom: boolean;
}

export function JudgeHeader({ name, role, showControlRoom }: JudgeHeaderProps) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-5 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs leading-tight text-dashboard-text-light">
            Hack Western 13 · Judging
          </span>
          <span className="truncate text-lg font-semibold leading-snug text-dashboard-text-heavy">
            {name}
          </span>
        </div>
        {role && (
          <DashboardTag className="max-w-[55%] shrink-0 overflow-hidden">
            <span title={role} className="truncate">
              {role}
            </span>
          </DashboardTag>
        )}
      </header>
      {showControlRoom && (
        <Link
          href="/internal/judging"
          className="flex min-h-11 items-center justify-between bg-dashboard-text-heavy px-5 py-2.5 text-sm font-semibold text-dashboard-text-inverse hover:bg-dashboard-text-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
          <span>Control room</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  );
}
