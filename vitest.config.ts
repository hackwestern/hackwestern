import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["dotenv/config", "./vitest.setup.ts"],
    reporters: "verbose",
    // Parked files (moved instead of deleted) are not part of the suite.
    exclude: [...configDefaults.exclude, "**/_to_delete/**"],
    // src/server/storage/r2.ts reads this at import, and the root router
    // imports it. A dummy keeps router tests loadable without a .env.
    env: {
      R2_PUBLIC_BASE_URL:
        process.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3000",
      // No test may reach Google Sheets or Slack with real credentials from
      // .env. Blank them for the whole suite; a test that needs one mocks
      // ~/env (and the network) itself. Mailjet already gets a dummy key
      // under NODE_ENV=test (src/env.js) and its sends are mocked.
      ...Object.fromEntries(
        [
          "RUN_OF_SHOW_SHEET",
          "RUN_OF_SHOW_SHEETS_CLIENT_EMAIL",
          "RUN_OF_SHOW_SHEETS_PRIVATE_KEY",
          "SPONSOR_SHEETS_CLIENT_EMAIL",
          "SPONSOR_SHEETS_PRIVATE_KEY",
          "SPONSOR_JUDGING_SHEET",
          "SPONSOR_MASTER_SHEET",
          "GOOGLE_SHEETS_API_KEY",
          "HACKER_INTEREST_FORM",
          "SLACK_BOT_TOKEN",
          "SPONSOR_HELP_SLACK_BOT_TOKEN",
        ].map((name) => [name, ""]),
      ),
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
