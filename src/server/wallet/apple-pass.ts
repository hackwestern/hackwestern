import fs from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";
import type { Realm } from "~/constants/realms";

const PASS_TYPE_ID = "pass.com.hackwestern.hw13";
const TEAM_ID = "B2F6TWN8SZ";

// Read at request time; next.config.js traces this folder into the API route.
const ASSETS = path.join(process.cwd(), "src/server/wallet/apple");

const TEAL = "rgb(21, 71, 96)"; // top of the HW13 banner
const CREAM = "rgb(250, 244, 230)";
const REALM_COLORS: Record<Realm, string> = {
  safari: "rgb(157, 61, 49)",
  desert: "rgb(184, 139, 25)",
  mountain: "rgb(69, 107, 40)",
  ocean: "rgb(81, 149, 197)",
};

// "teal": HW13 banner on teal, same for everyone. "realm": horse logo on the
// hacker's realm color, no banner.
export type PassLook = "teal" | "realm";

export type PassHolder = {
  userId: string;
  hackerId: string;
  name: string;
  school: string | null;
  role: string;
  realm: Realm | null;
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
  look: PassLook,
  certificates: PassCertificates,
): Buffer {
  const banner = look === "teal";
  const pass = new PKPass(
    {
      ...readImages(ASSETS),
      ...(banner ? readImages(path.join(ASSETS, "banner")) : {}),
    },
    certificates,
    {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      serialNumber: holder.userId,
      organizationName: "Hack Western",
      description: "Hack Western 13 pass",
      logoText: "Hack Western 13",
      backgroundColor: banner ? TEAL : REALM_COLORS[holder.realm ?? "ocean"],
      foregroundColor: CREAM,
      labelColor: CREAM,
    },
  );

  // eventTicket is the pass type that shows a banner (strip) image.
  pass.type = banner ? "eventTicket" : "generic";
  pass.headerFields.push({ key: "dates", label: "DATES", value: "Nov 20–22" });
  (banner ? pass.secondaryFields : pass.primaryFields).push({
    key: "name",
    label: holder.role,
    value: holder.name,
  });
  if (holder.school) {
    (banner ? pass.auxiliaryFields : pass.secondaryFields).push({
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
