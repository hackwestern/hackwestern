import { CoffeeChatBoard } from "~/components/sponsors/coffee-chat-board";

// Organizer Coffee chats tab: one rooms x time view with the sponsor strip
// and block dialogs (docs/flows/coffee-chat-room-blocks.md v2). Each
// sponsor's watcher and totals also live on the Sponsors tab's table.
// `sponsor` (an id or name, from ?sponsor=) highlights that sponsor.
export function CoffeeChatsTab({ sponsor }: { sponsor: string | null }) {
  return <CoffeeChatBoard sponsor={sponsor} />;
}
