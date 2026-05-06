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
    .from("leads")
    .select("*")
    .eq("product_id", product_id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { product_id, leads } = body as {
    product_id: string;
    leads: { name: string; email: string }[];
  };

  if (!product_id) {
    return NextResponse.json({ error: "product_id is required." }, { status: 400 });
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "leads array is required." }, { status: 400 });
  }

  // Fetch existing emails for this product to avoid duplicates
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("leads")
    .select("email")
    .eq("product_id", product_id);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingEmails = new Set((existing ?? []).map((r: { email: string }) => r.email.toLowerCase()));

  const newLeads = leads
    .filter((l) => l.email && !existingEmails.has(l.email.toLowerCase()))
    .map((l) => ({ product_id, name: l.name, email: l.email, status: "COLD" }));

  if (newLeads.length === 0) {
    return NextResponse.json({ inserted: 0, message: "All leads already exist for this product." });
  }

  const { error: insertError } = await supabaseAdmin.from("leads").insert(newLeads);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: newLeads.length,
    skipped: leads.length - newLeads.length,
    message: `${newLeads.length} lead${newLeads.length !== 1 ? "s" : ""} saved.${leads.length - newLeads.length > 0 ? ` ${leads.length - newLeads.length} duplicate${leads.length - newLeads.length !== 1 ? "s" : ""} skipped.` : ""}`,
  });
}
