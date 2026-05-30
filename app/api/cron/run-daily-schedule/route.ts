import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function getBaseUrl(request: Request): string {
  const envBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envBaseUrl) return envBaseUrl;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  console.log("[run-daily-schedule] Cron job triggered at", new Date().toISOString());

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[run-daily-schedule] Unauthorized request — invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[run-daily-schedule] Auth check passed");

  console.log("[run-daily-schedule] Fetching products with daily_schedule_enabled=true");
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, daily_schedule_enabled")
    .eq("daily_schedule_enabled", true)
    .order("name");

  if (productsError) {
    console.error("[run-daily-schedule] Failed to fetch products:", productsError.message);
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    console.log("[run-daily-schedule] No products have daily scheduling enabled — exiting early");
    return NextResponse.json({
      message: "No products have daily scheduling enabled.",
      processedProducts: 0,
      scheduledProducts: 0,
      totalLeadsQueued: 0,
    });
  }

  console.log(`[run-daily-schedule] Found ${products.length} product(s) to process:`, products.map(p => `${p.name} (${p.id})`));

  const baseUrl = getBaseUrl(request);
  console.log("[run-daily-schedule] Using base URL:", baseUrl);

  let scheduledProducts = 0;
  let totalLeadsQueued = 0;
  const productResults: Array<{ product_id: string; product_name: string; queued: number; status: string }> = [];

  for (const product of products) {
    console.log(`[run-daily-schedule] Processing product "${product.name}" (${product.id})`);

    const { data: coldTemplate, error: templateError } = await supabaseAdmin
      .from("contacts")
      .select("subject, content")
      .eq("product_id", product.id)
      .eq("type", "COLD")
      .maybeSingle();

    if (templateError || !coldTemplate?.subject || !coldTemplate?.content) {
      console.warn(`[run-daily-schedule] Skipping "${product.name}" — missing COLD template (error: ${templateError?.message ?? "no subject/content"})`);
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "skipped_missing_cold_template",
      });
      continue;
    }

    console.log(`[run-daily-schedule] COLD template found for "${product.name}" — subject: "${coldTemplate.subject}"`);

    const { data: coldLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("name, email")
      .eq("product_id", product.id)
      .eq("status", "COLD")
      .order("id")
      .limit(100);

    if (leadsError) {
      console.error(`[run-daily-schedule] Failed to fetch COLD leads for "${product.name}":`, leadsError.message);
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "failed_fetching_leads",
      });
      continue;
    }

    if (!coldLeads || coldLeads.length === 0) {
      console.log(`[run-daily-schedule] Skipping "${product.name}" — no COLD leads found`);
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "skipped_no_cold_leads",
      });
      continue;
    }

    console.log(`[run-daily-schedule] Found ${coldLeads.length} COLD lead(s) for "${product.name}" — calling /api/send-emails`);

    try {
      const sendRes = await fetch(`${baseUrl}/api/send-emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": process.env.CRON_SECRET ?? "",
        },
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
        console.error(`[run-daily-schedule] /api/send-emails failed for "${product.name}" (HTTP ${sendRes.status}):`, sendData.error ?? "unknown error");
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

      console.log(`[run-daily-schedule] "${product.name}" — ${sentCount} email(s) queued successfully`);

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
    } catch (err: any) {
      console.error(`[run-daily-schedule] Exception while calling /api/send-emails for "${product.name}":`, err.message);
      productResults.push({
        product_id: product.id,
        product_name: product.name,
        queued: 0,
        status: "failed_sending_request",
      });
    }
  }

  console.log(`[run-daily-schedule] Done — processed: ${products.length}, scheduled: ${scheduledProducts}, total leads queued: ${totalLeadsQueued}`);
  console.log("[run-daily-schedule] Product results:", JSON.stringify(productResults, null, 2));

  return NextResponse.json({
    message: "Daily schedule processed.",
    processedProducts: products.length,
    scheduledProducts,
    totalLeadsQueued,
    productResults,
  });
}
