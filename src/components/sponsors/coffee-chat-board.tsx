import { useEffect, useState } from "react";
import {
  CoffeeChatRoomTable,
  useLiveChatBoard,
} from "~/components/sponsors/coffee-chat-room-table";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { sponsorNameForParam } from "~/lib/sponsor-organizer";
import type { BoardSponsor } from "~/server/api/utils/coffee-chat-board";

const copy = coffeeChatCopy.organizer.board;

// Organizer Coffee chats tab: ONE view (docs/flows/coffee-chat-room-
// blocks.md v2). The sponsor strip, then rooms x time with each sponsor's
// room blocks; a block opens every slot's hackers and its actions, a free
// cell gives the room. Picking a sponsor in the strip (or arriving with
// ?sponsor=, an id or name) highlights their blocks; Escape clears it.
export function CoffeeChatBoard({ sponsor = null }: { sponsor?: string | null }) {
  const board = useLiveChatBoard();
  const linked = sponsorNameForParam(
    sponsor,
    board.data?.sponsors ?? NO_SPONSORS,
  );
  const [highlight, setHighlight] = useState<string | null>(null);
  // ?sponsor= highlights that sponsor once the board knows them.
  useEffect(() => {
    if (linked) setHighlight(linked);
  }, [linked]);

  return (
    <section
      aria-labelledby="chat-board"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="chat-board" className="m-0 text-lg font-semibold">
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>
      <CoffeeChatRoomTable
        highlight={highlight}
        onHighlight={(name) => setHighlight((h) => (h === name ? null : name))}
        onClearHighlight={() => setHighlight(null)}
      />
    </section>
  );
}

const NO_SPONSORS: BoardSponsor[] = [];
