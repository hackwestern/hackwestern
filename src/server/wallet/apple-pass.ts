import fs from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";

const PASS_TYPE_ID = "pass.com.hackwestern.hw13";
const TEAM_ID = "B2F6TWN8SZ";

// Read at request time; next.config.js traces this folder into the API route.
const ASSETS = path.join(process.cwd(), "src/server/wallet/apple");

const TEAL = "rgb(21, 71, 96)"; // top of the HW13 banner
const CREAM = "rgb(250, 244, 230)";

export type PassHolder = {
  userId: string;
  hackerId: string;
  name: string;
  school: string | null;
  role: string;
};

export type PassCertificates = {
  wwdr: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
};

function readImages(dir: string) {
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".png"))
      .map((file) => [file, fs.readFileSync(path.join(dir, file))]),
  );
}

export function buildApplePass(
  holder: PassHolder,
  certificates: PassCertificates,
): Buffer {
  const pass = new PKPass(readImages(ASSETS), certificates, {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    teamIdentifier: TEAM_ID,
    serialNumber: holder.userId,
    organizationName: "Hack Western",
    description: "Hack Western 13 pass",
    logoText: "Hack Western 13",
    backgroundColor: TEAL,
    foregroundColor: CREAM,
    labelColor: CREAM,
  });

  // eventTicket is the pass type that shows a banner (strip) image.
  pass.type = "eventTicket";
  pass.headerFields.push({ key: "dates", label: "DATES", value: "Nov 20–22" });
  pass.secondaryFields.push({
    key: "name",
    label: holder.role,
    value: holder.name,
  });
  if (holder.school) {
    pass.auxiliaryFields.push({
      key: "school",
      label: "SCHOOL",
      value: holder.school,
    });
  }
  pass.backFields.push(
    { key: "dates-full", label: "Dates", value: "November 20 to 22, 2026" },
    { key: "hacker-id", label: "Hacker ID", value: holder.hackerId },
    { key: "site", label: "Website", value: "https://hackwestern.com" },
  );
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: holder.hackerId,
    messageEncoding: "iso-8859-1",
    altText: holder.hackerId,
  });

  return pass.getAsBuffer();
}
