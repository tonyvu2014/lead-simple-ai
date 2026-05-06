import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("user_id", user_id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { user_id, name, description, url, daily_schedule_enabled } = body;

  if (!user_id || !name) {
    return NextResponse.json(
      { error: "user_id and name are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      user_id,
      name,
      description: description || null,
      url: url || null,
      daily_schedule_enabled: Boolean(daily_schedule_enabled),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data }, { status: 201 });
}
