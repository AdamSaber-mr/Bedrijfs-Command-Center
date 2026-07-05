import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { findById, publicUser } from "@/lib/users";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });
  const user = await findById(userId);
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
