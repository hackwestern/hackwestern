import { type sheets_v4 } from "googleapis";

import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";
import { type SheetsClient } from "~/server/api/utils/sponsor-sheets";
import { fetchHwContactNames } from "~/server/api/utils/sponsor-hw-contacts";

const SPONSOR_INFO_TAB = "sponsor info";

export async function ensureSponsorInfoTab(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const found = meta.data.sheets?.find(
    (s) => s.properties?.title?.trim().toLowerCase() === "sponsor info",
  );

  let tabName = found?.properties?.title;
  let sheetId = found?.properties?.sheetId ?? null;

  if (!tabName) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SPONSOR_INFO_TAB,
              },
            },
          },
        ],
      },
    });

    const newProps = addRes.data.replies?.[0]?.addSheet?.properties;
    tabName = newProps?.title ?? SPONSOR_INFO_TAB;
    sheetId = newProps?.sheetId ?? null;

    // Header row with 8 columns:
    // Sponsor Name, Status, Judging Room Number, Booth Location, HW Contact,
    // Workshop Location, Workshop Time (workshop columns are optional), and
    // Coffee Chat Max Minutes (sponsor's total coffee-chat allowance; empty
    // or zero disables coffee-chat booking for that sponsor).
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1:H1`,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [
          [
            "Sponsor Name",
            "Status",
            "Judging Room Number",
            "Booth Location",
            "HW Contact",
            "Workshop Location",
            "Workshop Time",
            "Coffee Chat Max Minutes",
          ],
        ],
      },
    });
  } else {
    // Existing tab: make sure the workshop headers (cols F & G) and the
    // coffee-chat allowance header (col H) exist.
    try {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A1:H1`,
      });
      const headerRow = (headerRes.data.values?.[0] ?? []) as string[];
      const lower = headerRow.map((c) =>
        String(c ?? "")
          .replace(/\p{Cf}/gu, "")
          .trim()
          .toLowerCase(),
      );
      const hasWorkshopLocation = lower.some(
        (c) => c.includes("workshop") && c.includes("location"),
      );
      const hasWorkshopTime = lower.some(
        (c) => c.includes("workshop") && c.includes("time"),
      );
      const hasCoffeeMinutes = lower.some(
        (c) =>
          c.includes("coffee") || (c.includes("max") && c.includes("minute")),
      );
      if (!hasWorkshopLocation || !hasWorkshopTime || !hasCoffeeMinutes) {
        const values = [...headerRow];
        while (values.length < 7) values.push("");
        if (!hasWorkshopLocation) values[5] = "Workshop Location";
        if (!hasWorkshopTime) values[6] = "Workshop Time";
        if (!hasCoffeeMinutes) values[7] = "Coffee Chat Max Minutes";
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${tabName}'!A1:H1`,
          valueInputOption: "RAW",
          requestBody: {
            majorDimension: "ROWS",
            values: [values],
          },
        });
      }
    } catch (e) {
      console.warn("Could not ensure sponsor info header columns:", e);
    }
  }

  // Ensure dropdown data validation:
  // - Column B (Status): Not arrived, Checked in, Booth set up, Workshop live, Left
  // - Column E (HW Contact): names from the "HW Contacts" tab
  if (sheetId !== null) {
    const hwContactNames = await fetchHwContactNames(sheets, spreadsheetId);
    try {
      const requests: sheets_v4.Schema$Request[] = [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1, // row 2 down
              startColumnIndex: 1, // Column B (A=0, B=1)
              endColumnIndex: 2,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: SPONSOR_STATUS_VALUES.map((val) => ({
                  userEnteredValue: val,
                })),
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
      ];

      if (hwContactNames.length > 0) {
        requests.push({
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1, // row 2 down
              startColumnIndex: 4, // Column E (HW Contact)
              endColumnIndex: 5,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: hwContactNames.map((name) => ({
                  userEnteredValue: name,
                })),
              },
              strict: false,
              showCustomUi: true,
            },
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    } catch (e) {
      console.warn("Could not apply dropdown validation to sheet:", e);
    }
  }

  return tabName;
}
