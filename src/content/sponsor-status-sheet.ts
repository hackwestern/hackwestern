// Errors an organizer sees when setting a sponsor's status on the Sponsor
// Day-Of tab (setSponsorStatus in src/server/api/routers/sponsor-dashboard.ts).

export const sponsorStatusSheetCopy = {
  errors: {
    noTab:
      'The Spon Team sheet has no "Sponsor Day-Of" tab with a "Sponsor Name" header in column A',
    noColumn: 'The Sponsor Day-Of tab has no "Status" column',
    noCcColumn: 'The Sponsor Day-Of tab has no "At CC workshop" column',
    notFound: (name: string) =>
      `Sponsor not found on the Sponsor Day-Of tab: ${name}`,
    writeFailed: "Failed to update sponsor status in spreadsheet",
  },
  // Only the live site writes to the Google Sheet; a local or test server
  // saves the change in the dashboard only.
  notWritten:
    "Saved here, but this test server doesn't write to the Google Sheet. The live site does.",
} as const;
