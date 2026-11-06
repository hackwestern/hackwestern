import { useState, type ReactNode } from "react";
import { disabledRedirect } from "~/utils/redirect";
import { ArrowLeft, ArrowRight, ExternalLink, ScanLine } from "lucide-react";
import Sidebar from "~/components/live/sidebar";
import { ActivityCard } from "~/components/internals/activity-card";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { ScansTable } from "~/components/scans/scans-table";
import { toast } from "sonner";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { NotificationBadge } from "~/components/internals/notification-badge";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as tokens from "~/lib/tokens";

const WEIGHT_NAMES: Record<string, string> = {
  "400": "Regular",
  "500": "Medium",
  "600": "SemiBold",
  "700": "Bold",
};

function Showcase({
  name,
  file,
  usage,
  children,
}: {
  name: string;
  file: string;
  usage: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-dashboard-border-subtle pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-dashboard-text-heavy">
          {name}
        </h2>
        <code className="text-xs text-dashboard-text-light">{file}</code>
        <p className="max-w-[720px] text-base text-dashboard-text-medium">
          {usage}
        </p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function DashboardDesignSystem() {
  const [tagFilter, setTagFilter] = useState("Product Design");
  const [chipFilter, setChipFilter] = useState("All");
  const [scanFilter, setScanFilter] = useState("all");
  const [scanSearch, setScanSearch] = useState("");

  return (
    <div className="flex min-h-screen w-full flex-col gap-8 bg-dashboard-bg-page p-6 font-figtree font-medium leading-default md:p-12">
      <div className="flex flex-col gap-2">
        <h1 className="dashboard-display">Dashboard Design System</h1>
        <p className="max-w-[720px] text-base text-dashboard-text-medium">
          Components for the hacker and organizer dashboard (/live, /scans,
          /scan). Each section says when to use the component. For the HW13
          hacker-site theme, see /design-system.
        </p>
      </div>

      <Showcase
        name="Sidebar"
        file="components/live/sidebar.tsx"
        usage="The desktop navigation for every dashboard page. Render it once in the page layout. Its links (SectionLink in components/live/navlinks.tsx) take badge for outstanding to-dos (e.g. checklist steps left on Home) and locked for pages hackers can't open yet (before RSVP)."
      >
        <Sidebar />
      </Showcase>

      <Showcase
        name="Typography"
        file="lib/tokens.ts → dashboardTypography, styles/globals.css → .dashboard-*"
        usage={
          <>
            Every text format in the dashboard Figma, each shown in its own
            style. Repeated headings have classes: .dashboard-display for the
            Home greeting and .dashboard-h1 for other page titles (both shrink
            on mobile), and .dashboard-section-label for group headings inside a
            page (Later today, Saturday, Scan History). Apply any other format
            with style=&#123;tokens.dashboardTypography.body&#125;.
          </>
        }
      >
        <div className="dashboard-display">.dashboard-display</div>
        <div className="dashboard-h1">.dashboard-h1</div>
        <div className="dashboard-section-label">.dashboard-section-label</div>
        <div className="h-px bg-dashboard-border-subtle" />
        {Object.entries(tokens.dashboardTypography).map(([key, style]) => (
          <div key={key} className="text-dashboard-text-heavy" style={style}>
            {key} · {style.fontSize} {WEIGHT_NAMES[style.fontWeight]}
          </div>
        ))}
      </Showcase>

      <Showcase
        name="Buttons"
        file="components/internals/dashboard-button.tsx"
        usage={
          <>
            primary: the main action in a card or step (one per area). It goes
            full-width on mobile. secondary: Prev/Next pagination, which
            collapses to the icon on mobile, and is the only variant with a
            disabled style. tertiary: text links to the next or previous page in
            a flow. outline: secondary actions next to content (&quot;Message on
            Slack&quot;).
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <DashboardButton>Mark as done</DashboardButton>
          <DashboardButton>
            Open RSVP form
            <ExternalLink />
          </DashboardButton>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <DashboardButton variant="secondary">
            <ArrowLeft />
            Prev
          </DashboardButton>
          <DashboardButton variant="secondary">
            Next
            <ArrowRight />
          </DashboardButton>
          <DashboardButton variant="secondary" disabled>
            <ArrowLeft />
            Prev
          </DashboardButton>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <DashboardButton variant="tertiary">
            Next: Communications
            <ArrowRight />
          </DashboardButton>
          <DashboardButton variant="tertiary">
            <ArrowLeft />
            Back: Packing List
          </DashboardButton>
          <DashboardButton variant="outline">Message on Slack</DashboardButton>
        </div>
      </Showcase>

      <Showcase
        name="Tags"
        file="components/internals/dashboard-tag.tsx"
        usage="Small labels. Without onClick it's a static label (a mentor's skills). With onClick it's a compact filter that can be selected (filtering people by tags)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <DashboardTag>Non-interactive</DashboardTag>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["Front-End", "Back-End", "Data & AI", "Product Design"].map(
            (tag) => (
              <DashboardTag
                key={tag}
                selected={tagFilter === tag}
                onClick={() => setTagFilter(tag)}
              >
                {tag}
              </DashboardTag>
            ),
          )}
        </div>
      </Showcase>

      <Showcase
        name="Chips"
        file="components/internals/dashboard-chip.tsx"
        usage="Larger single-select filters above a list (Scan History, Choose an activity). Use tags instead when the filter sits in dense content."
      >
        <div className="flex flex-wrap items-center gap-2">
          {["All", "Activities", "Meals"].map((chip) => (
            <DashboardChip
              key={chip}
              selected={chipFilter === chip}
              onClick={() => setChipFilter(chip)}
            >
              {chip}
            </DashboardChip>
          ))}
        </div>
      </Showcase>

      <Showcase
        name="Tabs"
        file="components/ui/tabs.tsx"
        usage={<>Switches between views of the same page (schedule days).</>}
      >
        <Tabs defaultValue="friday">
          <TabsList>
            <TabsTrigger value="friday">Friday</TabsTrigger>
            <TabsTrigger value="saturday">Saturday</TabsTrigger>
            <TabsTrigger value="sunday">Sunday</TabsTrigger>
          </TabsList>
          <TabsContent value="friday">Friday content</TabsContent>
          <TabsContent value="saturday">Saturday content</TabsContent>
          <TabsContent value="sunday">Sunday content</TabsContent>
        </Tabs>
      </Showcase>

      <Showcase
        name="Checkbox"
        file="components/internals/dashboard-checkbox.tsx"
        usage="Checklist items the hacker can tick off (Hacker Checklist). Always pair it with a label."
      >
        {["Get accepted to Hack Western", "Join the Slack"].map(
          (label, index) => (
            <div key={label} className="flex items-center gap-3">
              <DashboardCheckbox
                id={`checklist-${index}`}
                defaultChecked={index === 0}
              />
              <label
                htmlFor={`checklist-${index}`}
                className="cursor-pixel-hover text-base text-dashboard-text-light"
              >
                {label}
              </label>
            </div>
          ),
        )}
      </Showcase>

      <Showcase
        name="Notification Badge"
        file="components/internals/notification-badge.tsx"
        usage="A count of outstanding items, e.g. checklist steps left. Usually shown via SectionLink's badge prop rather than on its own."
      >
        <div>
          <NotificationBadge count={4} />
        </div>
      </Showcase>

      <Showcase
        name="Activity Card"
        file="components/internals/activity-card.tsx"
        usage={
          <>
            One row per event or scan: scan history, Upcoming, and the
            organizer&apos;s activity picker. Use variant=&quot;featured&quot;
            with an action as children for the activity happening now. Pass href
            or onClick to make a row clickable. Set kind with
            activityKindFromCode(item.code).
          </>
        }
      >
        <div className="flex w-full max-w-[400px] flex-col gap-3">
          <ActivityCard
            variant="featured"
            kind="meal"
            title="Friday Dinner"
            meta="6:00 – 8:00 PM · Main Atrium"
          >
            <DashboardButton className="md:w-full">
              <ScanLine />
              Start scanning
            </DashboardButton>
          </ActivityCard>
          <ActivityCard
            kind="activity"
            title="Intro to AI Workshop"
            meta="8:00 PM · Room 1330"
            onClick={() => undefined}
          />
          <ActivityCard
            kind="meal"
            title="Friday's Dinner"
            meta="20 mins ago"
          />
        </div>
      </Showcase>

      <Showcase
        name="Panel"
        file="components/internals/dashboard-panel.tsx"
        usage="A white card that groups a block of the overview (Upcoming, Your Hacker Pass). Use it for the containers, not for list rows. Rows are Activity Cards."
      >
        <div className="flex flex-wrap items-start gap-6">
          <DashboardPanel title="Upcoming" className="w-full max-w-[400px]">
            <ActivityCard
              kind="meal"
              title="Midnight Snack"
              meta="in 30 mins"
            />
          </DashboardPanel>
        </div>
      </Showcase>

      <Showcase
        name="Scans Table"
        file="components/scans/scans-table.tsx"
        usage="The organizer's All Scans list. Pass filters, activeFilter and onFilterChange together to show the All / Meals / Activities filters above it, and search and onSearchChange together for the search box beside them; the page does the filtering and matching. Without them the table has no filter or search. It fills its container, so the page sets the width (640px in the Figma). Pass isLoading while fetching; it shows a loading message, and a 'No scans found' message for an empty scans array."
      >
        <div className="w-full max-w-[640px]">
          <ScansTable
            filters={[
              { value: "all", label: "All" },
              { value: "meals", label: "Meals" },
              { value: "activities", label: "Activities" },
            ]}
            activeFilter={scanFilter}
            search={scanSearch}
            onSearchChange={setScanSearch}
            onFilterChange={setScanFilter}
            scans={Array.from({ length: 5 }, (_, i) => ({
              id: String(i),
              hackerName: "Hacker Name",
              event: "Friday Dinner",
              scanner: "Hunter Chen",
              day: "Nov 21",
              time: "6:17 PM",
              createdAt: null,
            }))}
          />
        </div>
      </Showcase>

      <Showcase
        name="Toast (mobile only)"
        file="components/ui/sonner.tsx → Toaster (mounted in _app.tsx)"
        usage={
          <>
            Mobile views only. Organizers scan from their phones, so the toast
            only exists on the mobile scanner page and has no desktop design. It
            confirms a scan without leaving the camera. The Toaster is mounted
            once in _app.tsx, so just call <code>toast()</code> from
            &quot;sonner&quot; with the message.
          </>
        }
      >
        <div>
          <DashboardButton
            variant="outline"
            onClick={() =>
              toast(
                <span>
                  <span className="font-semibold">Jessica Wang</span> scanned
                  successfully
                </span>,
              )
            }
          >
            Show toast
          </DashboardButton>
        </div>
      </Showcase>
    </div>
  );
}

export default DashboardDesignSystem;

export const getServerSideProps = disabledRedirect;
