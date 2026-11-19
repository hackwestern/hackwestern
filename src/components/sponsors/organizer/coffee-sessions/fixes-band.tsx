import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { COFFEE_ROOMS } from "~/lib/coffee-chat-sessions";
import {
  Card,
  CardHead,
  ContactList,
  Logo,
  sessionLabel,
  type BoardFix,
  type BoardSponsor,
  type SessionBoardData,
} from "./parts";

const copy = coffeeSessionsCopy;
const fc = copy.fixes;

/** Problem → why → Suggested → [Apply fix] [Contact], as text. */
export function fixView(fix: BoardFix, sp: BoardSponsor) {
  const rep = (id: string) => sp.reps.find((r) => r.id === id);
  const name = (id: string) => rep(id)?.name ?? "";
  // Sessions to chats: full sessions, capped at what the rep wants.
  const chats = (id: string, sessions: number) =>
    Math.min(sessions * sp.chatsPerSession, rep(id)?.chatsWanted ?? 0);
  const first = fix.items[0]!;
  const problem =
    fix.problem === "short"
      ? fc.short(name(first.rep), chats(first.rep, first.got), chats(first.rep, first.want))
      : fc.group(fix.items.length, sessionLabel(fix.session));
  const k = (b: "near" | "ivey") => COFFEE_ROOMS.filter((r) => r.building === b).length;
  const why =
    fix.reason === "full"
      ? fc.why.full
      : fix.reason === "open"
        ? fc.why.open
        : fc.why[fix.reason](k(fix.reason));
  const g = fix.suggestion;
  const d = copy.contact.draft;
  let suggestion: string;
  let draft: (firstName: string) => string;
  if (g.kind === "session") {
    suggestion = fc.session(g.places.map((p) => ({ rep: name(p.rep), room: p.room, s: sessionLabel(p.session) })));
    draft = (f) => d.session(f, name(g.places[0]!.rep), sessionLabel(g.places[0]!.session));
  } else if (g.kind === "ivey") {
    suggestion = fc.ivey(g.places.length, g.places.map((p) => p.room), sessionLabel(g.session));
    draft = (f) => d.ivey(f, sp.name, g.places.length, sessionLabel(g.session));
  } else {
    const items = g.caps.map((c) => ({ rep: name(c.rep), got: chats(c.rep, c.sessions), want: chats(c.rep, c.want) }));
    suggestion = fc.fewer(items);
    draft = (f) => d.fewer(f, items[0]!.rep, items[0]!.got, items[0]!.want);
  }
  return { problem, why, suggestion, draft };
}

export function FixesBand({
  board,
  contact,
  onContact,
  onApply,
  applying,
  locked = false,
}: {
  board: SessionBoardData;
  contact: string | null;
  onContact: (key: string) => void;
  onApply: (fixId: string) => void;
  applying: string | null;
  /** The run of show can't be read: fixes can't be applied. */
  locked?: boolean;
}) {
  return (
    <Card labelledBy="coffee-fixes">
      <CardHead id="coffee-fixes" title={fc.heading} />
      {board.fixes.length === 0 ? (
        <p className="m-0 text-[15px] text-dashboard-text-light">
          {board.scheduled ? fc.allScheduled : fc.beforeAuto}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {board.fixes.map((fix) => {
            const sp = board.sponsors.find((s) => s.id === fix.sponsor);
            if (!sp) return null;
            const v = fixView(fix, sp);
            const key = `fix:${fix.id}`;
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
                <p className="m-0 text-[15px]">
                  <b className="font-bold">{fc.suggested}</b> {v.suggestion}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DashboardButton
                    variant="primary"
                    className="h-auto min-h-11 w-auto px-3 py-0 text-sm md:min-h-9"
                    disabled={applying !== null || locked}
                    onClick={() => onApply(fix.id)}
                  >
                    {applying === fix.id ? fc.applying : fc.apply}
                  </DashboardButton>
                  <DashboardButton
                    variant="small"
                    aria-expanded={contact === key}
                    onClick={() => onContact(key)}
                  >
                    {copy.contact.button}
                  </DashboardButton>
                </div>
                {contact === key && (
                  <div className="rounded-dashboard-md bg-dashboard-bg-surface px-2.5 py-1">
                    <ContactList sponsor={sp} draft={v.draft} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
