/**
 * Generates `src/generated/app.json`: a map of every page, REST route and
 * tRPC procedure, with auth level, input schema, output schema and errors.
 *
 *   npm run map:generate            # write the file
 *   npm run map:generate -- --check # exit 1 if the committed file is stale
 *
 * Sources of truth:
 *  - tRPC paths / types / zod inputs: the live `appRouter` (runtime)
 *  - tRPC auth level / errors / output types: the TypeScript source (ts-morph)
 *  - pages + REST routes: static scan of `src/pages`
 *
 * The output is deterministic (no timestamps, sorted keys) so CI only commits
 * when the API surface actually changes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Node, Project, type Type } from "ts-morph";
import { zodToJsonSchema } from "zod-to-json-schema";

// Importing the router pulls in env + db modules. Neither connects at import
// time, so dummy values are enough.
process.env.SKIP_ENV_VALIDATION ??= "1";
process.env.DATABASE_URL ??= "postgres://map:map@localhost:5432/map";
process.env.NEXTAUTH_SECRET ??= "app-map";
// Some modules read these at import time (e.g. the R2 client). Dummies only.
for (const [k, v] of Object.entries({
  NEXTAUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "x",
  GITHUB_CLIENT_SECRET: "x",
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_CLIENT_SECRET: "x",
  DISCORD_CLIENT_ID: "x",
  DISCORD_CLIENT_SECRET: "x",
  MAILJET_API_KEY: "x",
  MAILJET_SECRET_KEY: "x",
  MAILJET_WEBHOOK_USER: "x",
  MAILJET_WEBHOOK_PASSWORD: "x",
  APPLE_WWDR_CERT: "x",
  APPLE_SIGNER_CERT: "x",
  APPLE_SIGNER_KEY: "x",
  GOOGLE_WALLET_CLIENT_EMAIL: "x",
  GOOGLE_WALLET_PRIVATE_KEY: "x",
  GOOGLE_WALLET_ISSUER_ID: "x",
  R2_ACCESS_KEY_ID: "x",
  R2_SECRET_ACCESS_KEY: "x",
  R2_ENDPOINT: "http://localhost:9000",
  R2_BUCKET_NAME: "x",
  R2_PUBLIC_BASE_URL: "http://localhost:9000",
})) {
  process.env[k] ??= v;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "src/generated/app.json");
const OVERRIDES_PATH = path.join(ROOT, "scripts/app-map.overrides.json");
const PAGES_DIR = path.join(ROOT, "src/pages");

type Json = Record<string, unknown>;
const warnings: string[] = [];
const warn = (msg: string) => warnings.push(msg);

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

const TRPC_HTTP: Record<string, number> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

type AuthLevel = "public" | "protected" | "organizer" | "judge" | "unknown";

/** Root procedure builder (exported from trpc.ts) -> auth level. */
const AUTH_BY_BUILDER: Record<string, AuthLevel> = {
  publicProcedure: "public",
  protectedProcedure: "protected",
  protectedOrganizerProcedure: "organizer",
  protectedJudgeProcedure: "judge",
};

function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Json)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    ) as T;
  }
  return value;
}

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(full) : [full];
  });
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");

/* -------------------------------------------------------------------------- */
/* TypeScript type -> JSON-Schema-ish                                         */
/* -------------------------------------------------------------------------- */

const MAX_DEPTH = 7;

function typeToSchema(
  type: Type,
  at: Node,
  depth = 0,
  seen: Type[] = [],
): Json {
  if (depth > MAX_DEPTH) return { description: "max depth reached" };
  if (type.isAny() || type.isUnknown()) return {};
  if (type.isNull()) return { type: "null" };
  if (type.isUndefined() || type.getText() === "void")
    return { type: "undefined" };
  if (type.isBoolean()) return { type: "boolean" };
  if (type.isBooleanLiteral()) return { const: type.getText() === "true" };
  if (type.isStringLiteral()) return { const: type.getLiteralValue() };
  if (type.isNumberLiteral()) return { const: type.getLiteralValue() };
  if (type.isString()) return { type: "string" };
  if (type.isNumber()) return { type: "number" };
  if (type.getText() === "bigint")
    return { type: "string", "x-superjson": "bigint" };

  if (type.isUnion()) {
    const members = type.getUnionTypes();
    const parts = members.map((m) => typeToSchema(m, at, depth + 1, seen));
    const consts = parts.filter(
      (p) => "const" in p && Object.keys(p).length === 1,
    );
    if (consts.length === parts.length) {
      return { enum: parts.map((p) => p.const) };
    }
    // dedupe identical members (e.g. true | false already handled above)
    const uniq = [
      ...new Map(parts.map((p) => [JSON.stringify(p), p])).values(),
    ];
    return uniq.length === 1 ? uniq[0]! : { anyOf: uniq };
  }

  if (type.isIntersection()) {
    return {
      allOf: type
        .getIntersectionTypes()
        .map((m) => typeToSchema(m, at, depth + 1, seen)),
    };
  }

  const symbolName =
    type.getSymbol()?.getName() ?? type.getAliasSymbol()?.getName();
  if (symbolName === "Date") {
    return { type: "string", format: "date-time", "x-superjson": "Date" };
  }
  if (symbolName === "Map" || symbolName === "Set") {
    return { type: "array", "x-superjson": symbolName };
  }
  if (symbolName === "Buffer" || symbolName === "Uint8Array") {
    return { type: "string", "x-superjson": symbolName };
  }

  if (type.isArray()) {
    const el = type.getArrayElementType();
    return {
      type: "array",
      items: el ? typeToSchema(el, at, depth + 1, seen) : {},
    };
  }
  if (type.isTuple()) {
    return {
      type: "array",
      prefixItems: type
        .getTupleElements()
        .map((t) => typeToSchema(t, at, depth + 1, seen)),
    };
  }

  if (type.isObject()) {
    if (type.getCallSignatures().length > 0) return { description: "function" };
    if (seen.some((s) => s.compilerType === type.compilerType)) {
      return { description: "circular reference" };
    }
    const nextSeen = [...seen, type];
    const properties: Json = {};
    const required: string[] = [];
    for (const prop of type.getProperties()) {
      const name = prop.getName();
      const propType = prop.getTypeAtLocation(at);
      properties[name] = typeToSchema(propType, at, depth + 1, nextSeen);
      const optional =
        prop.isOptional?.() ??
        propType.getUnionTypes().some((t) => t.isUndefined());
      if (!optional) required.push(name);
    }
    const schema: Json = { type: "object", properties };
    if (required.length) schema.required = required;
    const indexType = type.getStringIndexType();
    if (indexType) {
      schema.additionalProperties = typeToSchema(
        indexType,
        at,
        depth + 1,
        nextSeen,
      );
    }
    return schema;
  }

  return { description: type.getText(at).slice(0, 80) };
}

/* -------------------------------------------------------------------------- */
/* tRPC: static walk of the router source                                     */
/* -------------------------------------------------------------------------- */

interface StaticProc {
  auth: AuthLevel;
  errors: { code: string; message?: string }[];
  output: Json | null;
  file: string;
}

interface ChainInfo {
  root: string | null;
  calls: { name: string; node: Node }[];
}

function parseChain(expr: Node): ChainInfo {
  const calls: ChainInfo["calls"] = [];
  let cur: Node = expr;
  for (let i = 0; i < 50; i++) {
    if (Node.isCallExpression(cur)) {
      const callee = cur.getExpression();
      if (Node.isPropertyAccessExpression(callee)) {
        calls.unshift({ name: callee.getName(), node: cur });
        cur = callee.getExpression();
        continue;
      }
      return { root: callee.getText(), calls };
    }
    if (Node.isPropertyAccessExpression(cur)) {
      // e.g. `t.procedure` with no further calls
      return { root: cur.getText(), calls };
    }
    if (Node.isIdentifier(cur)) return { root: cur.getText(), calls };
    return { root: null, calls };
  }
  return { root: null, calls };
}

function definitionInitializer(id: Node): Node | undefined {
  if (!Node.isIdentifier(id)) return undefined;
  for (const def of id.getDefinitionNodes()) {
    if (Node.isVariableDeclaration(def)) return def.getInitializer();
  }
  return undefined;
}

/** Follow local aliases like `const orgProc = protectedOrganizerProcedure.use(...)`. */
function resolveAuth(root: string | null, at: Node, depth = 0): AuthLevel {
  if (!root) return "unknown";
  if (root in AUTH_BY_BUILDER) return AUTH_BY_BUILDER[root]!;
  if (depth > 5) return "unknown";
  const id = at
    .getSourceFile()
    .getDescendants()
    .find((n) => Node.isIdentifier(n) && n.getText() === root);
  const init = id ? definitionInitializer(id) : undefined;
  if (!init) return "unknown";
  return resolveAuth(parseChain(init).root, init, depth + 1);
}

function collectTrpcErrors(handler: Node | undefined): StaticProc["errors"] {
  if (!handler) return [];
  const out = new Map<string, { code: string; message?: string }>();
  handler.forEachDescendant((n) => {
    if (!Node.isNewExpression(n) || n.getExpression().getText() !== "TRPCError")
      return;
    const arg = n.getArguments()[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) return;
    const code = arg.getProperty("code");
    const message = arg.getProperty("message");
    const codeText =
      code && Node.isPropertyAssignment(code)
        ? code.getInitializer()?.getText().replace(/["'`]/g, "")
        : undefined;
    if (!codeText) return;
    const msgInit =
      message && Node.isPropertyAssignment(message)
        ? message.getInitializer()
        : undefined;
    const msg =
      msgInit &&
      (Node.isStringLiteral(msgInit) ||
        Node.isNoSubstitutionTemplateLiteral(msgInit))
        ? msgInit.getLiteralText()
        : undefined;
    out.set(`${codeText}|${msg ?? ""}`, {
      code: codeText,
      ...(msg ? { message: msg } : {}),
    });
  });
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function outputSchemaOf(procNode: Node): Json | null {
  try {
    const def = procNode
      .getType()
      .getProperty("_def")
      ?.getTypeAtLocation(procNode);
    const types = def?.getProperty("$types")?.getTypeAtLocation(procNode);
    const out = types?.getProperty("output")?.getTypeAtLocation(procNode);
    return out ? typeToSchema(out, procNode) : null;
  } catch {
    return null;
  }
}

function walkRouterNode(
  node: Node,
  prefix: string[],
  sink: Map<string, StaticProc>,
  depth = 0,
): void {
  if (depth > 10) return;
  let expr: Node | undefined = node;

  // identifier -> its declaration initializer
  if (Node.isIdentifier(expr)) expr = definitionInitializer(expr) ?? expr;

  // createTRPCRouter({ ... })
  if (
    Node.isCallExpression(expr) &&
    /(^|\.)(createTRPCRouter|router)$/.test(expr.getExpression().getText())
  ) {
    const arg = expr.getArguments()[0];
    if (arg && Node.isObjectLiteralExpression(arg)) {
      walkRouterNode(arg, prefix, sink, depth + 1);
    }
    return;
  }

  if (!Node.isObjectLiteralExpression(expr)) return;

  for (const prop of expr.getProperties()) {
    if (Node.isSpreadAssignment(prop)) {
      warn(
        `router ${prefix.join(".") || "(root)"}: spread in router literal not followed (${rel(prop.getSourceFile().getFilePath())})`,
      );
      continue;
    }
    let name: string;
    let value: Node | undefined;
    if (Node.isPropertyAssignment(prop)) {
      name = prop.getName().replace(/["'`]/g, "");
      value = prop.getInitializer();
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      name = prop.getName();
      value = prop.getNameNode();
    } else if (Node.isMethodDeclaration(prop)) {
      continue;
    } else {
      continue;
    }
    if (!value) continue;
    const here = [...prefix, name];

    // Is the value a procedure (chain ending in query/mutation/subscription)?
    let valueExpr: Node = value;
    if (Node.isIdentifier(valueExpr))
      valueExpr = definitionInitializer(valueExpr) ?? valueExpr;
    const chain = parseChain(valueExpr);
    const terminal = chain.calls.at(-1);
    if (
      terminal &&
      ["query", "mutation", "subscription"].includes(terminal.name)
    ) {
      const handler = (
        terminal.node as import("ts-morph").CallExpression
      ).getArguments()[0];
      sink.set(here.join("."), {
        auth: resolveAuth(chain.root, valueExpr),
        errors: collectTrpcErrors(handler),
        output: outputSchemaOf(valueExpr),
        file: rel(valueExpr.getSourceFile().getFilePath()),
      });
    } else {
      walkRouterNode(value, here, sink, depth + 1);
    }
  }
}

function buildStaticTrpc(project: Project): Map<string, StaticProc> {
  const sink = new Map<string, StaticProc>();
  const root = project.getSourceFileOrThrow(
    path.join(ROOT, "src/server/api/root.ts"),
  );
  const decl = root.getVariableDeclarationOrThrow("appRouter");
  const init = decl.getInitializerOrThrow();
  walkRouterNode(init, [], sink);
  return sink;
}

/* -------------------------------------------------------------------------- */
/* tRPC: merge with the runtime router                                        */
/* -------------------------------------------------------------------------- */

async function buildTrpc(project: Project) {
  const staticProcs = buildStaticTrpc(project);
  const { appRouter } = (await import("../src/server/api/root")) as {
    appRouter: { _def: { procedures: Record<string, any> } };
  };
  const procedures = appRouter._def.procedures;

  const out: Json[] = [];
  for (const key of Object.keys(procedures).sort()) {
    const proc = procedures[key];
    const def = proc._def ?? {};
    const type: string =
      def.type ?? (def.query ? "query" : def.mutation ? "mutation" : "unknown");
    const st = staticProcs.get(key);
    if (!st)
      warn(
        `trpc ${key}: not found in static source walk (auth/errors/output unknown)`,
      );

    // Input: zod -> JSON Schema
    const inputs: unknown[] = def.inputs ?? [];
    const inputSchemas = inputs.map((inp, i) => {
      if (
        inp &&
        typeof inp === "object" &&
        "_def" in (inp as Json) &&
        "safeParse" in (inp as Json)
      ) {
        const { $schema: _omit, ...schema } = zodToJsonSchema(inp as never, {
          target: "jsonSchema7",
          $refStrategy: "none",
        }) as Json;
        return schema;
      }
      warn(`trpc ${key}: input #${i} is not a zod schema`);
      return {};
    });
    const input =
      inputSchemas.length === 0
        ? null
        : inputSchemas.length === 1
          ? inputSchemas[0]!
          : { allOf: inputSchemas };

    const auth = st?.auth ?? "unknown";
    const errors: {
      code: string;
      httpStatus: number;
      message?: string;
      source: string;
    }[] = [];
    const add = (code: string, source: string, message?: string) =>
      errors.push({
        code,
        httpStatus: TRPC_HTTP[code] ?? 500,
        source,
        ...(message ? { message } : {}),
      });

    if (auth !== "public" && auth !== "unknown")
      add("UNAUTHORIZED", "auth middleware");
    if (auth === "organizer")
      add("FORBIDDEN", "auth middleware", "User is not an organizer");
    if (auth === "judge")
      add("FORBIDDEN", "auth middleware", "User is not registered as a judge");
    if (input) add("BAD_REQUEST", "input validation (data.zodError populated)");
    for (const e of st?.errors ?? []) add(e.code, "handler", e.message);
    add("INTERNAL_SERVER_ERROR", "unhandled");

    out.push({
      path: key,
      type,
      http:
        type === "query"
          ? "GET /api/trpc/" + key + "?input=<superjson>"
          : "POST /api/trpc/" + key,
      auth,
      input,
      output: st?.output ?? null,
      errors,
      source: st?.file ?? null,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                      */
/* -------------------------------------------------------------------------- */

function buildPages() {
  const redirectSrc = fs.readFileSync(
    path.join(ROOT, "src/utils/redirect.ts"),
    "utf8",
  );
  const guards = [
    ...redirectSrc.matchAll(/export (?:async )?(?:function|const) (\w+)/g),
  ].map((m) => m[1]!);

  return walkFiles(PAGES_DIR)
    .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f))
    .map((f) => path.relative(PAGES_DIR, f).split(path.sep).join("/"))
    .filter((f) => !f.startsWith("api/") && !/^_(app|document)\./.test(f))
    .sort()
    .map((file) => {
      const src = fs.readFileSync(path.join(PAGES_DIR, file), "utf8");
      const route =
        "/" +
        file
          .replace(/\.(tsx|ts|jsx|js)$/, "")
          .replace(/(^|\/)index$/, "")
          .replace(/\/$/, "");
      const usedGuards = guards.filter((g) =>
        new RegExp(`\\b${g}\\b`).test(src),
      );
      let auth = "none-detected";
      if (usedGuards.some((g) => /Organizer/i.test(g))) auth = "organizer";
      else if (usedGuards.length) auth = "session";
      else if (/\buseSession\b/.test(src)) auth = "client-side-session";
      return {
        route: route === "/" || route === "" ? "/" : route.replace(/\/$/, ""),
        file: `src/pages/${file}`,
        dynamic: /\[.+\]/.test(file),
        auth,
        serverGuards: usedGuards,
        hasGetServerSideProps: /getServerSideProps/.test(src),
      };
    });
}

/* -------------------------------------------------------------------------- */
/* REST routes                                                                */
/* -------------------------------------------------------------------------- */

function buildRest(overrides: Record<string, Json>) {
  const apiDir = path.join(PAGES_DIR, "api");
  return walkFiles(apiDir)
    .filter((f) => /\.(ts|tsx|js)$/.test(f))
    .map((f) => path.relative(apiDir, f).split(path.sep).join("/"))
    .filter((f) => !f.startsWith("trpc/"))
    .sort()
    .map((file) => {
      const src = fs.readFileSync(path.join(apiDir, file), "utf8");
      const route =
        "/api/" + file.replace(/\.(ts|tsx|js)$/, "").replace(/\/index$/, "");

      const methods = new Set<string>();
      for (const m of src.matchAll(/req\.method\s*[!=]==?\s*["'](\w+)["']/g))
        methods.add(m[1]!.toUpperCase());
      for (const m of src.matchAll(
        /case\s+["'](GET|POST|PUT|PATCH|DELETE)["']/g,
      ))
        methods.add(m[1]!);

      const statuses = [
        ...new Set(
          [...src.matchAll(/\.status\(\s*(\d{3})\s*\)/g)].map((m) =>
            Number(m[1]),
          ),
        ),
      ].sort();
      const messageKeys = [
        ...new Set(
          [...src.matchAll(/\.json\(\s*\{\s*(message|error)\b/g)].map(
            (m) => m[1]!,
          ),
        ),
      ];

      const auth: string[] = [];
      if (/getServerAuthSession|getServerSession/.test(src))
        auth.push("session");
      if (/["']organizer["']/.test(src)) auth.push("organizer");
      const bearer =
        src.match(/Bearer[^\n]*?(?:env\.|process\.env\.)(\w+)/) ??
        src.match(/(?:env\.|process\.env\.)(\w+)[^\n]*?Bearer/);
      if (bearer) auth.push(`bearer:${bearer[1]}`);
      else if (/Bearer/.test(src)) auth.push("bearer");
      if (/Basic /.test(src)) auth.push("basic");
      if (file.startsWith("auth/[...nextauth]")) auth.push("next-auth handler");

      const entry: Json = {
        route,
        file: `src/pages/api/${file}`,
        methods: methods.size ? [...methods].sort() : ["unknown"],
        auth: auth.length ? auth : ["none-detected"],
        errorStatuses: statuses.filter((s) => s >= 400),
        successStatuses: statuses.filter((s) => s < 400),
        errorBodyKeys: messageKeys,
        input: null,
        output: null,
      };
      return { ...entry, ...(overrides[route] ?? {}) };
    });
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const check = process.argv.includes("--check");
  const overrides: Record<string, Json> = fs.existsSync(OVERRIDES_PATH)
    ? (JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8")) as Record<
        string,
        Json
      >)
    : {};

  const project = new Project({
    tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths([
    path.join(ROOT, "src/server/**/*.ts"),
    path.join(ROOT, "src/schemas/**/*.ts"),
    path.join(ROOT, "src/utils/**/*.ts"),
    path.join(ROOT, "src/env.js"),
  ]);

  const trpc = await buildTrpc(project);
  const rest = buildRest(overrides);
  const pages = buildPages();

  const doc = sortKeys({
    version: 1,
    note: "Generated by scripts/generate-app-map.ts. Do not edit; use scripts/app-map.overrides.json.",
    trpc,
    rest,
    pages,
    warnings: [...new Set(warnings)].sort(),
  });
  const json = JSON.stringify(doc, null, 2) + "\n";

  if (check) {
    const current = fs.existsSync(OUT_PATH)
      ? fs.readFileSync(OUT_PATH, "utf8")
      : "";
    if (current !== json) {
      console.error("app.json is out of date. Run: npm run map:generate");
      process.exit(1);
    }
    console.log("app.json is up to date.");
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, json);
  console.log(
    `Wrote ${rel(OUT_PATH)}: ${trpc.length} tRPC procedures, ${rest.length} REST routes, ${pages.length} pages, ${warnings.length} warnings.`,
  );
  // The imported router may keep a postgres client handle; exit explicitly.
  process.exit(0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
