import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureLegacyUserRow, requireAuthUser } from "@/lib/auth-server";

export async function GET(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  await ensureLegacyUserRow(auth.user);

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  const body = await request.json();
  const { name, description, url, daily_schedule_enabled } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  await ensureLegacyUserRow(auth.user);

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      user_id: auth.user.id,
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
