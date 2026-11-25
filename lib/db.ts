import { PrismaClient } from "@prisma/client";

const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalPourPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = prisma;

/** Client transactionnel Prisma. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Erreur Prisma de contrainte d'unicité. */
export function estDoublon(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
