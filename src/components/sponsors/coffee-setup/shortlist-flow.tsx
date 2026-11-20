import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, CircleCheck, Info, Search, X } from "lucide-react";
import { toast } from "sonner";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { btn, card, Note, seg } from "~/components/sponsors/portal-ui";
import { LoadError, ScheduleSkeleton } from "~/components/sponsors/schedule-states";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import type { InterestedHacker, ScannedHacker } from "~/server/api/routers/sponsor-shortlist";
import { api } from "~/utils/api";
import { LinkButton, useAnnounce } from "./shared";

const copy = sponsorSetupCopy.shortlist;

type View = "one" | "list";
type Filter = "all" | "not" | "shortlisted";
/** Hackers per page in the list (mock sponsor-chats-v3). */
const PAGE = 10;

/**
 * The shortlist flow (mock sponsor-chats-v3): one list, made by one person
 * on the sponsor login. Opens once availability is sent; capped at the
 * sponsor's hacker seats. People met at the booth are pinned first in both
 * views: they're invited first, so they can't be shortlisted. The list
 * searches the sponsor's candidates by name, school or program, and every
 * other admitted hacker by name (sponsorShortlist.search).
 */
export function ShortlistFlow({
  sponsor,
  step,
  prefsHref,
  pickHref,
  reviewHref,
  homeHref,
}: {
  sponsor: string;
  step: 1 | 2;
  prefsHref: string;
  pickHref: string;
  reviewHref: string;
  homeHref: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const q = api.sponsorShortlist.list.useQuery({ sponsor }, { retry: 1, refetchOnWindowFocus: false });
  const { announce, clear, region } = useAnnounce();
  // "<name> shortlisted." belongs to the step it happened on.
  useEffect(() => clear(), [step, clear]);
  const [view, setView] = useState<View>("one");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 250);
  // Name search over every admitted hacker (not just the candidates).
  const search = api.sponsorShortlist.search.useQuery(
    { sponsor, q: term },
    { enabled: term.length >= 2, retry: 1, refetchOnWindowFocus: false },
  );
  const refresh = async () => {
    await Promise.all([
      utils.sponsorShortlist.list.invalidate({ sponsor }),
      utils.sponsorShortlist.search.invalidate(),
      utils.coffeeChatSetup.get.invalidate({ sponsor }),
    ]);
  };
  const onError = (e: { message: string }) => {
    const msg = e.message || copy.toggleError;
    setError(msg);
    announce(msg);
  };
  const add = api.sponsorShortlist.add.useMutation({ onError });
  const remove = api.sponsorShortlist.remove.useMutation({ onError });
  const submit = api.sponsorShortlist.submit.useMutation({
    onSuccess: async () => {
      await refresh();
      toast(sponsorSetupCopy.page.shortlistToast);
      await router.push(homeHref);
    },
    onError,
  });
  const reopen = api.sponsorShortlist.reopen.useMutation({ onSuccess: refresh, onError });

  if (q.isLoading) return <ScheduleSkeleton />;
  if (!q.data) return <LoadError onRetry={() => void q.refetch()} />;
  const data = q.data;

  if (!data.prefsSubmitted) {
    return (
      <section className={card}>
        <p className="m-0 text-base text-dashboard-text-medium">{copy.locked}</p>
        <LinkButton href={prefsHref}>{copy.goPrefs}</LinkButton>
      </section>
    );
  }

  const picked = data.hackers.filter((h) => h.shortlisted);
  const max = data.maxShortlist;
  const full = data.picked >= max;
  const over = data.picked > max;
  const submitted = !!data.submittedAt;
  const busy = add.isPending || remove.isPending;

  const toggle = (h: InterestedHacker) => {
    setError(null);
    if (h.shortlisted) {
      remove.mutate(
        { sponsor, userId: h.userId },
        { onSuccess: () => void refresh().then(() => announce(copy.removed(h.name))) },
      );
    } else {
      add.mutate(
        { sponsor, userId: h.userId },
        { onSuccess: () => void refresh().then(() => announce(copy.added(h.name))) },
      );
    }
  };

  const seatsLine = (suffix: string) =>
    over ? (
      <p role="alert" className="m-0 text-lg font-bold text-dashboard-text-warning">
        {sponsorSetupCopy.errors.overCap(data.picked, max)}
      </p>
    ) : (
      <p className="m-0 text-[15px] tabular-nums text-dashboard-text-medium">
        <b className="text-xl text-dashboard-text-heavy">{copy.seats(data.picked, max)}</b> {suffix}
      </p>
    );

  // Submitted: the toggles are off until they tap Edit (the server keeps a
  // sent shortlist as it is).
  const submittedBanner = submitted && (
    <div className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-highlight p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 flex items-center gap-2 text-base font-semibold">
        <CircleCheck aria-hidden className="size-5 shrink-0 text-dashboard-status-live" />
        {copy.lockedSubmitted}
      </p>
      <button
        type="button"
        className={btn.outline}
        aria-disabled={reopen.isPending || undefined}
        onClick={() => !reopen.isPending && reopen.mutate({ sponsor })}
      >
        {copy.edit}
      </button>
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3 border-t border-dashboard-border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={step === 1 ? homeHref : pickHref} className={cn(btn.outline, "order-2 sm:order-1")}>
        {step === 1 ? sponsorSetupCopy.back : sponsorSetupCopy.backStep}
      </Link>
      <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:items-center">
        {step === 2 && over && (
          <p className="m-0 text-sm text-dashboard-text-light">{sponsorSetupCopy.errors.overCap(data.picked, max)}</p>
        )}
        <Link href={homeHref} className={btn.outline}>
          {copy.skipForNow}
        </Link>
        {step === 1 ? (
          <Link href={reviewHref} className={btn.group}>
            {copy.reviewNext}
          </Link>
        ) : (
          !submitted && (
            <button
              type="button"
              className={btn.group}
              aria-disabled={submit.isPending || over || undefined}
              onClick={() => !submit.isPending && !over && submit.mutate({ sponsor })}
            >
              {submit.isPending ? copy.submitting : copy.submit}
            </button>
          )
        )}
      </div>
    </div>
  );

  if (step === 2) {
    return (
      <>
        <section className={cn(card, "gap-4")} aria-labelledby="sl-review">
          {region}
          <h2 id="sl-review" className="m-0 text-[22px] font-bold leading-tight">
            {copy.reviewHeading}
          </h2>
          {submittedBanner}
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">
              {copy.reviewMetHeading} <span className="font-medium tabular-nums text-dashboard-text-light">· {data.scanned.length}</span>
            </h3>
            <p className="m-0 text-sm">{copy.metNote}</p>
            {data.scanned.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.scanned.map((h) => (
                  <MetCard key={h.userId} hacker={h} />
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-dashboard-text-light">{copy.reviewMetNone}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">
              {copy.yourShortlist} <span className="font-medium tabular-nums text-dashboard-text-light">· {picked.length}</span>
            </h3>
            {picked.length === 0 ? (
              <Note icon={<Info aria-hidden />}>{copy.reviewEmpty}</Note>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {picked.map((h) => (
                  <HackerCard
                    key={h.userId}
                    hacker={h}
                    action={
                      !submitted && (
                        <button
                          type="button"
                          aria-label={copy.removeLabel(h.name)}
                          disabled={busy}
                          onClick={() => toggle(h)}
                          className={cn(btn.outline, "size-11 shrink-0 px-0")}
                        >
                          <X aria-hidden />
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
          {seatsLine(copy.used)}
          {over && <p className="m-0 text-sm font-semibold text-dashboard-notice-danger">{copy.overWhy(data.picked, max)}</p>}
          {error && <p role="alert" className="m-0 text-sm font-semibold text-dashboard-notice-danger">{error}</p>}
        </section>
        {footer}
      </>
    );
  }

  // One at a time: people met at the booth first ("Invited first", Next
  // only), then everyone not yet shortlisted or skipped.
  const metQueue = data.scanned.filter((h) => !skipped.has(h.userId));
  const queue = data.hackers.filter((h) => !h.shortlisted && !skipped.has(h.userId));
  const total = data.scanned.length + data.hackers.length;
  const left = metQueue.length + queue.length;
  const met = metQueue[0];
  const current = queue[0];

  // List: met people pinned on page 1, then the filter and search.
  const needle = query.trim().toLowerCase();
  const matches = (h: { name: string; school?: string | null; program?: string | null }) =>
    !needle || [h.name, h.school, h.program].filter(Boolean).join(" ").toLowerCase().includes(needle);
  const counts = {
    all: data.hackers.length + data.scanned.length,
    not: data.hackers.filter((h) => !h.shortlisted).length + data.scanned.length,
    shortlisted: data.hackers.filter((h) => h.shortlisted).length,
  };
  const metRows = filter === "shortlisted" ? [] : data.scanned.filter(matches);
  const rest = data.hackers.filter(
    (h) => (filter === "all" || (filter === "shortlisted") === h.shortlisted) && matches(h),
  );
  const rows: ({ kind: "met"; h: ScannedHacker } | { kind: "pool"; h: InterestedHacker })[] = [
    ...metRows.map((h) => ({ kind: "met" as const, h })),
    ...rest.map((h) => ({ kind: "pool" as const, h })),
  ];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const slice = rows.slice(pg * PAGE, pg * PAGE + PAGE);
  const metSlice = slice.flatMap((r) => (r.kind === "met" ? [r.h] : []));
  const poolSlice = slice.flatMap((r) => (r.kind === "pool" ? [r.h] : []));
  const known = new Set([...data.hackers, ...data.scanned].map((h) => h.userId));
  const others = (search.data ?? []).filter((h) => !known.has(h.userId));
  const toggleButton = (h: InterestedHacker) => {
    const blocked = busy || submitted || (!h.shortlisted && full);
    return (
      <button
        type="button"
        aria-pressed={h.shortlisted}
        aria-disabled={blocked || undefined}
        aria-describedby={!h.shortlisted && full ? "sl-capwhy" : undefined}
        aria-label={h.shortlisted ? copy.removeLabel(h.name) : copy.addLabel(h.name)}
        onClick={() => !blocked && toggle(h)}
        className={cn(
          btn.outline,
          btn.sm,
          "shrink-0",
          h.shortlisted && "border-dashboard-group-border bg-dashboard-group-bg text-dashboard-group-text",
        )}
      >
        {h.shortlisted ? copy.toggleOn : copy.toggleOff}
      </button>
    );
  };

  return (
    <>
      <section className={cn(card, "gap-4")} aria-labelledby="sl-pick">
        {region}
        <h2 id="sl-pick" className="m-0 text-[22px] font-bold leading-tight">
          {copy.pickHeading}
        </h2>
        <ol
          aria-label={copy.howLabel}
          className="m-0 flex list-none flex-col gap-2 rounded-dashboard-lg border border-dashboard-group-border bg-dashboard-bg-surface p-3.5"
        >
          {copy.how.map((line, i) => (
            <li key={line} className="flex items-start gap-2.5 text-[15px]">
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-dashboard-group-text text-[13px] font-extrabold tabular-nums text-dashboard-text-inverse">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
        {submittedBanner}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {seatsLine(copy.seatsSuffix)}
          <div role="group" aria-label={copy.viewLabel} className={seg.frame}>
            {(["one", "list"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn(seg.button(view === v), "px-3")}>
                {v === "one" ? copy.oneAtATime : copy.list}
              </button>
            ))}
          </div>
        </div>
        {max === 0 && <p className="m-0 text-base text-dashboard-text-warning">{copy.noSeats}</p>}
        <p id="sl-capwhy" hidden={!(full && !over && max > 0)} className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {copy.capWhy(max)}
        </p>

        {view === "one" ? (
          met ?? current ? (
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
              <p className="m-0 text-sm tabular-nums text-dashboard-text-light">
                {copy.oneOf(total - left + 1, total, left)}
              </p>
              {met ? (
                <>
                  <BigCard name={met.name} github={met.github} sub={met.school} study={studyLine(met)} links={met} tag={metTag(met)} />
                  <button
                    type="button"
                    className={cn(btn.group, "min-h-14 text-lg font-bold")}
                    aria-label={copy.nextMetLabel(met.name)}
                    onClick={() => setSkipped((s) => new Set(s).add(met.userId))}
                  >
                    {copy.next}
                  </button>
                </>
              ) : (
                current && (
                  <>
                    <BigCard
                      name={current.name}
                      github={current.github}
                      sub={current.shared ? (current.school ?? current.team) : copy.notShared}
                      study={studyLine({ ...current, school: null })}
                      links={current}
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        className={cn(btn.outline, "min-h-14 text-lg font-bold")}
                        aria-label={copy.skipLabel(current.name)}
                        onClick={() => setSkipped((s) => new Set(s).add(current.userId))}
                      >
                        {copy.skip}
                      </button>
                      <button
                        type="button"
                        className={cn(btn.group, "min-h-14 text-lg font-bold")}
                        aria-disabled={busy || full || submitted || undefined}
                        aria-describedby="sl-capwhy"
                        aria-label={copy.addLabel(current.name)}
                        onClick={() => !busy && !full && !submitted && toggle(current)}
                      >
                        {copy.add}
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          ) : (
            <Note icon={<Info aria-hidden />}>{data.hackers.length ? copy.allSeen : copy.nobody}</Note>
          )
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-base">
              <b className="tabular-nums">{copy.poolCount(data.hackers.length)}</b>{" "}
              {copy.poolOf}
            </p>
            <div role="group" aria-label={copy.filterLabel} className={seg.frame}>
              {(["all", "not", "shortlisted"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => {
                    setFilter(f);
                    setPage(0);
                  }}
                  className={cn(seg.button(filter === f), "text-sm leading-tight")}
                >
                  {copy.filters[f]}{" "}
                  <span className="ml-1 rounded-full bg-dashboard-bg-surface px-1.5 text-xs tabular-nums">{counts[f]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dashboard-text-light" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                aria-label={copy.listSearchLabel}
                aria-describedby="sl-search-hint"
                placeholder={copy.listSearch}
                // 16px text so phones don't zoom in on focus.
                className="h-11 w-full appearance-none rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface pl-10 pr-11 text-base placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={copy.search.clear}
                  className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-dashboard-lg text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>
            <p id="sl-search-hint" className="m-0 -mt-2 text-sm text-dashboard-text-light">
              {copy.search.hint}
            </p>
            {metSlice.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-semibold">
                  {copy.metHeading} <span className="font-medium tabular-nums text-dashboard-text-light">· {data.scanned.length}</span>
                </h3>
                <p className="m-0 text-sm">{copy.metNote}</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {metSlice.map((h) => (
                    <MetCard key={h.userId} hacker={h} />
                  ))}
                </div>
              </div>
            )}
            {poolSlice.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {poolSlice.map((h) => (
                  <HackerCard key={h.userId} hacker={h} on={h.shortlisted} action={toggleButton(h)} />
                ))}
              </div>
            ) : (
              metSlice.length === 0 && (
                <Note icon={<Info aria-hidden />}>
                  {needle ? copy.noMatch : filter === "shortlisted" ? copy.noneShortlisted : filter === "not" ? copy.noneLeft : copy.nobody}
                </Note>
              )
            )}
            {rows.length > PAGE && (
              <nav aria-label={copy.pager.label} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={cn(btn.outline, "px-3")}
                  disabled={pg === 0}
                  aria-label={copy.pager.previousLabel}
                  onClick={() => setPage(pg - 1)}
                >
                  <ChevronLeft aria-hidden />
                  {copy.pager.previous}
                </button>
                <p aria-live="polite" className="m-0 text-sm tabular-nums">
                  {copy.pager.range(pg * PAGE + 1, pg * PAGE + slice.length, rows.length)}
                </p>
                <button
                  type="button"
                  className={cn(btn.outline, "px-3")}
                  disabled={pg >= pages - 1}
                  aria-label={copy.pager.nextLabel}
                  onClick={() => setPage(pg + 1)}
                >
                  {copy.pager.next}
                  <ChevronRight aria-hidden />
                </button>
              </nav>
            )}
            {term.length >= 2 && (
              <section aria-label={copy.search.label} aria-busy={search.isFetching || undefined} className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-semibold">{copy.othersHeading}</h3>
                <p role="status" className="m-0 text-sm text-dashboard-text-light">
                  {search.isError
                    ? copy.search.failed
                    : !search.data
                      ? copy.search.searching
                      : others.length === 0
                        ? copy.search.none(term)
                        : copy.search.results(others.length)}
                </p>
                {others.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {others.map((h) => (
                      <HackerCard
                        key={h.userId}
                        hacker={h}
                        on={h.shortlisted}
                        action={
                          h.scanned ? (
                            <span className="shrink-0 rounded-full bg-dashboard-notice-cautionBg px-2 py-0.5 text-xs font-semibold text-dashboard-text-warning">
                              {copy.scannedTag}
                            </span>
                          ) : !h.shared ? (
                            <span className="max-w-40 shrink-0 text-right text-xs text-dashboard-text-light">{copy.search.cantInvite}</span>
                          ) : (
                            toggleButton(h)
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                {(search.data?.length ?? 0) >= SEARCH_LIMIT && (
                  <p className="m-0 text-sm text-dashboard-text-light">{copy.search.more}</p>
                )}
              </section>
            )}
          </div>
        )}

        {error && <p role="alert" className="m-0 text-sm font-semibold text-dashboard-notice-danger">{error}</p>}
      </section>
      {footer}
    </>
  );
}

/** Most results the name search returns (sponsorShortlist.search). */
const SEARCH_LIMIT = 20;

/** "Western University · Computer Science · 3rd year", when shared. */
function studyLine(h: { school?: string | null; program?: string | null; year?: string | null }): string | null {
  const line = [h.school, h.program, h.year ? copy.year(h.year) : null].filter(Boolean).join(" · ");
  return line.length > 0 ? line : null;
}

function metTag(h: ScannedHacker) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-dashboard-notice-cautionBg px-2 py-0.5 text-xs font-semibold text-dashboard-text-warning">
        {h.repName ? `${copy.scannedTag} · ${h.repName.split(/\s+/)[0]}` : copy.scannedTag}
      </span>
      <span className="text-sm text-dashboard-text-light">{copy.invitedFirst}</span>
    </p>
  );
}

/** One at a time's big card. */
function BigCard({
  name,
  github,
  sub,
  study,
  links,
  tag,
}: {
  name: string;
  github: string | null;
  sub: string | null | undefined;
  study: string | null;
  links: Parameters<typeof HackerLinks>[0]["links"];
  tag?: React.ReactNode;
}) {
  return (
    <article aria-label={name} className="flex flex-col gap-2.5 rounded-dashboard-lg border border-dashboard-border-card bg-dashboard-bg-surface p-[18px] shadow-dashboard-card">
      <div className="flex items-start gap-3">
        <HackerAvatar name={name} github={github} size="lg" />
        <div className="min-w-0 flex-1">
          <b className="block break-words text-xl">{name}</b>
          {sub && <span className="block text-[13px] text-dashboard-text-light">{sub}</span>}
        </div>
      </div>
      {tag}
      {study && <p className="m-0 text-sm">{study}</p>}
      <HackerLinks name={name} links={links} icons />
    </article>
  );
}

function HackerCard({
  hacker,
  action,
  on = false,
}: {
  hacker: InterestedHacker;
  action?: React.ReactNode;
  on?: boolean;
}) {
  const line = hacker.shared ? (studyLine(hacker) ?? hacker.team ?? copy.noTeam) : copy.notShared;
  return (
    <article
      aria-label={hacker.name}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-dashboard-lg border bg-dashboard-bg-surface p-3",
        on ? "border-dashboard-group-border bg-dashboard-group-subtle" : "border-dashboard-border-card",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <HackerAvatar name={hacker.name} github={hacker.github} size="sm" />
        <div className="min-w-0 flex-1">
          <b className="block break-words">{hacker.name}</b>
          <span className="block break-words text-[13px] text-dashboard-text-light">{line}</span>
        </div>
        {action}
      </div>
      <HackerLinks name={hacker.name} links={hacker} icons />
    </article>
  );
}

function MetCard({ hacker }: { hacker: ScannedHacker }) {
  return (
    <article aria-label={hacker.name} className="flex min-w-0 flex-col gap-2 rounded-dashboard-lg border border-dashboard-border-card bg-dashboard-bg-surface p-3">
      <div className="flex min-w-0 items-start gap-3">
        <HackerAvatar name={hacker.name} github={hacker.github} size="sm" />
        <div className="min-w-0 flex-1">
          <b className="block break-words">{hacker.name}</b>
          <span className="block break-words text-[13px] text-dashboard-text-light">
            {hacker.shared ? (studyLine(hacker) ?? hacker.team ?? copy.noTeam) : copy.notShared}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-dashboard-notice-cautionBg px-2 py-0.5 text-xs font-semibold text-dashboard-text-warning">
          {hacker.repName ? `${copy.scannedTag} · ${hacker.repName.split(/\s+/)[0]}` : copy.scannedTag}
        </span>
      </div>
      <HackerLinks name={hacker.name} links={hacker} icons />
    </article>
  );
}

/** `value`, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
