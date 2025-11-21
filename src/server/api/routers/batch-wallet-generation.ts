/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env";
import { PKPass } from "passkit-generator";
import path from "path";
import os from "os";
import fs from "fs";
import https from "https";

// R2 Bucket Configuration Constants for Wallet Passes
const WALLET_PASSES_FOLDER = "wallet-passes";

// Create R2 client for wallet bucket using existing R2 environment variables
const walletBucketClient = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

type User = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  type: string | null;
};

export const batchWalletRouter = createTRPCRouter({
  generateAllApplePasses: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Check if user is organizer
      const currentUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, ctx.session.user.id),
      });

      if (currentUser?.type !== "organizer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organizers can generate batch wallet passes",
        });
      }

      // Validate certificates
      if (!env.APPLE_WWDR_CERT || !env.APPLE_SIGNER_CERT || !env.APPLE_SIGNER_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Apple Wallet certificates not configured. Please set APPLE_WWDR_CERT, APPLE_SIGNER_CERT, and APPLE_SIGNER_KEY environment variables.",
        });
      }

      // Get all users from database
      const allUsers = await db.query.users.findMany();

      if (allUsers.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No users found in database",
        });
      }

      console.log(`Starting batch generation for ${allUsers.length} users...`);

      // Prepare certificates once
      const fixPem = (x: string) => Buffer.from(x.replace(/\\n/g, "\n"), "utf8");
      const wwdr = fixPem(env.APPLE_WWDR_CERT);
      const signerCert = fixPem(env.APPLE_SIGNER_CERT);
      const signerKey = fixPem(env.APPLE_SIGNER_KEY);
      const signerKeyPassphrase = env.APPLE_CERT_PASS;

      // Image URLs
      const bannerUrl = "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/banner.png";
      const logoUrl = "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/logo.png";
      const iconUrl = "https://pub-3e4bb0fc196e4177a8039cf97986b109.r2.dev/icon.png";

      // Download images once and reuse
      const [bannerBuffer, logoBuffer, iconBuffer] = await Promise.all([
        downloadImageToBuffer(bannerUrl),
        downloadImageToBuffer(logoUrl),
        downloadImageToBuffer(iconUrl),
      ]);

      const results: Array<{
        userId: string;
        email: string;
        success: boolean;
        url?: string;
        error?: string;
      }> = [];

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < allUsers.length; i += batchSize) {
        const batch = allUsers.slice(i, i + batchSize);
        const batchPromises = batch.map(async (user) => {
          try {
            const result = await generateAndUploadPass(
              user,
              wwdr,
              signerCert,
              signerKey,
              signerKeyPassphrase,
              bannerBuffer,
              logoBuffer,
              iconBuffer,
            );
            return {
              userId: user.id,
              email: user.email,
              success: true,
              url: result.url,
            };
          } catch (error) {
            console.error(`Failed to generate pass for user ${user.id}:`, error);
            return {
              userId: user.id,
              email: user.email,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allUsers.length / batchSize)}`);
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        total: allUsers.length,
        success: successCount,
        failed: failureCount,
        results,
        folder: WALLET_PASSES_FOLDER,
        baseUrl: env.R2_PUBLIC_BASE_URL,
      };
    } catch (error) {
      console.error("Error in batch wallet generation:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to generate batch wallet passes: " +
          (error instanceof Error ? error.message : String(error)),
      });
    }
  }),
});

// Helper function to download image to buffer
function downloadImageToBuffer(url: string): Promise<Buffer | null> {
  return Promise.race([
    new Promise<Buffer | null>((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode === 200) {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => {
              resolve(Buffer.concat(chunks));
            });
            response.on("error", reject);
          } else {
            reject(new Error(`Failed to download image: ${response.statusCode}`));
          }
        })
        .on("error", reject);
    }),
    new Promise<Buffer | null>((_, reject) =>
      setTimeout(() => reject(new Error("Download timeout")), 10000),
    ),
  ]).catch((error) => {
    console.warn(`Failed to download image from ${url}:`, error);
    return null;
  });
}

// Generate pass for a single user and upload to R2
async function generateAndUploadPass(
  user: User,
  wwdr: Buffer,
  signerCert: Buffer,
  signerKey: Buffer,
  signerKeyPassphrase: string | undefined,
  bannerBuffer: Buffer | null,
  logoBuffer: Buffer | null,
  iconBuffer: Buffer | null,
): Promise<{ url: string; fileName: string }> {
  // Generate QR code
  const personalUrl = user.id;
  const qrBase64 = await QRCode.toDataURL(personalUrl, {
    width: 500,
    errorCorrectionLevel: "H",
  });

  // Create pass.json template
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

  // Create temporary directory for pass generation
  const passDir = path.join(os.tmpdir(), `pass_${user.id}_${Date.now()}.pass`);
  fs.mkdirSync(passDir, { recursive: true });

  try {
    // Write pass.json
    fs.writeFileSync(path.join(passDir, "pass.json"), JSON.stringify(passJson, null, 2));

    // Write images if available
    if (bannerBuffer) {
      fs.writeFileSync(path.join(passDir, "strip.png"), bannerBuffer);
      fs.writeFileSync(path.join(passDir, "strip@2x.png"), bannerBuffer);
    }

    if (logoBuffer) {
      fs.writeFileSync(path.join(passDir, "logo.png"), logoBuffer);
      fs.writeFileSync(path.join(passDir, "logo@2x.png"), logoBuffer);
    }

    if (iconBuffer) {
      fs.writeFileSync(path.join(passDir, "icon.png"), iconBuffer);
      fs.writeFileSync(path.join(passDir, "icon@2x.png"), iconBuffer);
    }

    // Generate .pkpass file using PKPass
    const pkpass = await PKPass.from(
      {
        model: passDir,
        certificates: {
          wwdr,
          signerCert,
          signerKey,
          ...(signerKeyPassphrase && { signerKeyPassphrase }),
        },
      },
      { serialNumber: user.id },
    );

    // Convert to buffer
    const stream = pkpass.getAsStream();
    const chunks: Buffer[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });

    // Upload to R2 bucket with naming: pass-{timestamp}-{userId}.pkpass
    const currentTime = Date.now();
    const fileName = `${WALLET_PASSES_FOLDER}/pass-${currentTime}-${user.id}.pkpass`;

    await walletBucketClient.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: "application/vnd.apple.pkpass",
      }),
    );

    const url = `${env.R2_PUBLIC_BASE_URL}/${fileName}`;

    return { url, fileName };
  } finally {
    // Cleanup temporary directory
    if (fs.existsSync(passDir)) {
      fs.rmSync(passDir, { recursive: true, force: true });
    }
  }
}

