import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { buildApplePass, type PassCertificates } from "./apple-pass";

const holder = {
  userId: "user-1",
  hackerId: "brave-otter-kite",
  name: "Jessica Wang",
  school: "Western University",
  role: "HACKER",
  realm: "safari" as const,
};

let dir: string;
let certificates: PassCertificates;

// Throwaway self-signed cert: enough to sign, not trusted by Wallet.
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "apple-pass-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=test",
      "-keyout",
      key,
      "-out",
      cert,
    ],
    { stdio: "ignore" },
  );
  const certPem = fs.readFileSync(cert, "utf8");
  certificates = {
    wwdr: certPem,
    signerCert: certPem,
    signerKey: fs.readFileSync(key, "utf8"),
  };
});

function unzip(pass: Buffer, file: string) {
  const zip = path.join(dir, "pass.pkpass");
  fs.writeFileSync(zip, pass);
  return execFileSync("unzip", ["-p", zip, file]);
}

describe("buildApplePass", () => {
  test("QR holds the hacker ID and the teal look carries the banner", () => {
    const pass = buildApplePass(holder, "teal", certificates);
    const json = JSON.parse(unzip(pass, "pass.json").toString()) as {
      barcodes: { message: string }[];
      backgroundColor: string;
      eventTicket?: unknown;
    };
    const manifest = JSON.parse(
      unzip(pass, "manifest.json").toString(),
    ) as Record<string, string>;

    expect(json.barcodes[0]?.message).toBe("brave-otter-kite");
    expect(json.backgroundColor).toBe("rgb(21, 71, 96)");
    expect(json.eventTicket).toBeDefined();
    expect(Object.keys(manifest)).toEqual(
      expect.arrayContaining(["pass.json", "icon.png", "strip@3x.png"]),
    );
    expect(unzip(pass, "signature").length).toBeGreaterThan(0);
  });

  test("realm look uses the realm color and no banner", () => {
    const pass = buildApplePass(holder, "realm", certificates);
    const json = JSON.parse(unzip(pass, "pass.json").toString()) as {
      backgroundColor: string;
      generic?: unknown;
    };
    const manifest = JSON.parse(
      unzip(pass, "manifest.json").toString(),
    ) as Record<string, string>;

    expect(json.backgroundColor).toBe("rgb(157, 61, 49)");
    expect(json.generic).toBeDefined();
    expect(Object.keys(manifest)).not.toContain("strip.png");
  });
});
