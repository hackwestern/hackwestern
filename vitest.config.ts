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
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
