import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Recrée la base de recette (prisma/recette.db) à partir du schéma. */
export default function preparation() {
  const racine = path.resolve(import.meta.dirname, "../..");
  const base = path.join(racine, "prisma", "recette.db");
  for (const f of [base, `${base}-journal`, `${base}-wal`, `${base}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
  // Un fichier vide suffit à SQLite et évite le chemin de création de la CLI.
  fs.writeFileSync(base, "", { flag: "wx" });
  execFileSync(process.execPath, [path.join(racine, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], {
    cwd: racine,
    env: { ...process.env, DATABASE_URL: "file:./recette.db" },
    stdio: "pipe",
  });
}
