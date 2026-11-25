import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests d'intégration des services sur une base SQLite dédiée
 * (prisma/recette.db), recréée à chaque lancement : la base de développement
 * n'est jamais touchée.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/preparation.ts"],
    env: { DATABASE_URL: "file:./recette.db" },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
