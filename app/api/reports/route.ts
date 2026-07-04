import { NextResponse } from "next/server";
import { listReports } from "@/lib/reportStore";

export async function GET() {
  return NextResponse.json({ reports: await listReports() });
}
