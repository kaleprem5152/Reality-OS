import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbConnected = false;
  if (db) {
    try {
      await db.execute(sql`select 1`);
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  }

  return Response.json({
    status: "healthy",
    app: "RealityOS",
    version: "2.5.0",
    mode: dbConnected ? "database-backed" : "in-memory-demo",
    database: dbConnected ? "connected" : "fallback-store",
    timestamp: new Date().toISOString(),
  });
}
