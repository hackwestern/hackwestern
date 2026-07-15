import { build } from "esbuild";

const base = "./src/utils/load_testing/";
await build({
  entryPoints: [base + "load_tester.ts"],
  outfile: base + "load-test-compiled.js",
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "browser",
  external: [
    "k6",
    "k6/http",
    "k6/data",
    "k6/metrics",
    "k6/crypto",
    "k6/x/*",
    // "k6-trpc",
    "/^(k6|https?\:\/\/)(\/.*)?/",
  ],
});
