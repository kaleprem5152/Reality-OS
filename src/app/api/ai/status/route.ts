import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Reports AI integration status honestly — no fake "connected" state. */
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  const configured = typeof key === "string" && key.trim().length > 0;
  return NextResponse.json({
    configured,
    provider: configured ? "gemini" : null,
  });
}
