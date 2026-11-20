import { Clock, Coffee, MapPin, Users } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock, type CoffeeChatSetup } from "~/lib/run-of-show";

const copy = scheduleCopy.coffeeChat;

// A sponsor's coffee chat setup from the Coffee Chats sheet tab: window,
// format, how many hackers, and their room.
export function CoffeeChatSummary({
  setup,
  heading = copy.heading,
}: {
  setup: CoffeeChatSetup | null;
  heading?: string;
}) {
  const ready = setup?.windowStart && setup.windowEnd;
  return (
    <DashboardPanel>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        <Coffee aria-hidden className="size-4" strokeWidth={1.67} />
        {heading}
      </span>
      {!setup || !ready ? (
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.notSetUp}
        </p>
      ) : (
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact label={copy.labels.when} icon={<Clock aria-hidden className="size-4" />}>
            {copy.window(
              formatClock(setup.windowStart!),
              formatClock(setup.windowEnd!),
            )}
          </Fact>
          <Fact label={copy.labels.room} icon={<MapPin aria-hidden className="size-4" />}>
            {setup.room ? copy.room(setup.room) : copy.roomTbd}
          </Fact>
          <Fact label={copy.labels.format} icon={<Coffee aria-hidden className="size-4" />}>
            {copy.format(setup.durationMinutes, setup.groupSize)}
          </Fact>
          {setup.hackers !== null && (
            <Fact label={copy.labels.hackers} icon={<Users aria-hidden className="size-4" />}>
              {copy.hackers(setup.hackers)}
            </Fact>
          )}
        </dl>
      )}
    </DashboardPanel>
  );
}

function Fact({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-base text-dashboard-text-heavy">
      <dt className="flex shrink-0 text-dashboard-text-light">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
