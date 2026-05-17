import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnedProduct } from "@/lib/auth-server";

// GET /api/email-config?product_id=xxx  → fetch email config for a product
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product_id = searchParams.get("product_id");

  if (!product_id) {
    return NextResponse.json({ error: "product_id is required." }, { status: 400 });
  }

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  const { data, error } = await supabaseAdmin
    .from("email_config")
    .select("*")
    .eq("product_id", product_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email_config: data ?? null });
}

// POST /api/email-config  → create email config for a product
export async function POST(request: Request) {
  const body = await request.json();
  const { product_id, host, port, username, password, email_from } = body as {
    product_id: string;
    host: string;
    port: number;
    username: string;
    password: string;
    email_from: string;
  };

  if (!product_id || !host || !username || !password || !email_from) {
    return NextResponse.json(
      { error: "product_id, host, username, password and email_from are required." },
      { status: 400 }
    );
  }

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  const { data, error } = await supabaseAdmin
    .from("email_config")
    .insert({ product_id, host, port: port || 587, username, password, email_from })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email_config: data }, { status: 201 });
}
