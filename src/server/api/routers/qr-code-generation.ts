/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { db } from "~/server/db";
import { z } from "zod";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import crypto from "crypto";
import https from "https";
import { env } from "~/env";
import fs from "fs";
import { PKPass } from "passkit-generator";
import path from "path";
import os from "os";

type User = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  type: string | null;
};

export const qrRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(
      z.object({
        walletType: z.enum(["APPLE", "GOOGLE"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // #1 Grab User Info from DB
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.session.user.id),
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "User not found in database. Please verify your email before generating a Wallet Pass.",
          });
        }

        // #2 Generate QR code directly as base64
        const PERSONAL_URL = `${ctx.session.user.id}`;
        console.log("Generating QR code...");
        const qrBase64 = await QRCode.toDataURL(PERSONAL_URL, {
          width: 500,
          errorCorrectionLevel: "H",
        });
        console.log("QR code generated");

        // #3 Route based on wallet type
        if (input.walletType === "GOOGLE") {
          return await generateGooglePass(user, PERSONAL_URL, qrBase64);
        } else {
          return await generateApplePass(user, PERSONAL_URL, qrBase64);
        }
      } catch (error) {
        console.error("Error generating pass:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to generate pass: " +
            (error instanceof Error ? error.message : String(error)),
        });
      }
    }),
});

// Apple Wallet Generation
async function generateApplePass(
  user: User,
  personalUrl: string,
  qrBase64: string,
) {
  // --- 1. VALIDATE CERTS ---
  if (!env.APPLE_WWDR_CERT || !env.APPLE_SIGNER_CERT || !env.APPLE_SIGNER_KEY) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Apple Wallet certificates not configured. Ensure APPLE_WWDR_CERT, APPLE_SIGNER_CERT, APPLE_SIGNER_KEY exist.",
    });
  }

  const fixPem = (x: string) => Buffer.from(x.replace(/\\n/g, "\n"), "utf8");

  const wwdr = fixPem(env.APPLE_WWDR_CERT);
  const signerCert = fixPem(env.APPLE_SIGNER_CERT);
  const signerKey = fixPem(env.APPLE_SIGNER_KEY);
  const signerKeyPassphrase = env.APPLE_CERT_PASS;

  // --- 2. TEMP DIRECTORY (.pass REQUIRED!) ---
  const passDir = path.join(os.tmpdir(), `pass_${user.id}_${Date.now()}.pass`);
  fs.mkdirSync(passDir, { recursive: true });

  // --- 3. PASS.JSON TEMPLATE ---
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: "pass.com.hackwestern12.card",
    teamIdentifier: "G2TW9ZYVUF",
    organizationName: "Hack Western",
    description: "Hack Western 12 Pass",
    serialNumber: user.id,
    logoText: `${user.name ?? "[NAME]"}'s Badge`,
    backgroundColor: "rgb(235,223,247)",

    eventTicket: {
      primaryFields: [],
      secondaryFields: [
        { key: "email", label: "Email", value: user.email },
        {
          key: "role",
          label: "Role",
          value: user.type
            ? user.type.charAt(0).toUpperCase() + user.type.slice(1)
            : "Hacker",
        },
      ],
      backFields: [{ key: "id", label: "Raw ID", value: user.id }],
    },

    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: personalUrl,
        messageEncoding: "iso-8859-1",
      },
    ],
  };

  fs.writeFileSync(path.join(passDir, "pass.json"), JSON.stringify(passJson));

  // --- 4. REMOTE IMAGE DOWNLOAD HELPER ---
  async function download(url: string, filepath: string) {
    return new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(filepath);
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            file.close();
            reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        })
        .on("error", reject);
    });
  }

  // --- 5. REQUIRED ASSETS ---
  const assets = [
    {
      url: "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/icon.png",
      name: "icon.png",
    },
    {
      url: "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/logo.png",
      name: "logo.png",
    },
    {
      url: "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/banner.png",
      name: "strip.png",
    },
  ];

  // Download + duplicate @2x files
  for (const asset of assets) {
    const full = path.join(passDir, asset.name);
    const full2x = path.join(passDir, asset.name.replace(".png", "@2x.png"));

    await download(asset.url, full);
    fs.copyFileSync(full, full2x);
  }

  // --- 6. BUILD PASS (.pkpass buffer) ---
  const pkpass = await PKPass.from(
    {
      model: passDir,
      certificates: {
        wwdr,
        signerCert,
        signerKey,
        ...(signerKeyPassphrase && {
          signerKeyPassphrase,
        }),
      },
    },
    { serialNumber: user.id },
  );

  const stream = pkpass.getAsStream();
  const chunks: Buffer[] = [];

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  // --- 7. CLEANUP ---
  fs.rmSync(passDir, { recursive: true, force: true });

  // --- 8. RETURN ---
  return {
    qrCode: qrBase64,
    pkpass: buffer.toString("base64"),
    walletType: "APPLE" as const,
  };
}

async function generateGooglePass(
  user: User,
  personalUrl: string,
  qrBase64: string,
) {
  console.log("=== GOOGLE WALLET GENERATION ===");
  console.log("User:", user.email);
  console.log("Personal URL:", personalUrl);

  // Load credentials from environment variables for serverless compatibility
  if (!env.GOOGLE_WALLET_CLIENT_EMAIL || !env.GOOGLE_WALLET_PRIVATE_KEY) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Google Wallet credentials not configured. Please set GOOGLE_WALLET_CLIENT_EMAIL and GOOGLE_WALLET_PRIVATE_KEY environment variables.",
    });
  }

  // Type-safe access after null checks
  const clientEmail = env.GOOGLE_WALLET_CLIENT_EMAIL;
  const privateKey = env.GOOGLE_WALLET_PRIVATE_KEY.replace(/\\n/g, "\n");

  const credentials = {
    client_email: clientEmail,
    private_key: privateKey,
  };

  // Create JWT client
  const httpClient = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;

  if (!issuerId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "GOOGLE_WALLET_ISSUER_ID not set in environment variables",
    });
  }

  const classId = `${issuerId}.hackwestern12_generic_v3`;

  // Create or update the Generic Class
  const genericClass = {
    id: classId,
    issuerName: "Hack Western",
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: "#EBDFF7",
    logo: {
      sourceUri: {
        uri: "https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "Hack Western Logo",
        },
      },
    },
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['email']",
                    },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['role']",
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };

  try {
    // Check if class exists
    await httpClient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
      method: "GET",
    });
    console.log("Generic class already exists, updating...");
    // Update existing class with new logo
    await httpClient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
      method: "PUT",
      data: genericClass,
    });
    console.log("Generic class updated");
  } catch (err: unknown) {
    if ((err as { response?: { status: number } }).response?.status === 404) {
      // Create class if it doesn't exist
      await httpClient.request({
        url: "https://walletobjects.googleapis.com/walletobjects/v1/genericClass",
        method: "POST",
        data: genericClass,
      });
      console.log("Generic class created");
    } else {
      console.error("Error checking class:", err);
      throw err;
    }
  }

  // Create the Generic Object (individual pass)
  const objectId = `${issuerId}.${user.id.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

  const genericObject = {
    id: objectId,
    classId: classId,
    state: "ACTIVE",
    // Main card title and header
    cardTitle: {
      defaultValue: {
        language: "en-US",
        value: "Hack Western 12",
      },
    },
    header: {
      defaultValue: {
        language: "en-US",
        value: user.name ?? "Attendee",
      },
    },
    // Removed subheader to avoid duplicate role display
    barcode: {
      type: "QR_CODE",
      value: personalUrl,
    },
    heroImage: {
      sourceUri: {
        uri: "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/banner.png",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "Hack Western 12 Banner",
        },
      },
    },
    logo: {
      sourceUri: {
        uri: "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/logo.png",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "Hack Western Logo",
        },
      },
    },
    textModulesData: [
      {
        header: "Email",
        body: user.email,
        id: "email",
      },
      {
        header: "Role",
        body: user.type
          ? user.type.charAt(0).toUpperCase() + user.type.slice(1)
          : "Hacker",
        id: "role",
      },
    ],
    hexBackgroundColor: "#EBDFF7",
  };

  try {
    await httpClient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`,
      method: "GET",
    });

    await httpClient.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`,
      method: "PUT",
      data: genericObject,
    });
    console.log("Generic object updated");
  } catch (err: unknown) {
    if ((err as { response?: { status: number } }).response?.status === 404) {
      await httpClient.request({
        url: "https://walletobjects.googleapis.com/walletobjects/v1/genericObject",
        method: "POST",
        data: genericObject,
      });
      console.log("Generic object created");
    } else {
      console.error("Error with object:", err);
      throw err;
    }
  }

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    origins: ["https://hackwestern.com"],
    typ: "savetowallet",
    payload: {
      genericObjects: [genericObject],
    },
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const base64UrlEncode = (obj: Record<string, unknown>) => {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(claims);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signatureInput)
    .sign(credentials.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;
  const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

  console.log("Google Wallet URL generated successfully");

  return {
    qrCode: qrBase64,
    googleWalletUrl: saveUrl,
    walletType: "GOOGLE" as const,
  };
}
