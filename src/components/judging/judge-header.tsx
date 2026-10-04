import Link from "next/link";

interface JudgeHeaderProps {
  name: string;
  /** "Organizer" or "Sponsor · <track>"; null while loading or for non-judges. */
  role: string | null;
  showControlRoom: boolean;
}

export function JudgeHeader({ name, role, showControlRoom }: JudgeHeaderProps) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-[#d6dbe5] bg-white px-5 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] leading-tight text-[#4a5d73]">
            Hack Western 13 · Judging
          </span>
          <span className="truncate text-lg font-bold leading-snug">
            {name}
          </span>
        </div>
        {role && (
          <span
            title={role}
            className="max-w-[55%] shrink-0 truncate rounded-full bg-[#ece7f7] px-2.5 py-1.5 text-xs font-semibold text-[#3f2a75]"
          >
            {role}
          </span>
        )}
      </header>
      {showControlRoom && (
        <Link
          href="/internal/judging"
          className="flex min-h-[44px] items-center justify-between bg-[#0b2238] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16324f] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
          <span>Control room</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  );
}
