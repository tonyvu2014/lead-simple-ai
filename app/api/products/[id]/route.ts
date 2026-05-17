import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnedProduct } from "@/lib/auth-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownership = await requireOwnedProduct(request, id);
  if ("response" in ownership) return ownership.response;

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ product: data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownership = await requireOwnedProduct(request, id);
  if ("response" in ownership) return ownership.response;

  const body = await request.json();
  const { name, description, url, daily_schedule_enabled } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({
      name,
      description: description || null,
      url: url || null,
      daily_schedule_enabled: Boolean(daily_schedule_enabled),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownership = await requireOwnedProduct(request, id);
  if ("response" in ownership) return ownership.response;

  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
