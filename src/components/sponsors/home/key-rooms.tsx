import { House } from "lucide-react";
import { IveyWalkNote } from "~/components/ivey-walk-note";
import { card, CardTitle } from "~/components/sponsors/portal-ui";
import { sponsorHomeCopy } from "~/content/sponsor-home";

const copy = sponsorHomeCopy.keyRooms;

export type KeyRoomChat = {
  rep: string;
  room: string;
  building: "near" | "ivey";
  /** "HH:MM", for the order rooms are listed in. */
  start: string;
};

const unique = (rooms: string[]) => [...new Set(rooms)];

/**
 * Home's Key rooms (mock sponsor-chats-v3): the sponsor lounge, coffee chat
 * rooms and where to leave things overnight. Before organizers send the
 * chats, the coffee chat row says when rooms are assigned; after, it lists
 * the real rooms, then each rep's.
 */
export function KeyRooms({
  chats,
  mapHref,
}: {
  chats: KeyRoomChat[] | null;
  /** The portal map opened on Ivey, for the Ivey walk note's Check map. */
  mapHref?: string;
}) {
  const ordered = [...(chats ?? [])].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const main = unique(
    ordered.filter((c) => c.building === "near").map((c) => c.room),
  );
  const ivey = unique(
    ordered.filter((c) => c.building === "ivey").map((c) => c.room),
  );
  const line = [
    main.map(copy.room).join(", "),
    ivey.length ? copy.iveyGroup(ivey) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const reps = unique(ordered.map((c) => c.rep)).map((rep) => ({
    rep,
    rooms: unique(
      ordered
        .filter((c) => c.rep === rep)
        .map((c) =>
          c.building === "ivey" ? copy.iveyRoom(c.room) : copy.room(c.room),
        ),
    ),
  }));
  const row =
    "flex min-w-0 items-center gap-3 border-t border-dashboard-border-subtle py-3 first:border-t-0";
  return (
    <section
      aria-labelledby="keyrooms-heading"
      data-tour="home-keyrooms"
      className={card}
    >
      <CardTitle id="keyrooms-heading" icon={<House aria-hidden />}>
        {copy.title}
      </CardTitle>
      <div className="flex flex-col text-sm">
        <div className={row}>
          <div className="min-w-0 flex-1">
            <b className="block font-semibold">{copy.lounge.label}</b>
            <span className="block text-[13px] text-dashboard-text-light">
              {copy.lounge.hint}
            </span>
          </div>
          <span className="tabular-nums">{copy.lounge.room}</span>
        </div>
        <div className={row}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="block font-semibold">{copy.chats}</b>
            {line ? (
              <>
                <span className="font-semibold tabular-nums">{line}</span>
                <span className="flex flex-wrap gap-x-3.5 text-[13px] text-dashboard-text-light">
                  {reps.map((r) => (
                    <span key={r.rep} className="whitespace-nowrap">
                      <b className="font-semibold">{copy.repRooms(r.rep)}</b>{" "}
                      {r.rooms.join(", ")}
                    </span>
                  ))}
                </span>
                {ivey.length > 0 && (
                  <IveyWalkNote
                    who="sponsor"
                    mapHref={mapHref ?? null}
                    className="mt-1 text-[13px]"
                  />
                )}
              </>
            ) : (
              <span className="text-[13px] text-dashboard-text-light">
                {copy.chatsPending}
              </span>
            )}
          </div>
        </div>
        <div className={row}>
          <div className="min-w-0 flex-1">
            <b className="block font-semibold">{copy.belongings.label}</b>
            <span className="block text-[13px] text-dashboard-text-light">
              {copy.belongings.hint}
            </span>
          </div>
          <span className="tabular-nums">{copy.belongings.room}</span>
        </div>
      </div>
    </section>
  );
}
