import { useState, useMemo } from "react";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";
import dynamic from "next/dynamic";
import Head from "next/head";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("~/components/analytics-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-lg border border-primary-300 bg-primary-100 font-figtree text-medium">
      Loading map…
    </div>
  ),
});

export default function AnalyticsPage() {
  const [visitorSearch, setVisitorSearch] = useState("");
  const [visitorLocationFilter, setVisitorLocationFilter] = useState("");
  const [visitVisitorFilter, setVisitVisitorFilter] = useState("");
  const [visitUrlFilter, setVisitUrlFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(
    null,
  );
  const [showFullId, setShowFullId] = useState(false);

  // Trends state
  const [trendFrom, setTrendFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [trendTo, setTrendTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [trendUrl, setTrendUrl] = useState("");

  const stats = api.analytics.getStats.useQuery();
  const visitors = api.analytics.getVisitors.useQuery({
    search: visitorSearch || undefined,
    country: visitorLocationFilter || undefined,
  });
  const visits = api.analytics.getVisits.useQuery({
    visitorId: visitVisitorFilter || undefined,
    url: visitUrlFilter || undefined,
  });
  const clicksOverTime = api.analytics.getClicksOverTime.useQuery({
    from: new Date(trendFrom),
    to: new Date(trendTo + "T23:59:59"),
    url: trendUrl || undefined,
  });
  const visitorTrend = api.analytics.getClicksOverTime.useQuery(
    {
      from: new Date(trendFrom),
      to: new Date(trendTo + "T23:59:59"),
      visitorId: selectedVisitorId ?? undefined,
    },
    { enabled: !!selectedVisitorId },
  );

  // Fill in missing days with 0 counts for a smooth line
  const chartData = useMemo(() => {
    if (!clicksOverTime.data) return [];
    const map = new Map(clicksOverTime.data.map((r) => [r.date, r.count]));
    const result: { date: string; views: number }[] = [];
    const cur = new Date(trendFrom);
    const end = new Date(trendTo);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      result.push({ date: key, views: map.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [clicksOverTime.data, trendFrom, trendTo]);

  const visitorChartData = useMemo(() => {
    if (!visitorTrend.data) return [];
    const map = new Map(visitorTrend.data.map((r) => [r.date, r.count]));
    const result: { date: string; views: number }[] = [];
    const cur = new Date(trendFrom);
    const end = new Date(trendTo);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      result.push({ date: key, views: map.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [visitorTrend.data, trendFrom, trendTo]);

  // Get the selected visitor's display name
  const selectedVisitorName = useMemo(() => {
    if (!selectedVisitorId || !visitors.data) return null;
    const v = visitors.data.find((vis) => vis.id === selectedVisitorId);
    return v?.userName ?? v?.id.slice(0, 8) + "…";
  }, [selectedVisitorId, visitors.data]);

  return (
    <>
      <Head>
        <title>PDF Analytics — Hack Western</title>
        <meta
          name="description"
          content="View PDF tracking analytics for Hack Western"
        />
      </Head>
      <main className="min-h-screen bg-primary-50 px-6 py-8 font-figtree">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-1 text-3xl font-bold text-heavy">PDF Analytics</h1>
          <p className="mb-6 text-medium">
            Track visitors and views across your public PDFs
          </p>

          {/* --- Stats Cards --- */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Visitors"
              value={stats.data?.totalVisitors}
            />
            <StatCard label="Total Views" value={stats.data?.totalVisits} />
            <StatCard label="Views (24h)" value={stats.data?.visitsToday} />
          </div>

          {/* --- Tabs --- */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Top PDFs</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="visitors">Visitors</TabsTrigger>
              <TabsTrigger value="visits">Visits</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
            </TabsList>

            {/* ---- Top PDFs ---- */}
            <TabsContent value="overview">
              <div className="mt-4 overflow-hidden rounded-xl border border-primary-300 bg-primary-100">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-medium">PDF URL</TableHead>
                      <TableHead className="text-right text-medium">
                        Views
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.data?.topUrls.map((row) => (
                      <TableRow key={row.url}>
                        <TableCell className="font-jetbrains-mono text-sm text-heavy">
                          {row.url}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emphasis">
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!stats.data?.topUrls ||
                      stats.data.topUrls.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-medium"
                        >
                          No data yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ---- Visitors ---- */}
            <TabsContent value="visitors">
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search by visitor ID…"
                    value={visitorSearch}
                    onChange={(e) => setVisitorSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  <Input
                    placeholder="Filter by country (e.g. CA, US)…"
                    value={visitorLocationFilter}
                    onChange={(e) => setVisitorLocationFilter(e.target.value)}
                    className="max-w-xs"
                  />
                  {visitorLocationFilter && (
                    <Button
                      variant="link"
                      className="text-xs text-primary-600"
                      onClick={() => setVisitorLocationFilter("")}
                    >
                      Clear ✕
                    </Button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      id="show-full-id-visitors"
                      checked={showFullId}
                      onCheckedChange={setShowFullId}
                    />
                    <Label
                      htmlFor="show-full-id-visitors"
                      className="cursor-pointer text-sm text-medium"
                    >
                      Show full Visitor ID
                    </Label>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-primary-300 bg-primary-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-medium">Visitor</TableHead>
                        <TableHead className="text-medium">Views</TableHead>
                        <TableHead className="text-medium">
                          Last Visit
                        </TableHead>
                        <TableHead className="text-medium">
                          First Visit
                        </TableHead>
                        <TableHead className="text-medium">Location</TableHead>
                        <TableHead className="text-medium">IP</TableHead>
                        <TableHead className="text-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visitors.data?.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {v.userImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/avatar?url=${encodeURIComponent(v.userImage)}`}
                                  alt=""
                                  className="h-6 w-6 rounded-full"
                                />
                              )}
                              <div>
                                {v.userName ? (
                                  <>
                                    <div className="text-sm font-medium text-heavy">
                                      {v.userName}
                                    </div>
                                    <div className="font-jetbrains-mono text-xs text-light">
                                      {v.userEmail}
                                    </div>
                                  </>
                                ) : (
                                  <span className="font-jetbrains-mono text-xs text-medium">
                                    {showFullId ? v.id : `${v.id.slice(0, 8)}…`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-emphasis">
                            {v.totalVisits}
                          </TableCell>
                          <TableCell className="text-sm text-medium">
                            {v.lastVisitAt
                              ? new Date(v.lastVisitAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-medium">
                            {new Date(v.firstVisitAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-heavy">
                            {[v.city, v.region, v.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </TableCell>
                          <TableCell className="font-jetbrains-mono text-xs text-light">
                            {v.ipAddress ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="link"
                                className="px-0 text-xs text-primary-600"
                                onClick={() => {
                                  setVisitVisitorFilter(v.id);
                                  setActiveTab("visits");
                                }}
                              >
                                View visits →
                              </Button>
                              <Button
                                variant="link"
                                className="px-0 text-xs text-primary-600"
                                onClick={() =>
                                  setSelectedVisitorId(
                                    selectedVisitorId === v.id ? null : v.id,
                                  )
                                }
                              >
                                {selectedVisitorId === v.id
                                  ? "Hide trends"
                                  : "Trends 📈"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!visitors.data || visitors.data.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-medium"
                          >
                            No visitors yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Per-visitor trend chart */}
                {selectedVisitorId && (
                  <div className="rounded-xl border border-primary-300 bg-primary-100 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-heavy">
                        Activity for{" "}
                        <span className="text-emphasis">
                          {selectedVisitorName}
                        </span>
                      </h3>
                      <Button
                        variant="link"
                        className="text-xs text-primary-600"
                        onClick={() => setSelectedVisitorId(null)}
                      >
                        Close ✕
                      </Button>
                    </div>
                    {visitorChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={visitorChartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e1c8fa"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#776780" }}
                            tickFormatter={(v) => {
                              const d = new Date(String(v) + "T00:00:00");
                              return d.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              });
                            }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "#776780" }}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              background: "#f6f3f9",
                              border: "1px solid #e1c8fa",
                              borderRadius: "8px",
                            }}
                            labelFormatter={(v) => {
                              const d = new Date(String(v) + "T00:00:00");
                              return d.toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "long",
                                day: "numeric",
                              });
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="views"
                            stroke="#a16bc7"
                            strokeWidth={2.5}
                            dot={{ fill: "#a16bc7", r: 3 }}
                            activeDot={{ r: 6, fill: "#3d214c" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[250px] items-center justify-center text-medium">
                        No activity data
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---- Visits ---- */}
            <TabsContent value="visits">
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Filter by visitor ID…"
                    value={visitVisitorFilter}
                    onChange={(e) => setVisitVisitorFilter(e.target.value)}
                    className="max-w-xs"
                  />
                  <Input
                    placeholder="Filter by URL…"
                    value={visitUrlFilter}
                    onChange={(e) => setVisitUrlFilter(e.target.value)}
                    className="max-w-xs"
                  />
                  {visitVisitorFilter && (
                    <Button
                      variant="link"
                      className="text-xs text-primary-600"
                      onClick={() => setVisitVisitorFilter("")}
                    >
                      Clear filter ✕
                    </Button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      id="show-full-id-visits"
                      checked={showFullId}
                      onCheckedChange={setShowFullId}
                    />
                    <Label
                      htmlFor="show-full-id-visits"
                      className="cursor-pointer text-sm text-medium"
                    >
                      Show full Visitor ID
                    </Label>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-primary-300 bg-primary-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-medium">Time</TableHead>
                        <TableHead className="text-medium">URL</TableHead>
                        <TableHead className="text-medium">Visitor</TableHead>
                        <TableHead className="text-medium">Location</TableHead>
                        <TableHead className="text-medium">IP</TableHead>
                        <TableHead className="text-medium">Referer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.data?.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="whitespace-nowrap text-sm text-medium">
                            {new Date(v.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-jetbrains-mono text-xs text-heavy">
                            {v.url}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {v.userImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/avatar?url=${encodeURIComponent(v.userImage)}`}
                                  alt=""
                                  className="h-5 w-5 rounded-full"
                                />
                              )}
                              <div>
                                {v.userName ? (
                                  <>
                                    <div className="text-sm font-medium text-heavy">
                                      {v.userName}
                                    </div>
                                    <div className="font-jetbrains-mono text-xs text-light">
                                      {v.userEmail}
                                    </div>
                                  </>
                                ) : (
                                  <span className="font-jetbrains-mono text-xs text-medium">
                                    {showFullId
                                      ? v.visitorId
                                      : `${v.visitorId.slice(0, 8)}…`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-heavy">
                            {[v.city, v.region, v.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </TableCell>
                          <TableCell className="font-jetbrains-mono text-xs text-light">
                            {v.ipAddress ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-light">
                            {v.referer ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!visits.data || visits.data.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-medium"
                          >
                            No visits yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ---- Trends ---- */}
            <TabsContent value="trends">
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-medium">
                      From
                    </label>
                    <input
                      type="date"
                      value={trendFrom}
                      onChange={(e) => setTrendFrom(e.target.value)}
                      className="rounded-lg border border-primary-300 bg-primary-100 px-3 py-2 font-jetbrains-mono text-sm text-heavy outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-medium">
                      To
                    </label>
                    <input
                      type="date"
                      value={trendTo}
                      onChange={(e) => setTrendTo(e.target.value)}
                      className="rounded-lg border border-primary-300 bg-primary-100 px-3 py-2 font-jetbrains-mono text-sm text-heavy outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-medium">
                      PDF URL
                    </label>
                    <Input
                      placeholder="All PDFs"
                      value={trendUrl}
                      onChange={(e) => setTrendUrl(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      className="text-xs text-primary-600"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setTrendFrom(d.toISOString().slice(0, 10));
                        setTrendTo(new Date().toISOString().slice(0, 10));
                      }}
                    >
                      7d
                    </Button>
                    <Button
                      variant="link"
                      className="text-xs text-primary-600"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setTrendFrom(d.toISOString().slice(0, 10));
                        setTrendTo(new Date().toISOString().slice(0, 10));
                      }}
                    >
                      30d
                    </Button>
                    <Button
                      variant="link"
                      className="text-xs text-primary-600"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 90);
                        setTrendFrom(d.toISOString().slice(0, 10));
                        setTrendTo(new Date().toISOString().slice(0, 10));
                      }}
                    >
                      90d
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-primary-300 bg-primary-100 p-4">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e1c8fa" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#776780" }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v + "T00:00:00");
                            return d.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            });
                          }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#776780" }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: "#f6f3f9",
                            border: "1px solid #e1c8fa",
                            borderRadius: "8px",
                            fontFamily: "var(--font-figtree)",
                          }}
                          labelFormatter={(v) => {
                            const d = new Date(String(v) + "T00:00:00");
                            return d.toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            });
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="views"
                          stroke="#a16bc7"
                          strokeWidth={2.5}
                          dot={{ fill: "#a16bc7", r: 3 }}
                          activeDot={{ r: 6, fill: "#3d214c" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[350px] items-center justify-center text-medium">
                      No data for this range
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ---- Map ---- */}
            <TabsContent value="map">
              <div className="mt-4">
                <MapView visits={visits.data ?? []} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-xl border border-primary-300 bg-primary-100 p-5">
      <p className="text-sm text-medium">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-heavy">
        {value ?? "—"}
      </p>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: { destination: "/login", permanent: false },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });
  if (user?.type !== "organizer") {
    return {
      redirect: { destination: "/dashboard", permanent: false },
    };
  }
  return { props: {} };
}
