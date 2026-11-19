// Badge QR (a seeded hacker id) as a PNG, then a y4m for Chromium's fake camera.
import QRCode from "qrcode";
import { execFileSync } from "node:child_process";
const id = process.argv[2] ?? "seed-hacker-alex";
const out = process.argv[3] ?? "mocks/sponsor-scan-v2/badge-qr";
await QRCode.toFile(`${out}.png`, id, { width: 360, margin: 4, errorCorrectionLevel: "H" });
execFileSync("ffmpeg", ["-y", "-loop", "1", "-i", `${out}.png`, "-vf", "pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p", "-t", "2", "-r", "10", `${out}.y4m`], { stdio: "inherit" });
console.log("wrote", `${out}.png`, `${out}.y4m`);
