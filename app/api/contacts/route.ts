import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product_id = searchParams.get("product_id");

  if (!product_id) {
    return NextResponse.json(
      { error: "product_id is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .eq("product_id", product_id)
    .order("type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { product_id, type, subject, content } = body;

  if (!product_id || !type || !subject || !content) {
    return NextResponse.json(
      { error: "product_id, type, subject, and content are required." },
      { status: 400 }
    );
  }

  // Check for an existing contact of the same type for this product
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("product_id", product_id)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    // Replace: update the existing row
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update({ subject, content })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data });
  }

  // Insert new
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({ product_id, type, subject, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}
