import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  Card,
  CardHead,
  PhoneCopy,
  PrimaryCrown,
  focusRing,
} from "~/components/sponsors/organizer/coffee-sessions/parts";
import { DigitalSponsor } from "~/components/sponsors/organizer/digital-judging";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import {
  SHORTLIST_DUE,
  TOP_DUE,
  boardTodos,
  judgingDayMinutes,
  leadOf,
  smsHref,
  sponsorLine,
  type BoardSponsor,
  type BoardTodo,
  type SponsorLine,
} from "~/lib/judging-board";
import { sponsorColorIndexes } from "~/lib/sponsor-colors";
import {
  PRESENTATION_WINDOW_END,
  PRESENTATION_WINDOW_START,
  formatPresentationTime,
} from "~/lib/sponsor-presentations";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { RoomSelect, type RoomHolder } from "./room-select";
import { RoomsCard } from "./rooms";
import { TeamModal } from "./team-modal";

const copy = sponsorJudgingBoardCopy;
type Board = RouterOutputs["sponsorPresentations"]["board"];
type Sponsor = Board["sponsors"][number];

const REFRESH_MS = 30_000;
const TEXTED_KEY = "judging-board:texted";

/** "9:20 AM" for a Date, Eastern. */
const clock = (d: Date) =>
  d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });

/**
 * The minute of judging day to show. Ticks every 30 s. In development,
 * `?at=9:20` pins it, to see the board at any point of the day.
 */
function useJudgingMinutes() {
  const { query } = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => clearInterval(t);
  }, []);
  const at = typeof query.at === "string" ? query.at : null;
  if (process.env.NODE_ENV !== "production" && at) {
    const [h, m] = at.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) return h! * 60 + m!;
  }
  return judgingDayMinutes(now);
}

/** "Texted 9:20 AM" per to-do, kept in this browser only. */
function useTexted() {
  const [texted, setTexted] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEXTED_KEY);
      if (raw) setTexted(JSON.parse(raw) as Record<string, string>);
    } catch {
      // Storage blocked: the note just won't survive a reload.
    }
  }, []);
  const mark = (key: string) => {
    const next = { ...texted, [key]: clock(new Date()) };
    setTexted(next);
    try {
      localStorage.setItem(TEXTED_KEY, JSON.stringify(next));
    } catch {
      // As above.
    }
  };
  return [texted, mark] as const;
}

const toBoardSponsor = (s: Sponsor): BoardSponsor => ({
  sponsorId: s.sponsorId,
  name: s.name,
  mode: s.mode,
  room: s.room,
  shortlistSent: s.shortlistSentAt !== null,
  teams: s.teams,
  repsJudging: s.repsJudging,
  scored: s.scored,
  topIn: s.topInAt !== null,
  firstStart: s.firstStart,
});

/**
 * The organizer Judging board (mock organizer-judging-board-v2, approved
 * with changes by Jazz on 2026-11-19): to-dos first, then sponsors with
 * their rooms, and the rooms calendar / schedule. Teams are only "Invite
 * not sent", "Waiting" or "Accepted"; remote sponsors' teams don't
 * present.
 */
export function JudgingBoard() {
  const utils = api.useUtils();
  const q = api.sponsorPresentations.board.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    retry: 1,
  });
  const minutes = useJudgingMinutes();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<{
    sponsorId: string;
    message: string;
  } | null>(null);
  const refresh = () => void utils.sponsorPresentations.board.invalidate();
  const setRoom = api.sponsorPresentations.setRoom.useMutation({
    onMutate: () => setRoomError(null),
    onSuccess: refresh,
    onError: (e, input) =>
      setRoomError({
        sponsorId: input.sponsorId,
        message:
          e.data?.code === "CONFLICT" ? e.message : copy.room.failed,
      }),
  });
  const colors = useMemo(
    () => sponsorColorIndexes((q.data?.sponsors ?? []).map((s) => s.name)),
    [q.data],
  );

  if (q.isLoading) {
    return (
      <div
        aria-busy="true"
        className="h-96 animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none"
      />
    );
  }
  const board = q.data;
  if (!board) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.loadFailed}
        </p>
        <DashboardButton variant="small" onClick={() => void q.refetch()}>
          {copy.retry}
        </DashboardButton>
      </DashboardPanel>
    );
  }

  const holders: RoomHolder[] = board.sponsors
    .filter((s) => s.mode === "room")
    .map((s) => ({ sponsorId: s.sponsorId, name: s.name, room: s.room }));
  const room = (s: Sponsor) => (
    <RoomSelect
      sponsor={s}
      holders={holders}
      pending={setRoom.isPending && setRoom.variables?.sponsorId === s.sponsorId}
      error={roomError?.sponsorId === s.sponsorId ? roomError.message : null}
      onSet={(r) => setRoom.mutate({ sponsorId: s.sponsorId, room: r })}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm font-medium text-dashboard-text-medium">
        {copy.intro(
          formatPresentationTime(PRESENTATION_WINDOW_START),
          formatPresentationTime(PRESENTATION_WINDOW_END),
        )}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <TodoCard
            board={board}
            minutes={minutes}
            colors={colors}
            room={room}
            onNotified={refresh}
          />
          <SponsorsCard
            board={board}
            minutes={minutes}
            colors={colors}
            room={room}
          />
        </div>
        <RoomsCard
          board={board}
          colors={colors}
          onOpenTeam={setTeamId}
          onMove={(sponsorId, r) =>
            setRoom.mutate({ sponsorId, room: r, swap: true })
          }
          movePending={setRoom.isPending}
        />
      </div>
      <TeamModal teamId={teamId} onClose={() => setTeamId(null)} />
    </div>
  );
}

function TodoCard({
  board,
  minutes,
  colors,
  room,
  onNotified,
}: {
  board: Board;
  minutes: number;
  colors: ReadonlyMap<string, number>;
  room: (s: Sponsor) => React.ReactNode;
  onNotified: () => void;
}) {
  const [texted, markTexted] = useTexted();
  const notify = api.sponsorPresentations.notify.useMutation({
    onSuccess: onNotified,
  });
  const todos = boardTodos({
    sponsors: board.sponsors.map(toBoardSponsor),
    teamsNotTold: board.teamsNotTold,
    digital: board.digital.map((d) => ({
      name: d.name,
      topIn: d.topInAt !== null,
    })),
    minutes,
  });
  const byId = new Map(board.sponsors.map((s) => [s.sponsorId, s]));
  const t = copy.todo;
  const allNotified =
    board.teamsNotTold === 0 &&
    board.slots.length > 0 &&
    board.lastNotifiedAt !== null;

  return (
    <Card labelledBy="judging-todo-heading" tour="judging-todo">
      <CardHead
        id="judging-todo-heading"
        title={t.heading}
        aside={todos.length > 0 ? t.open(todos.length) : undefined}
      />
      {todos.length === 0 && !allNotified && (
        <p className="m-0 text-base text-dashboard-text-medium">{t.none}</p>
      )}
      {allNotified && (
        <p className="m-0 flex items-center gap-2 rounded-dashboard-md border-l-4 border-dashboard-status-live bg-dashboard-schedule-green px-4 py-3 text-base font-semibold text-dashboard-status-live">
          <CheckCircle2 aria-hidden className="size-5 shrink-0" />
          {t.allNotified(clock(board.lastNotifiedAt!))}
        </p>
      )}
      {todos.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {todos.map((todo) => (
            <li key={todoKey(todo)}>
              <Todo
                todo={todo}
                sponsor={"sponsorId" in todo ? byId.get(todo.sponsorId) : undefined}
                colors={colors}
                room={room}
                texted={texted[todoKey(todo)] ?? null}
                onTexted={() => markTexted(todoKey(todo))}
                notify={{
                  run: () => notify.mutate(),
                  pending: notify.isPending,
                  error: notify.error
                    ? notify.error.data?.code === "PRECONDITION_FAILED" ||
                      notify.error.data?.code === "BAD_REQUEST"
                      ? notify.error.message
                      : t.notifyFailed
                    : null,
                  result: notify.data
                    ? t.notifyResult(notify.data.sent, notify.data.emailed)
                    : null,
                }}
                finalTop={board.finalTop}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const todoKey = (t: BoardTodo) =>
  t.kind === "textLead"
    ? `lead:${t.sponsorId}:${t.problem}`
    : t.kind === "room"
      ? `room:${t.sponsorId}`
      : t.kind === "digitalTop"
        ? `digital:${t.name}`
        : "notify";

const TODO_WARN =
  "flex flex-col gap-2.5 rounded-dashboard-md border-l-4 border-dashboard-border-task bg-dashboard-bg-task px-4 py-3";
const TODO_INFO =
  "flex flex-col gap-2.5 rounded-dashboard-md border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight px-4 py-3";

function Todo({
  todo,
  sponsor,
  colors,
  room,
  texted,
  onTexted,
  notify,
  finalTop,
}: {
  todo: BoardTodo;
  sponsor: Sponsor | undefined;
  colors: ReadonlyMap<string, number>;
  room: (s: Sponsor) => React.ReactNode;
  texted: string | null;
  onTexted: () => void;
  notify: {
    run: () => void;
    pending: boolean;
    error: string | null;
    result: string | null;
  };
  finalTop: number;
}) {
  const t = copy.todo;
  if (todo.kind === "notify") {
    return (
      <div className={TODO_INFO}>
        <p className="m-0 text-base font-bold">{t.notify(todo.teams)}</p>
        <p className="m-0 text-sm text-dashboard-text-medium">{t.notifyHint}</p>
        <DashboardButton
          onClick={notify.run}
          disabled={notify.pending}
          className="md:w-fit"
        >
          {notify.pending ? t.notifying : t.notifyButton}
        </DashboardButton>
        {notify.error && (
          <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">
            {notify.error}
          </p>
        )}
        {notify.result && (
          <p role="status" className="m-0 text-sm text-dashboard-text-medium">
            {notify.result}
          </p>
        )}
      </div>
    );
  }
  if (todo.kind === "digitalTop") {
    return (
      <div className={TODO_WARN}>
        <p className="m-0 text-base font-bold text-dashboard-text-task">
          {t.digitalTop5(todo.name, finalTop)}
        </p>
      </div>
    );
  }
  if (!sponsor) return null;
  const head = (text: string, rest?: React.ReactNode) => (
    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
      <SponsorBadge name={sponsor.name} colors={colors} />
      <b className="font-bold">{text}</b>
      {rest}
    </p>
  );
  if (todo.kind === "room") {
    return (
      <div className={TODO_INFO}>
        {head(t.needsRoom(sponsor.name))}
        {room(sponsor)}
      </div>
    );
  }
  const lead = leadOf(sponsor.reps);
  const problem = t.problem[todo.problem];
  const sms =
    todo.problem === "shortlist"
      ? t.sms.shortlist(sponsor.name, formatPresentationTime(SHORTLIST_DUE))
      : todo.problem === "noScores"
        ? t.sms.noScores(sponsor.name)
        : t.sms.top5(sponsor.name, finalTop, formatPresentationTime(TOP_DUE));
  return (
    <div className={TODO_WARN}>
      <div className="text-dashboard-text-task">
        {head(
          todo.problem === "top5"
            ? t.problem.top5(sponsor.name, finalTop)
            : problem(sponsor.name, finalTop),
        )}
      </div>
      {lead ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base text-dashboard-text-task">
            {t.textLead(lead.name)}
          </span>
          <span className="whitespace-nowrap">
            <PhoneCopy name={lead.name} phone={lead.phone} />
          </span>
          <a
            href={smsHref(lead.phone, sms)}
            onClick={onTexted}
            className={cn(
              "inline-flex min-h-11 items-center rounded-dashboard-md bg-dashboard-action-primary px-4 text-base font-semibold text-dashboard-text-inverse md:min-h-9",
              focusRing,
            )}
          >
            {t.text}
          </a>
          {texted && (
            <span className="text-sm font-medium text-dashboard-text-medium">
              {t.texted(texted)}
            </span>
          )}
        </div>
      ) : (
        <p className="m-0 text-sm text-dashboard-text-task">{t.noLead}</p>
      )}
    </div>
  );
}

const LINE_TEXT = (line: SponsorLine, top: number) => {
  const l = copy.sponsors.line;
  switch (line.kind) {
    case "teams":
      return l.teams(line.teams, line.reps);
    case "scored":
      return l.scored(line.scored, line.teams);
    case "topIn":
      return l.topIn(top);
    case "shortlistMissing":
      return l.shortlistMissing;
    case "missedRound1":
      return l.missedRound1;
    case "noScores":
      return l.noScores;
    case "topLate":
      return l.topLate(top);
  }
};

function SponsorsCard({
  board,
  minutes,
  colors,
  room,
}: {
  board: Board;
  minutes: number;
  colors: ReadonlyMap<string, number>;
  room: (s: Sponsor) => React.ReactNode;
}) {
  const s = copy.sponsors;
  const sent = board.sponsors.filter((x) => x.shortlistSentAt).length;
  return (
    <Card labelledBy="judging-sponsors-heading" tour="judging-sponsors">
      <CardHead
        id="judging-sponsors-heading"
        title={s.heading}
        aside={
          board.sponsors.length > 0
            ? s.shortlistsIn(sent, board.sponsors.length)
            : undefined
        }
      />
      <ul className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
        {board.sponsors.map((sp) => (
          <SponsorRow
            key={sp.sponsorId}
            sponsor={sp}
            line={sponsorLine(toBoardSponsor(sp), minutes)}
            top={board.finalTop}
            colors={colors}
            room={room}
          />
        ))}
      </ul>
      {board.digital.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4">
          <h3 className="m-0 text-base font-bold">{s.digitalHeading}</h3>
          {board.digital.map((d) => (
            <DigitalRow
              key={d.name}
              name={d.name}
              topInAt={d.topInAt}
              top={board.finalTop}
              colors={colors}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function SponsorRow({
  sponsor,
  line,
  top,
  colors,
  room,
}: {
  sponsor: Sponsor;
  line: SponsorLine;
  top: number;
  colors: ReadonlyMap<string, number>;
  room: (s: Sponsor) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const s = copy.sponsors;
  const lead = leadOf(sponsor.reps);
  const detailsId = `judging-sponsor-${sponsor.sponsorId}`;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={open ? s.collapse(sponsor.name) : s.expand(sponsor.name)}
          onClick={() => setOpen(!open)}
          className={cn(
            "-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight md:size-9",
            focusRing,
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 transition-transform motion-reduce:transition-none",
              open && "rotate-90",
            )}
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5 md:pt-1">
          <span className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <SponsorBadge name={sponsor.name} colors={colors} />
            <span className="break-words">{sponsor.name}</span>
          </span>
          <span
            className={cn(
              "text-sm",
              line.tone === "warn"
                ? "font-semibold text-dashboard-text-warning"
                : "text-dashboard-text-medium",
            )}
          >
            {LINE_TEXT(line, top)}
          </span>
        </div>
        <div className="w-full sm:w-40 sm:shrink-0">
          {sponsor.mode === "remote" ? (
            <span className="block pt-1.5 text-sm text-dashboard-text-medium sm:text-right">
              {s.remote}
            </span>
          ) : (
            room(sponsor)
          )}
        </div>
      </div>
      {/* The head rep's number on every row (Jazz, 2026-11-19). */}
      {lead && (
        <span className="-mt-2 flex flex-wrap items-center gap-x-1.5 whitespace-nowrap pl-9 text-sm text-dashboard-text-light">
          {s.headRep}: {lead.name}
          <PhoneCopy name={lead.name} phone={lead.phone} />
        </span>
      )}
      {open && (
        <div id={detailsId} className="flex flex-col gap-1 pl-9">
          <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-dashboard-text-medium">
            {s.reps}
          </h4>
          {sponsor.reps.length === 0 ? (
            <p className="m-0 text-sm text-dashboard-text-medium">{s.noReps}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {sponsor.reps.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-2 text-sm"
                >
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {r.name}
                    {r.isPrimary && <PrimaryCrown />}
                  </span>
                  {r.phone.trim() && (
                    <PhoneCopy name={r.name} phone={r.phone} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function DigitalRow({
  name,
  topInAt,
  top,
  colors,
}: {
  name: string;
  topInAt: Date | null;
  top: number;
  colors: ReadonlyMap<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const s = copy.sponsors;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-base font-semibold">
        <SponsorBadge name={name} colors={colors} />
        {name}
      </span>
      <p className="m-0 text-sm text-dashboard-text-medium">
        {topInAt
          ? s.topEntered(top, formatSubmittedTime(topInAt))
          : s.digitalIntro(top, formatPresentationTime(TOP_DUE))}
      </p>
      <DashboardButton
        variant="small"
        className="w-fit"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? s.hideTop : s.enterTop(top)}
      </DashboardButton>
      {open && <DigitalSponsor name={name} top={top} />}
    </div>
  );
}
