import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnedProduct } from "@/lib/auth-server";

// PUT /api/email-config/[product_id]  → update email config
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ product_id: string }> }
) {
  const { product_id } = await params;

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  const body = await request.json();
  const { host, port, username, password, email_from } = body as {
    host: string;
    port: number;
    username: string;
    password: string;
    email_from: string;
  };

  if (!host || !username || !password || !email_from) {
    return NextResponse.json(
      { error: "host, username, password and email_from are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("email_config")
    .update({ host, port: port || 587, username, password, email_from })
    .eq("product_id", product_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email_config: data });
}

// DELETE /api/email-config/[product_id]  → delete email config
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ product_id: string }> }
) {
  const { product_id } = await params;

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  const { error } = await supabaseAdmin
    .from("email_config")
    .delete()
    .eq("product_id", product_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
