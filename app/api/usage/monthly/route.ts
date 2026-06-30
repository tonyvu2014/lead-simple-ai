import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuthUser } from "@/lib/auth-server";

function getCurrentMonthBounds() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    monthStartIso: monthStart.toISOString(),
    nextMonthStartIso: nextMonthStart.toISOString(),
  };
}

export async function GET(request: Request) {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth.response;

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("user_id", auth.user.id);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const productIds = (products ?? []).map((product) => product.id);
  if (productIds.length === 0) {
    const { monthStartIso, nextMonthStartIso } = getCurrentMonthBounds();
    return NextResponse.json({
      leadCount: 0,
      productCount: 0,
      monthStart: monthStartIso,
      nextMonthStart: nextMonthStartIso,
    });
  }

  const { monthStartIso, nextMonthStartIso } = getCurrentMonthBounds();

  const { count, error: countError } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .in("product_id", productIds)
    .gte("created_at", monthStartIso)
    .lt("created_at", nextMonthStartIso);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  return NextResponse.json({
    leadCount: count ?? 0,
    productCount: productIds.length,
    monthStart: monthStartIso,
    nextMonthStart: nextMonthStartIso,
  });
}
