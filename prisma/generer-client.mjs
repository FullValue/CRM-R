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

execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), ...args], { stdio: "inherit" });
