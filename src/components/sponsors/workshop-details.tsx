import { keepNamesTogether } from "~/lib/keep-names-together";
import { Clock, MapPin, Presentation, Users } from "lucide-react";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock, type WorkshopInfo } from "~/lib/run-of-show";

const copy = scheduleCopy.workshops;
const table = scheduleCopy.organizer.workshopTable;

function whenOf(w: WorkshopInfo): string | null {
  if (!w.start) return null;
  const time = formatClock(w.start);
  return w.day ? `${w.day} ${time}` : time;
}

// A sponsor's own workshops from the "Workshops" tab: who runs each one,
// where and when, and the description hackers see.
export function WorkshopDetails({ workshops }: { workshops: WorkshopInfo[] }) {
  if (workshops.length === 0) return null;
  return (
    <section aria-labelledby="your-workshops" className="flex flex-col gap-3">
      <h2
        id="your-workshops"
        className="m-0 flex items-center gap-2 text-lg font-bold text-dashboard-text-heavy"
      >
        <Presentation aria-hidden className="size-5 text-dashboard-text-light" />
        {copy.heading}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {workshops.map((w) => (
          <li
            key={keepNamesTogether(w.title, [w.sponsor])}
            className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:p-6"
          >
            <h3 className="m-0 break-words text-base font-semibold text-dashboard-text-heavy">
              {keepNamesTogether(w.title, [w.sponsor])}
            </h3>
            <dl className="m-0 flex flex-col gap-2 text-sm">
              <Row icon={<Clock aria-hidden className="size-4" />} label={copy.when}>
                {whenOf(w) ?? copy.timeTbd}
              </Row>
              <Row icon={<MapPin aria-hidden className="size-4" />} label={copy.room}>
                {w.room ?? scheduleCopy.noLocation}
              </Row>
              <Row icon={<Users aria-hidden className="size-4" />} label={copy.runBy}>
                {w.runners.length > 0 ? w.runners.join("; ") : copy.runnersTbd}
              </Row>
            </dl>
            {w.description && (
              <p className="m-0 text-sm text-dashboard-text-medium">
                {w.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-dashboard-text-heavy">
      <dt className="flex shrink-0 pt-0.5 text-dashboard-text-light">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="m-0 break-words">{children}</dd>
    </div>
  );
}

// Organizer view: every workshop in one table (scrolls sideways on phones).
export function WorkshopsTable({ workshops }: { workshops: WorkshopInfo[] }) {
  if (workshops.length === 0) return null;
  return (
    <section aria-labelledby="all-workshops" className="flex flex-col gap-3">
      <h2 id="all-workshops" className="m-0 text-lg font-bold text-dashboard-text-heavy">
        {scheduleCopy.organizer.workshopsHeading}
      </h2>
      <div className="overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-dashboard-border-default text-xs uppercase tracking-wide text-dashboard-text-light">
              <th scope="col" className="p-3 font-semibold">{table.workshop}</th>
              <th scope="col" className="p-3 font-semibold">{table.sponsor}</th>
              <th scope="col" className="p-3 font-semibold">{table.runners}</th>
              <th scope="col" className="p-3 font-semibold">{table.when}</th>
              <th scope="col" className="p-3 font-semibold">{table.room}</th>
            </tr>
          </thead>
          <tbody>
            {workshops.map((w) => (
              <tr key={w.title} className="border-b border-dashboard-border-subtle last:border-0">
                <th scope="row" className="p-3 font-semibold text-dashboard-text-heavy">
                  {keepNamesTogether(w.title, [w.sponsor])}
                </th>
                <td className="p-3">{w.sponsor ?? table.none}</td>
                <td className="p-3">
                  {w.runners.length > 0 ? w.runners.join("; ") : table.none}
                </td>
                <td className="whitespace-nowrap p-3">{whenOf(w) ?? table.none}</td>
                <td className="p-3">{w.room ?? table.none}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
