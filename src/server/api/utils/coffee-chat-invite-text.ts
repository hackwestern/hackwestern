import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
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

/** An instant as Eastern (UTC-5 in November) "10:00 AM". */
export function easternClock(at: Date): string {
  const minutes =
    (((at.getUTCHours() * 60 + at.getUTCMinutes() - 5 * 60) % 1440) + 1440) %
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
