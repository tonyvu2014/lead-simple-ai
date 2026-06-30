import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-server";
import { getSubscription } from "../helper";

export async function GET(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "email is a required query parameter." },
      { status: 400 }
    );
  }

  try {
    const plan = await getSubscription(email);
    return NextResponse.json({ plan });
  } catch (error: unknown) {
    console.error("Error getting subscription:", error);
    const message = error instanceof Error ? error.message : "Failed to get subscription.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
