import { mkdir, readFile, writeFile } from "node:fs/promises";

const dossier = new URL("./postgresql/", import.meta.url);
const schemaLocal = new URL("./schema.prisma", import.meta.url);
const schemaPostgresql = new URL("schema.prisma", dossier);
const NOM_VARIABLES = ["DATABASE_URL_POOLED", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL"];
const URL_POSTGRESQL = /^postgres(?:ql)?:\/\//i;

function variableConnexionPostgresql() {
  return NOM_VARIABLES.find((nom) => URL_POSTGRESQL.test(process.env[nom] ?? ""))
    ?? NOM_VARIABLES.find((nom) => /^prisma\+postgres:\/\//i.test(process.env[nom] ?? ""))
    ?? "DATABASE_URL";
}

const source = await readFile(schemaLocal, "utf8");
const providerLocal = 'provider = "sqlite"';
const urlLocale = 'env("DATABASE_URL")';
if (source.split(providerLocal).length !== 2 || source.split(urlLocale).length !== 2) {
  throw new Error("La source de données SQLite du schéma Prisma est introuvable ou ambiguë.");
}

const connexion = variableConnexionPostgresql();
const connexionDirecte = ["POSTGRES_URL", "DATABASE_URL", "PRISMA_DATABASE_URL"].find((nom) => {
  const valeur = process.env[nom] ?? "";
  if (!URL_POSTGRESQL.test(valeur)) return false;
  const url = new URL(valeur);
  return !/pooler|^pooled\./i.test(url.hostname) && url.searchParams.get("pgbouncer") !== "true";
});
const ligneDirecte = connexionDirecte && connexionDirecte !== connexion
  ? `\n  directUrl = env("${connexionDirecte}")`
  : "";

await mkdir(dossier, { recursive: true });
await writeFile(schemaPostgresql, source
  .replace(providerLocal, 'provider = "postgresql"')
  .replace(urlLocale, `env("${connexion}")${ligneDirecte}`));
