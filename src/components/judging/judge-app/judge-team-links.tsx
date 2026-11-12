import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, touch } from "~/components/judging/shared/judge-ui";
import { type TeamLinks } from "~/server/api/utils/judge-data";

/**
 * GitHub and Devpost buttons for the team being scored. Each opens in a new tab
 * so the judge doesn't lose their sliders. Shows a short note when the
 * team submitted neither link.
 */
export function JudgeTeamLinks({ links }: { links: TeamLinks | undefined }) {
  const items = [
    { label: "GitHub", href: links?.github ?? null },
    { label: "Devpost", href: links?.devpost ?? null },
  ].filter((i): i is { label: string; href: string } => i.href !== null);

  return (
    <section
      aria-label="Project links"
      className={`${card} flex flex-col gap-2 px-3.5 py-3`}
    >
      {items.length === 0 ? (
        <p className="m-0 text-sm font-medium text-dashboard-text-light">
          This team hasn&apos;t added a GitHub or Devpost link.
        </p>
      ) : (
        <div className="flex gap-2">
          {items.map((item) => (
            <DashboardButton
              key={item.label}
              asChild
              variant="outline"
              className={`${touch} flex-1`}
            >
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </DashboardButton>
          ))}
        </div>
      )}
    </section>
  );
}