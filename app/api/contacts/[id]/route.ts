import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuthUser } from "@/lib/auth-server";

async function ensureContactOwnership(request: Request, contactId: string) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, product_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) {
    return {
      response: NextResponse.json({ error: contactError.message }, { status: 500 }),
    };
  }

  if (!contact) {
    return {
      response: NextResponse.json({ error: "Contact not found." }, { status: 404 }),
    };
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, user_id")
    .eq("id", contact.product_id)
    .maybeSingle();

  if (productError) {
    return {
      response: NextResponse.json({ error: productError.message }, { status: 500 }),
    };
  }

  if (!product || product.user_id !== auth.user.id) {
    return {
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { user: auth.user, contact };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownership = await ensureContactOwnership(request, id);
  if ("response" in ownership) return ownership.response;

  const body = await request.json();
  const { type, subject, content } = body;

  if (!type || !subject || !content) {
    return NextResponse.json(
      { error: "type, subject, and content are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .update({ type, subject, content })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownership = await ensureContactOwnership(request, id);
  if ("response" in ownership) return ownership.response;

  const { error } = await supabaseAdmin.from("contacts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
