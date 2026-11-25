import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

/**
 * Racine Turbopack : ancêtre commun du projet et du dossier node_modules réel.
 * En local, node_modules peut être un lien vers un dossier hors iCloud
 * (voir README) ; sur une installation classique, c'est le dossier du projet.
 */
function racine(): string {
  const projet = process.cwd();
  let modules: string;
  try {
    modules = path.dirname(fs.realpathSync(path.join(projet, "node_modules")));
  } catch {
    return projet;
  }
  const a = projet.split(path.sep);
  const b = modules.split(path.sep);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i).join(path.sep) || path.sep;
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    root: racine(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
