import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = ["generate"];
const postgresql = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)
  || /^(postgres(?:ql)?|prisma\+postgres):\/\//i.test(process.env.DATABASE_URL ?? "");
if (postgresql) {
  await import("./preparer-postgresql.mjs");
  args.push("--schema", "prisma/postgresql/schema.prisma");
}

const prismaCli = require.resolve("prisma/build/index.js");
execFileSync(process.execPath, [prismaCli, ...args], { stdio: "inherit" });

// En production, les migrations versionnées sont appliquées avant le build :
// le code déployé ne lit jamais une colonne que la base n'a pas encore.
// Idempotent (déjà appliquées = rien à faire). Les aperçus ne migrent pas.
if (postgresql && (process.env.VERCEL_ENV === "production" || process.env.CRM_MIGRER_AU_BUILD === "1")) {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { stdio: "inherit" });
}
