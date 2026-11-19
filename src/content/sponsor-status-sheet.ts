// Errors an organizer sees when setting a sponsor's status on the Sponsor
// Day-Of tab (setSponsorStatus in src/server/api/routers/sponsor-dashboard.ts).

export const sponsorStatusSheetCopy = {
  errors: {
    noTab:
      'The Spon Team sheet has no "Sponsor Day-Of" tab with a "Sponsor Name" header in column A',
    noColumn: 'The Sponsor Day-Of tab has no "Status" column',
    notFound: (name: string) =>
      `Sponsor not found on the Sponsor Day-Of tab: ${name}`,
    writeFailed: "Failed to update sponsor status in spreadsheet",
  },
  notWritten: "Not written (sheet writes off)",
} as const;
