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
const production = postgresql && (process.env.VERCEL_ENV === "production" || process.env.CRM_MIGRER_AU_BUILD === "1");
if (production) {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { stdio: "inherit" });
}

// Jeu de démonstration installé une seule fois sur une production vide
// (voir prisma/remplir-prod.ts). CRM_DEMO_PROD=0 le désactive. Un échec
// n'empêche pas le déploiement.
if (production && process.env.CRM_DEMO_PROD !== "0") {
  try {
    execFileSync(process.execPath, [require.resolve("tsx/cli"), "prisma/remplir-prod.ts"], { stdio: "inherit" });
  } catch {
    console.warn("Démonstration non installée (voir l'erreur ci-dessus) : le déploiement continue.");
  }
}
