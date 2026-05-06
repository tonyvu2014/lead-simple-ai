import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function getBaseUrl(request: Request): string {
  const envBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envBaseUrl) return envBaseUrl;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, daily_schedule_enabled")
    .eq("daily_schedule_enabled", true)
    .order("name");

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({
      message: "No products have daily scheduling enabled.",
      processedProducts: 0,
      scheduledProducts: 0,
      totalLeadsQueued: 0,
    });
  }

  const baseUrl = getBaseUrl(request);

  let scheduledProducts = 0;
  let totalLeadsQueued = 0;
  const productResults: Array<{ product_id: string; product_name: string; queued: number; status: string }> = [];

  for (const product of products) {
    const { data: coldTemplate, error: templateError } = await supabaseAdmin
      .from("contacts")
      .select("subject, content")
      .eq("product_id", product.id)
      .eq("type", "COLD")
      .maybeSingle();

    if (templateError || !coldTemplate?.subject || !coldTemplate?.content) {
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "skipped_missing_cold_template",
      });
      continue;
    }

    const { data: coldLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("name, email")
      .eq("product_id", product.id)
      .eq("status", "COLD")
      .order("id")
      .limit(50);

    if (leadsError) {
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "failed_fetching_leads",
      });
      continue;
    }

    if (!coldLeads || coldLeads.length === 0) {
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "skipped_no_cold_leads",
      });
      continue;
    }

    try {
      const sendRes = await fetch(`${baseUrl}/api/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businesses: coldLeads,
          emailBody: coldTemplate.content,
          subject: coldTemplate.subject,
          product_id: product.id,
          product_name: product.name,
        }),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        productResults.push({
          product_id: product.id,
          product_name: product.name,
          queued: 0,
          status: `failed_sending_${sendData.error || "unknown"}`,
        });
        continue;
      }

      const sentCount = Array.isArray(sendData.results)
        ? sendData.results.filter((r: { status: string }) => r.status === "sent").length
        : 0;

      if (sentCount > 0) {
        scheduledProducts += 1;
        totalLeadsQueued += sentCount;
      }

      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: sentCount,
        status: "scheduled",
      });
    } catch {
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "failed_sending_request",
      });
    }
  }

  return NextResponse.json({
    message: "Daily schedule processed.",
    processedProducts: products.length,
    scheduledProducts,
    totalLeadsQueued,
    productResults,
  });
}
