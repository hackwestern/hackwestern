import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { db } from "~/server/db";
import { z } from "zod";
import path from 'path';
import fs from 'fs';
import { PKPass } from "passkit-generator";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";



export const qrRouter = createTRPCRouter({
  generate: protectedProcedure
    .mutation(async ({ input, ctx }) => {
      try {
        // #1 Grab User Info from DB
        const user = await db.query.users.findFirst({
          where: eq(users.id, ctx.session.user.id)
        });

        if (!user || !user.emailVerified) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found in database or email hasn't been verified yet. Please verify your email before generating a Wallet Pass."
          });
        }

        // const user = {
        //   id: "123",
        //   name: "John Doe",
        //   email: "john.doe@example.com",
        //   type: "Attendee"
        // };

        // #2 Generate QR code directly as base64
        const PERSONAL_URL = `https://hackwestern.com/wallet/${ctx.session.user.id}`
        console.log("Generating QR code...");
        const qrBase64 = await QRCode.toDataURL(PERSONAL_URL, {
          width: 500,
          errorCorrectionLevel: "H",
        });
        console.log("QR code generated");

        // #3 Generate Apple Wallet Badge 
        const { wwdr, signerCert, signerKey, signerKeyPassphrase } = {
          wwdr: fs.readFileSync(path.join(process.cwd(), 'src/server/api/certs/AppleWWDR.pem')),
          signerCert: fs.readFileSync(path.join(process.cwd(), 'src/server/api/certs/certificate.pem')),
          signerKey: fs.readFileSync(path.join(process.cwd(), 'src/server/api/certs/key.pem')),
          signerKeyPassphrase: process.env.APPLE_CERT_PASS
        };

        // Create dynamic pass template
        const passTemplate = {
          formatVersion: 1,
          passTypeIdentifier: "pass.com.hackwestern12.card",
          teamIdentifier: "G2TW9ZYVUF",
          organizationName: "Hack Western",
          description: "Hack Western 12 Pass",
          backgroundColor: "rgb(165, 105, 189)",
          logoText: "Hack Western",
          serialNumber: user.id,
          generic: {
            headerFields: [
              {
                key: 'attendee',
                label: 'Attendee',
                value: user.name
              }
            ],
            primaryFields: [
              {
                key: 'email',
                label: 'Email',
                value: user.email
              }
            ],
            secondaryFields: [
              {
                key: 'type',
                label: 'Type',
                value: user.type
              },
              {
                key: 'points',
                label: 'Points',
                value: '0'
              }
            ]
          },
          barcode: {
            message: PERSONAL_URL,
            format: "PKBarcodeFormatQR",
            messageEncoding: "iso-8859-1"
          }
        };

        // Write the dynamic template to a temporary file
        const tempPassPath = path.join(process.cwd(), 'src/server/api/passModel/temp.pass');
        if (!fs.existsSync(tempPassPath)) {
          fs.mkdirSync(tempPassPath, { recursive: true });
        }
        fs.writeFileSync(path.join(tempPassPath, 'pass.json'), JSON.stringify(passTemplate, null, 2));

        // Copy required files from the original pass template, but skip strip.png and strip@2x.png
        const originalPassPath = path.join(process.cwd(), 'src/server/api/passModel/hackWestern.pass');
        ['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png'].forEach(file => {
          if (fs.existsSync(path.join(originalPassPath, file))) {
            fs.copyFileSync(
              path.join(originalPassPath, file),
              path.join(tempPassPath, file)
            );
          }
        });

        const pass = await PKPass.from({
          model: tempPassPath,
          certificates: {
            wwdr,
            signerCert,
            signerKey,
            signerKeyPassphrase
          }
        }, {
          serialNumber: user.id
        });

        // Update localization
        pass.localize('en', {
          event: 'Hack Western 12',
          label: 'Event'
        });

        // #3 Generate .pkpass and convert to buffer
        const stream = pass.getAsStream();
        const chunks: Buffer[] = [];

        // Convert stream to buffer using Promise
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', (error) => {
            console.error('Error generating pass stream:', error);
            reject(error);
          });
        });

        const pkpassBase64 = buffer.toString('base64');

        // Clean up temporary files
        try {
          fs.rmSync(tempPassPath, { recursive: true, force: true });
        } catch (error) {
          console.error('Error cleaning up temporary files:', error);
        }

        return {
          qrCode: qrBase64,
          pkpass: pkpassBase64
        };

      } catch (error) {
        console.error("Error generating pass:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate pass: " + (error instanceof Error ? error.message : String(error)),
        });
      }
    }),
});
