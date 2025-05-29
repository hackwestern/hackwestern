import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { JWT as GoogleAuthJWT } from "google-auth-library";
import jwt from "jsonwebtoken";
import fs from "fs";
import { env } from "~/env";
import { authOptions } from "~/server/auth";

// --- Configuration ---
const CLASS_SUFFIX = "HackWesternUserPass";

interface ApiResponse {
  saveToWalletUrl?: string;
  message?: string;
  error?: string;
}

// --- Environment Variable Values ---
// These are fetched once from `env` or `process.env`
const GOOGLE_WALLET_ISSUER_ID = env.GOOGLE_WALLET_ISSUER_ID;
const GOOGLE_APPLICATION_CREDENTIALS_PATH = env.GOOGLE_APPLICATION_CREDENTIALS;
const WALLET_SERVICE_ACCOUNT_EMAIL = env.WALLET_SERVICE_ACCOUNT_EMAIL;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL; // Used for JWT 'origins'

let serviceAccountCreds: any = null;
// Attempt to load credentials only if the path is set

if (GOOGLE_APPLICATION_CREDENTIALS_PATH) {
  try {
    const keyFileContent = fs.readFileSync(
      GOOGLE_APPLICATION_CREDENTIALS_PATH,
      "utf-8",
    );
    serviceAccountCreds = JSON.parse(keyFileContent);
  } catch (err) {
    console.error("Error reading or parsing service account key file:", err);
    // serviceAccountCreds remains null
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>,
) {
  // --- Strict Environment Variable Checks ---
  if (!GOOGLE_WALLET_ISSUER_ID) {
    console.error(
      "FATAL: GOOGLE_WALLET_ISSUER_ID environment variable is not set.",
    );
    return res
      .status(500)
      .json({ error: "Server configuration error: Missing Wallet Issuer ID." });
  }
  if (!GOOGLE_APPLICATION_CREDENTIALS_PATH) {
    console.error(
      "FATAL: GOOGLE_APPLICATION_CREDENTIALS environment variable (path to key file) is not set.",
    );
    return res
      .status(500)
      .json({ error: "Server configuration error: Missing credentials path." });
  }
  if (!WALLET_SERVICE_ACCOUNT_EMAIL) {
    console.error(
      "FATAL: WALLET_SERVICE_ACCOUNT_EMAIL environment variable is not set.",
    );
    return res
      .status(500)
      .json({
        error: "Server configuration error: Missing service account email.",
      });
  }
  if (!NEXT_PUBLIC_APP_URL) {
    console.error(
      "FATAL: NEXT_PUBLIC_APP_URL environment variable is not set (needed for JWT origins).",
    );
    return res
      .status(500)
      .json({ error: "Server configuration error: Missing public app URL." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!serviceAccountCreds) {
    // This check is after the path check, so it specifically means loading/parsing failed.
    console.error(
      "FATAL: Service account credentials could not be loaded or parsed.",
    );
    return res
      .status(500)
      .json({ error: "Service account credentials not loaded." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User not logged in or email missing." });
  }
  const userId = session.user.id;
  const userName = session.user.name ?? "HackWestern Attendee";
  const userEmail = session.user.email;

  // Log the GOOGLE_WALLET_ISSUER_ID to ensure it's loaded correctly
  console.log("Using GOOGLE_WALLET_ISSUER_ID:", GOOGLE_WALLET_ISSUER_ID);

  try {
    const authClient = new GoogleAuthJWT({
      email: serviceAccountCreds.client_email,
      key: serviceAccountCreds.private_key,

      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    const walletClient = google.walletobjects({
      version: "v1",
      auth: authClient,
    });

    const classId = `${GOOGLE_WALLET_ISSUER_ID}.${CLASS_SUFFIX}`;
    console.log("Constructed classId:", classId); // Log classId

    const sanitizedEmail = String(userEmail)
      .toLowerCase()
      .replace(/@/g, "_at_")
      .replace(/\./g, "_dot_")
      .replace(/[^a-z0-9_-]/g, "")
      .substring(0, 60);

    const baseIdentifier = sanitizedEmail || "user";
    const objectIdentifier = `${baseIdentifier}-${Date.now()}`;
    console.log("Generated objectIdentifier:", objectIdentifier);

    const objectId = `${GOOGLE_WALLET_ISSUER_ID}.${objectIdentifier}`;
    console.log("Constructed objectId (resourceId):", objectId);

    // 1. Class Management
    console.log("Attempting to get or create class...");
    let passClass;
    try {
      console.log(
        `Attempting to get class with classId (which is the resourceId): ${classId}`,
      );
      // VVVVV CHANGE THIS LINE VVVVV
      const getClassResponse = await walletClient.genericclass.get({
        resourceId: classId,
      });
      // ^^^^^ CHANGE THIS LINE ^^^^^
      passClass = getClassResponse;
      console.log("Successfully fetched class:", passClass.data.id);
    } catch (err: any) {
      if (err.code === 404) {
        console.log(
          `Class ${classId} not found, attempting to create new class.`,
        );
        // Inside newClassPayload
        const newClassPayload: google.walletobjects_v1.Schema$GenericClass = {
          id: classId,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [
                {
                  twoItems: {
                    startItem: {
                      firstValue: {
                        defaultValue: {
                          language: "en",
                          value: "Attendee Name",
                        },
                      },
                    },
                    endItem: {
                      firstValue: {
                        defaultValue: { language: "en", value: "Event Pass" },
                      },
                    },
                  },
                },
              ],
            },
          },
          logo: {
            sourceUri: { uri: "https://picsum.photos/200" }, // Generic PNG/JPG
            contentDescription: {
              defaultValue: { language: "en", value: "HackWestern Class Logo" },
            },
          },
          hexBackgroundColor: "#4285f4",
        };
        console.log(
          "New class payload:",
          JSON.stringify(newClassPayload, null, 2),
        );
        try {
          const classResponse = await walletClient.genericclass.insert({
            requestBody: newClassPayload,
          });
          passClass = classResponse;
          console.log("Class created successfully:", passClass.data.id);
        } catch (insertErr: any) {
          console.error("Error inserting new class:", insertErr.message);
          if (insertErr.response?.data?.error) {
            console.error(
              "Detailed error inserting new class:",
              JSON.stringify(insertErr.response.data.error, null, 2),
            );
          }
          throw insertErr;
        }
      } else {
        console.error("Error fetching class (not 404):", err.message);
        if (err.response?.data?.error) {
          console.error(
            "Detailed error fetching class:",
            JSON.stringify(err.response.data.error, null, 2),
          );
        }
        throw err;
      }
    }

    if (!passClass?.data) {
      // Check if passClass or passClass.data is still undefined/null
      console.error("FATAL: Class data is missing after get/create attempt.");
      return res
        .status(500)
        .json({ error: "Server error: Failed to obtain class definition." });
    }
    console.log("Class management complete. Class ID:", passClass.data.id);

    // 2. Create the Generic Object
    console.log("Defining newObject payload..."); // Log before defining newObject
    const newObject: google.walletobjects_v1.Schema$GenericObject = {
      id: objectId,
      classId: passClass.data.id,
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      hexBackgroundColor: "#4285f4",
      logo: {
        sourceUri: { uri: "https://picsum.photos/200" }, // Generic PNG/JPG
        contentDescription: {
          defaultValue: { language: "en", value: "HackWestern Object Logo" },
        },
      },
      cardTitle: {
        defaultValue: { language: "en", value: "HackWestern 11 Pass" },
      },
      header: {
        defaultValue: { language: "en", value: userName },
      },
      subheader: {
        defaultValue: { language: "en", value: "Event Ticket" },
      },
      heroImage: {
        sourceUri: { uri: "https://picsum.photos/600/200" }, // Generic PNG/JPG for hero
        contentDescription: {
          defaultValue: { language: "en", value: "HackWestern Event Banner" },
        },
      },
      textModulesData: [
        {
          header: "EVENT DETAILS",
          body: "HackWestern 11 - November 2024",
          id: "event_details",
        },
        {
          header: "ATTENDEE",
          body: `Name: ${userName}\nEmail: ${userEmail}`,
          id: "attendee_info",
        },
      ],
      linksModuleData: {
        uris: [
          {
            uri: NEXT_PUBLIC_APP_URL!, // Added non-null assertion, ensure it's checked above
            description: "Visit HackWestern Site",
            id: "website_link",
          },
        ],
      },
      barcode: {
        type: "QR_CODE",
        value: `HW11-${userId}`,
        alternateText: `HW11-${userId}`,
      },
    };
    console.log("newObject payload defined."); // Log after defining newObject

    // This is the line you said it wasn't reaching
    console.log(
      "Attempting to insert object with payload:",
      JSON.stringify(newObject, null, 2),
    );

    const objectResponse = await walletClient.genericobject.insert({
      requestBody: newObject,
    });
    console.log("Object inserted successfully:", objectResponse.data.id);

    // 3. Create JWT (existing logic seems fine)

    const claims = {
      iss: WALLET_SERVICE_ACCOUNT_EMAIL,
      aud: "google",
      typ: "savetowallet",
      origins: [NEXT_PUBLIC_APP_URL!],
      payload: {
        genericObjects: [
          newObject, // Send the full object definition
        ],
      },
    };

    const token = jwt.sign(claims, serviceAccountCreds.private_key, {
      algorithm: "RS256",
    });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return res.status(200).json({ saveToWalletUrl: saveUrl });
  } catch (error: any) {
    // Outer catch block
    console.error("Google Wallet API error (outer catch):", error.message);
    if (error.response?.data?.error) {
      console.error(
        "Detailed Google Wallet API error (outer catch):",
        JSON.stringify(error.response.data.error, null, 2),
      );
      return res
        .status(500)
        .json({
          error: `Google Wallet API Error: ${error.response.data.error.message}`,
        });
    } else if (error.isAxiosError && error.response) {
      console.error(
        "Axios error response data (outer catch):",
        JSON.stringify(error.response.data, null, 2),
      );
    }
    return res
      .status(500)
      .json({
        error: "Failed to create wallet pass.",
        message: String(error.message),
      });
  }
}
