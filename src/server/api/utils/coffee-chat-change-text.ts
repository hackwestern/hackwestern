import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";

/** Events that tell the hacker about a chat they already have. */
export type CoffeeChatChangeEvent = "cancelled" | "roomMoved";

/** The one-line change notice, shared by the Slack DM and the email. */
export function coffeeChatChangeText(
  event: CoffeeChatChangeEvent,
  chat: { sponsorName: string; slotTime: string; room: string | null },
  escape: (text: string) => string = (text) => text,
): string {
  const time = formatCoffeeChatTime(chat.slotTime);
  const sponsor = escape(chat.sponsorName);
  return event === "cancelled"
    ? coffeeChatNotifyCopy.change.cancelled(sponsor, time)
    : coffeeChatNotifyCopy.change.roomMoved(
        sponsor,
        time,
        escape(chat.room ?? coffeeChatNotifyCopy.roomTba),
      );
}
