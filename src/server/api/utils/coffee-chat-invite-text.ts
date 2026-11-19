import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { COFFEE_CHAT_UTC_OFFSET } from "~/lib/coffee-chat-requests";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import { buildingOf } from "~/lib/coffee-chat-sessions";

/**
 * The words of a session invite (Slack DM and email): when, where with the
 * building, the rep, and the answer-by time. Old per-slot requests (no
 * placement) keep their own copy in coffee-chat-dm.ts / coffee-chat-email.ts.
 */

/** Session invite rows store the room as "Rm 2241"; the board uses "2241". */
export const inviteRoomLabel = (roomId: string) => `Rm ${roomId}`;

/** "Rm 1348" -> "ivey"; null when it isn't a session room. */
export function buildingOfRoomLabel(
  room: string | null,
): "near" | "ivey" | null {
  const id = /(\d{4})/.exec(room ?? "")?.[1];
  return id ? buildingOf(id) : null;
}

/** COFFEE_CHAT_UTC_OFFSET ("-05:00") in minutes (-300). */
const OFFSET_MINUTES = (() => {
  const [, sign, h, m] = /^([+-])(\d{2}):(\d{2})$/.exec(COFFEE_CHAT_UTC_OFFSET)!;
  return (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(m));
})();

/** An instant as chat-day Eastern time, "10:00 AM". */
export function easternClock(at: Date): string {
  const minutes =
    (((at.getUTCHours() * 60 + at.getUTCMinutes() + OFFSET_MINUTES) % 1440) +
      1440) %
    1440;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return formatCoffeeChatTime(`${hh}:${mm}`);
}

export type InviteTextChat = {
  sponsorName: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  repName: string | null;
  expiresAt: Date | null;
};

export function inviteText(chat: InviteTextChat) {
  const when = coffeeChatNotifyCopy.when(
    formatCoffeeChatTime(chat.slotTime),
    chat.durationMinutes,
  );
  const where = coffeeChatInvitesCopy.where(
    chat.room,
    buildingOfRoomLabel(chat.room),
  );
  const answerBy = chat.expiresAt
    ? coffeeChatInvitesCopy.answerBy(easternClock(chat.expiresAt))
    : null;
  return { when, where, answerBy };
}
