import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy, type ChatHow } from "~/content/coffee-chat-sessions";
import { COFFEE_ROOMS } from "~/lib/coffee-chat-sessions";
import {
  Card,
  CardHead,
  Logo,
  PhoneCopy,
  PrimaryCrown,
  sessionLabel,
  type BoardFix,
  type BoardSponsor,
  type SessionBoardData,
} from "./parts";

const copy = coffeeSessionsCopy;
const fc = copy.fixes;

/**
 * Problem → why → Suggested → [Apply fix], as text. `locked`: the fix would
 * move a sent chat, which is locked (no Apply; call the rep).
 */
export function fixView(fix: BoardFix, sp: BoardSponsor, board: Pick<SessionBoardData, "placements">) {
  // Sent first: a sent chat is kept whether or not it was moved by hand.
  const howAt = (key: string): ChatHow => {
    const [room, session] = key.split("|");
    const p = board.placements.find((x) => x.room === room && x.sessionId === session);
    return !p ? null : p.status === "sent" ? "sent" : p.pinned ? "hand" : null;
  };
  const rep = (id: string) => sp.reps.find((r) => r.id === id);
  const name = (id: string) => rep(id)?.name ?? "";
  // Sessions to chats: full sessions, capped at what the rep wants.
  const chats = (id: string, sessions: number) =>
    Math.min(sessions * sp.chatsPerSession, rep(id)?.chatsWanted ?? 0);
  const first = fix.items[0]!;
  const g = fix.suggestion;
  const r = fix.reason;
  const problem =
    r === "partial" && first.chats
      ? fc.partialShort(name(first.rep), first.chats.got, first.chats.want)
      : g.kind === "move" && (r === "workshop" || r === "notFree" || r === "notSubmitted" || r === "overCap")
      ? fc.invalid[r](name(first.rep), sessionLabel(fix.session), howAt(g.from), sp.name)
      : fix.problem === "short"
        ? fc.short(name(first.rep), chats(first.rep, first.got), chats(first.rep, first.want))
        : fc.group(fix.items.length, sessionLabel(fix.session));
  const k = (b: "near" | "ivey") => COFFEE_ROOMS.filter((x) => x.building === b).length;
  const why = r === "near" || r === "ivey" ? fc.why[r](k(r)) : fc.why[r];
  let suggestion: string;
  if (g.kind === "extra") {
    suggestion = fc.extra(name(g.place.rep), copy.rooms.rm(g.place.room), sessionLabel(g.place.session));
  } else if (g.kind === "fewer" && r === "partial" && first.chats) {
    suggestion = fc.fewer([{ rep: name(first.rep), got: first.chats.got, want: first.chats.want }]);
  } else if (g.kind === "move") {
    const to = g.to;
    suggestion = to ? fc.move(copy.rooms.rm(to.room), sessionLabel(to.session)) : fc.removeIt;
  } else if (g.kind === "session") {
    suggestion = fc.session(g.places.map((p) => ({ rep: name(p.rep), room: p.room, s: sessionLabel(p.session) })));
  } else if (g.kind === "ivey") {
    suggestion = fc.ivey(g.places.length, g.places.map((p) => p.room), sessionLabel(g.session));
  } else {
    const items = g.caps.map((c) => ({ rep: name(c.rep), got: chats(c.rep, c.sessions), want: chats(c.rep, c.want) }));
    suggestion = fc.fewer(items);
  }
  const locked = g.kind === "move" && howAt(g.from) === "sent";
  return { problem, why, suggestion, locked };
}

/**
 * What Auto-schedule left for the organizer: it applies every other fix
 * itself (autoApplyFixes). "Fewer chats" keeps its Apply button; a fix on a
 * sent (locked) chat has none.
 */
export function FixesBand({
  board,
  onApply,
  applying,
  locked = false,
}: {
  board: SessionBoardData;
  onApply: (fixId: string) => void;
  applying: string | null;
  /** The run of show can't be read: fixes can't be applied. */
  locked?: boolean;
}) {
  return (
    <Card labelledBy="coffee-fixes" tour="coffee-fixes">
      <CardHead id="coffee-fixes" title={fc.heading} />
      {board.fixes.length === 0 ? (
        <p className="m-0 text-[15px] text-dashboard-text-light">
          {board.scheduled ? fc.allScheduled : fc.beforeAuto}
        </p>
      ) : (
        <>
          <p className="m-0 text-[15px] text-dashboard-text-medium">{fc.left}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {board.fixes.map((fix) => {
              const sp = board.sponsors.find((s) => s.id === fix.sponsor);
              if (!sp) return null;
              const v = fixView(fix, sp, board);
              // Who to call about it: the primary contact, number with a copy icon.
              const primary = sp.reps.find((r) => r.isPrimary) ?? sp.reps[0];
              return (
                <li
                  key={fix.id}
                  className="flex flex-col gap-1.5 rounded-dashboard-lg bg-dashboard-bg-task/40 px-3.5 py-3 text-dashboard-text-heavy"
                >
                  <p className="m-0 flex min-w-0 items-center gap-2 text-[15px]">
                    <Logo name={sp.name} />
                    <b className="min-w-0 font-bold text-dashboard-text-warning">{v.problem}</b>
                  </p>
                  <p className="m-0 text-sm text-dashboard-text-medium">{v.why}</p>
                  {v.locked ? (
                    <p className="m-0 text-sm font-medium text-dashboard-text-medium">{fc.locked}</p>
                  ) : (
                    <p className="m-0 text-[15px]">
                      <b className="font-bold">{fc.suggested}</b> {v.suggestion}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {!v.locked && (
                      <DashboardButton
                        variant="primary"
                        className="h-auto min-h-11 w-auto px-3 py-0 text-sm md:min-h-9"
                        disabled={applying !== null || locked}
                        onClick={() => onApply(fix.id)}
                      >
                        {applying === fix.id ? fc.applying : fc.apply}
                      </DashboardButton>
                    )}
                    {primary && (
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
                        <PrimaryCrown />
                        <b className="font-semibold">{primary.name}</b>
                        <PhoneCopy name={primary.name} phone={primary.phone} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
