import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-server";
import { generateCheckoutUrl } from "../helper";

export async function GET(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim() ?? "";
  const plan = searchParams.get("plan")?.trim() ?? "";

  if (!email || !plan) {
    return NextResponse.json(
      { error: "email and plan are required query parameters." },
      { status: 400 }
    );
  }

  try {
    const checkoutUrl = await generateCheckoutUrl(email, plan);
    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    console.error("Error generating checkout URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate checkout URL." },
      { status: 500 }
    );
  }
}
