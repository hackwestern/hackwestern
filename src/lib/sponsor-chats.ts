// Whether the sponsor portal shows coffee chats (decisions 2026-11-20,
// "Sponsors without coffee chats"). The server works out hasCoffeeChats
// once (getSponsorPortalInfo: Sponsor Day-Of checkbox, failing open, and not
// opted out); pages only ask this.

export type ChatsInfo = {
  hasCoffeeChats: boolean;
  viewerIsOrganizer: boolean;
};

/**
 * Show Chats, Scan and every coffee chat bit? Yes while the info is still
 * loading (never hide a paying sponsor's chats on a slow read), yes for a
 * signed-in organizer on the portal link (they can turn it back on), else
 * the sponsor's flag.
 */
export function showChats(info: ChatsInfo | null | undefined): boolean {
  return !info || info.hasCoffeeChats || info.viewerIsOrganizer;
}
