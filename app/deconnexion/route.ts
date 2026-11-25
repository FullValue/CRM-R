import { NextResponse, type NextRequest } from "next/server";
import { fermerSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  await fermerSession();
  return NextResponse.redirect(new URL("/connexion", req.url), { status: 303 });
}
