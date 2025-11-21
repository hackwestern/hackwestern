import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { db } from "~/server/db";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { PKPass } from "passkit-generator";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import crypto from "crypto";
import https from "https";
import { env } from "~/env";

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
  // Get certificates from environment variables
  if (!env.APPLE_WWDR_CERT || !env.APPLE_SIGNER_CERT || !env.APPLE_SIGNER_KEY) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Apple Wallet certificates not configured. Please set APPLE_WWDR_CERT, APPLE_SIGNER_CERT, and APPLE_SIGNER_KEY environment variables.",
    });
  }

  // Convert environment variables to Buffers, handling escaped newlines
  // Environment variables may contain \n as literal strings, so we need to replace them
  const formatPem = (pemString: string): Buffer => {
    // Replace literal \n with actual newlines if needed
    const formatted = pemString.replace(/\\n/g, "\n");
    return Buffer.from(formatted, "utf8");
  };

  const { wwdr, signerCert, signerKey, signerKeyPassphrase } = {
    wwdr: formatPem(env.APPLE_WWDR_CERT),
    signerCert: formatPem(env.APPLE_SIGNER_CERT),
    signerKey: formatPem(env.APPLE_SIGNER_KEY),
    signerKeyPassphrase: env.APPLE_CERT_PASS,
  };

  const passTemplate = {
    formatVersion: 1,
    passTypeIdentifier: "pass.com.hackwestern12.card",
    teamIdentifier: "G2TW9ZYVUF",
    organizationName: "Hack Western",
    description: "Hack Western 12 Pass",
    logoText: `${user.name ?? "[NAME]"}'s Badge`,
    backgroundColor: "rgb(235, 223, 247)",
    serialNumber: user.id,
    eventTicket: {
      primaryFields: [],
      secondaryFields: [
        {
          key: "email",
          label: "Email",
          value: user.email,
        },
        {
          key: "type",
          label: "Role",
          value: user.type
            ? user.type.charAt(0).toUpperCase() + user.type.slice(1)
            : "Hacker",
        },
      ],
      backFields: [
        {
          key: "rawId",
          label: "Raw ID",
          value: user.id,
        },
      ],
    },
    barcodes: [
      {
        message: personalUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      },
    ],
  };

  const tempPassPath = path.join(
    process.cwd(),
    "src/server/api/passModel/temp.pass",
  );
  if (!fs.existsSync(tempPassPath)) {
    fs.mkdirSync(tempPassPath, { recursive: true });
  }
  fs.writeFileSync(
    path.join(tempPassPath, "pass.json"),
    JSON.stringify(passTemplate, null, 2),
  );

  // Download images BEFORE copying from original pass
  const bannerUrl = "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/banner.png";
  const logoUrl = "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/logo.png";

  const stripPath = path.join(tempPassPath, "strip.png");
  const strip2xPath = path.join(tempPassPath, "strip@2x.png");
  const logoPath = path.join(tempPassPath, "logo.png");
  const logo2xPath = path.join(tempPassPath, "logo@2x.png");

  // Download strip image (banner) - appears at top in Event Ticket passes
  try {
    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(stripPath);
      https.get(bannerUrl, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            // Copy to @2x version as well
            fs.copyFileSync(stripPath, strip2xPath);
            console.log("Strip image downloaded successfully");
            resolve();
          });
        } else {
          file.close();
          if (fs.existsSync(stripPath)) {
            fs.unlinkSync(stripPath);
          }
          reject(new Error(`Failed to download banner: ${response.statusCode}`));
        }
      }).on("error", (err) => {
        if (fs.existsSync(stripPath)) {
          fs.unlinkSync(stripPath);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error("Error downloading strip image:", error);
    // Continue without strip if download fails
  }

  // Download logo image
  try {
    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(logoPath);
      https.get(logoUrl, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            // Copy to @2x version as well
            fs.copyFileSync(logoPath, logo2xPath);
            console.log("Logo image downloaded successfully");
            resolve();
          });
        } else {
          file.close();
          if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
          }
          reject(new Error(`Failed to download logo: ${response.statusCode}`));
        }
      }).on("error", (err) => {
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error("Error downloading logo image:", error);
    // Fall back to original logo if download fails
  }

  // Copy other required images from original pass
  const originalPassPath = path.join(
    process.cwd(),
    "src/server/api/passModel/hackWestern.pass",
  );
  ["icon.png", "icon@2x.png"].forEach((file) => {
    if (fs.existsSync(path.join(originalPassPath, file))) {
      fs.copyFileSync(
        path.join(originalPassPath, file),
        path.join(tempPassPath, file),
      );
    }
  });

  // Only copy logo if we didn't download it
  if (!fs.existsSync(logoPath)) {
    ["logo.png", "logo@2x.png"].forEach((file) => {
      if (fs.existsSync(path.join(originalPassPath, file))) {
        fs.copyFileSync(
          path.join(originalPassPath, file),
          path.join(tempPassPath, file),
        );
      }
    });
  }

  // Verify strip image exists before creating pass
  if (fs.existsSync(stripPath)) {
    console.log("Strip image confirmed in pass bundle:", stripPath);
  } else {
    console.warn("Strip image not found - it may not appear on the pass");
  }

  const pass = await PKPass.from(
    {
      model: tempPassPath,
      certificates: {
        wwdr,
        signerCert,
        signerKey,
        signerKeyPassphrase,
      },
    },
    {
      serialNumber: user.id,
    },
  );

  const stream = pass.getAsStream();
  const chunks: Buffer[] = [];

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (error) => {
      console.error("Error generating pass stream:", error);
      reject(error);
    });
  });

  const pkpassBase64 = buffer.toString("base64");

  try {
    fs.rmSync(tempPassPath, { recursive: true, force: true });
  } catch (error) {
    console.error("Error cleaning up temporary files:", error);
  }

  return {
    qrCode: qrBase64,
    pkpass: pkpassBase64,
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

  // Load credentials
  const credentialsPath = path.join(
    process.cwd(),
    "google-wallet-credentials.json",
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Google Wallet credentials file not found. Please add google-wallet-credentials.json to project root.",
    });
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8")) as {
    client_email: string;
    private_key: string;
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
