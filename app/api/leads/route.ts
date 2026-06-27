import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnedProduct } from "@/lib/auth-server";

const SELECT_PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;

type LeadRow = {
  id: string;
  product_id: string;
  name: string;
  email: string;
  status: string;
};

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function fetchAllProductLeads(productId: string) {
  const leads: LeadRow[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const to = from + SELECT_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, product_id, name, email, status")
      .eq("product_id", productId)
      .order("name")
      .range(from, to);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as LeadRow[];
    leads.push(...batch);

    if (batch.length < SELECT_PAGE_SIZE) {
      break;
    }
  }

  return leads;
}

async function fetchAllProductLeadEmails(productId: string) {
  const emails: string[] = [];

  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const to = from + SELECT_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("email")
      .eq("product_id", productId)
      .range(from, to);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as { email: string }[];
    emails.push(...batch.map((row) => row.email));

    if (batch.length < SELECT_PAGE_SIZE) {
      break;
    }
  }

  return emails;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product_id = searchParams.get("product_id");

  if (!product_id) {
    return NextResponse.json(
      { error: "product_id is required." },
      { status: 400 }
    );
  }

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  try {
    const leads = await fetchAllProductLeads(product_id);
    return NextResponse.json({ leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  let existingEmails: Set<string>;
  try {
    existingEmails = new Set(
      (await fetchAllProductLeadEmails(product_id)).map((email) => email.toLowerCase())
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seenIncomingEmails = new Set<string>();
  const normalizedLeads = leads
    .map((lead) => ({
      name: typeof lead.name === "string" ? lead.name.trim() : "",
      email: typeof lead.email === "string" ? lead.email.trim() : "",
    }))
    .filter((lead) => {
      if (!lead.email) return false;
      const normalizedEmail = lead.email.toLowerCase();
      if (seenIncomingEmails.has(normalizedEmail)) return false;
      seenIncomingEmails.add(normalizedEmail);
      return true;
    });

  const newLeads = normalizedLeads
    .filter((lead) => !existingEmails.has(lead.email.toLowerCase()))
    .map((lead) => ({ product_id, name: lead.name, email: lead.email, status: "COLD" as const }));

  if (newLeads.length === 0) {
    return NextResponse.json({ inserted: 0, message: "All leads already exist for this product." });
  }

  for (const batch of chunkArray(newLeads, INSERT_BATCH_SIZE)) {
    const { error: insertError } = await supabaseAdmin.from("leads").insert(batch);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const skipped = leads.length - newLeads.length;

  return NextResponse.json({
    inserted: newLeads.length,
    skipped,
    message: `${newLeads.length} lead${newLeads.length !== 1 ? "s" : ""} saved.${skipped > 0 ? ` ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped.` : ""}`,
  });
}
