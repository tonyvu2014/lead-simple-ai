import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-server";
import { generateSubscriptionUrl } from "../helper";

export async function GET(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "email is a required query parameter." },
      { status: 400 }
    );
  }

  try {
    const subscriptionUrl = await generateSubscriptionUrl(email);
    return NextResponse.json({ subscriptionUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate subscription management URL." },
      { status: 500 }
    );
  }
}
