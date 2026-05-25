import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmailAddress(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  const candidate = (match?.[1] ?? trimmed).trim();
  return EMAIL_REGEX.test(candidate) ? candidate : null;
}

function quoteDisplayName(value: string) {
  return value.replace(/"/g, "").trim();
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1">$1</a>'
  );
  return linked.replace(/\n/g, "<br>\n");
}

function resolveSender(
  rawFrom: string | undefined,
  fallbackEmail: string | undefined,
  displayName?: string,
  forceDisplayName?: boolean
) {
  const envelopeFrom = extractEmailAddress(rawFrom) ?? extractEmailAddress(fallbackEmail);
  if (!envelopeFrom) {
    throw new Error("No valid sender email address available for SMTP envelope.");
  }

  if (forceDisplayName && displayName?.trim()) {
    return {
      fromHeader: `"${quoteDisplayName(displayName)}" <${envelopeFrom}>`,
      envelopeFrom,
    };
  }

  if (extractEmailAddress(rawFrom)) {
    return { fromHeader: rawFrom!.trim(), envelopeFrom };
  }

  if (rawFrom?.trim()) {
    return {
      fromHeader: `"${quoteDisplayName(rawFrom)}" <${envelopeFrom}>`,
      envelopeFrom,
    };
  }

  if (displayName?.trim()) {
    return {
      fromHeader: `"${quoteDisplayName(displayName)}" <${envelopeFrom}>`,
      envelopeFrom,
    };
  }

  return { fromHeader: envelopeFrom, envelopeFrom };
}

export async function GET(request: Request) {
  console.log("[send-scheduled-emails] Cron job triggered at", new Date().toISOString());

  // Verify the request comes from Vercel Cron (or an authorised caller)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[send-scheduled-emails] Unauthorized request — invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[send-scheduled-emails] Auth check passed");

  const now = new Date().toISOString();

  // Fetch all pending scheduled emails whose send_at has passed
  console.log("[send-scheduled-emails] Fetching pending scheduled emails due before", now);
  const { data: due, error: fetchError } = await supabaseAdmin
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", now);

  if (fetchError) {
    console.error("[send-scheduled-emails] Failed to fetch scheduled emails:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    console.log("[send-scheduled-emails] No scheduled emails due — exiting early");
    return NextResponse.json({ message: "No scheduled emails due." });
  }

  console.log(`[send-scheduled-emails] Found ${due.length} email(s) to process`);

  // Fetch email configs for all unique product_ids in this batch
  const uniqueProductIds = [...new Set(due.map((r: { product_id: string }) => r.product_id))];
  console.log("[send-scheduled-emails] Fetching email configs for product_ids:", uniqueProductIds);
  const { data: emailConfigs } = await supabaseAdmin
    .from("email_config")
    .select("product_id, host, port, username, password, email_from")
    .in("product_id", uniqueProductIds);

  console.log(`[send-scheduled-emails] Loaded ${emailConfigs?.length ?? 0} email config(s)`);

  // Map product_id → config for fast lookup
  const configByProduct = new Map(
    (emailConfigs ?? []).map((c: { product_id: string; host: string; port: number; username: string; password: string; email_from: string }) => [c.product_id, c])
  );

  // Helper: get (or create) a nodemailer transporter for a given product
  const transporterCache = new Map<string, ReturnType<typeof nodemailer.createTransport>>();
  function getTransporter(productId: string) {
    if (transporterCache.has(productId)) {
      console.log(`[send-scheduled-emails] Reusing cached transporter for product ${productId}`);
      return transporterCache.get(productId)!;
    }
    const cfg = configByProduct.get(productId);
    const host = cfg?.host ?? process.env.SMTP_HOST;
    const port = cfg?.port ?? Number(process.env.SMTP_PORT) ?? 587;
    const user = cfg?.username ?? process.env.SMTP_USER;
    const pass = cfg?.password ?? process.env.SMTP_PASS;
    console.log(`[send-scheduled-emails] Creating transporter for product ${productId} — host: ${host}, port: ${port}, user: ${user}`);
    const t = nodemailer.createTransport({
      host,
      port,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { minVersion: "TLSv1.2", servername: host },
    });
    transporterCache.set(productId, t);
    return t;
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const row of due) {
    console.log(`[send-scheduled-emails] Processing email id=${row.id} → ${row.lead_email} (product: ${row.product_id}, send_at: ${row.send_at})`);
    const personalizedSubject = row.subject.replace(/\{\{name\}\}/gi, row.lead_name || "");
    const personalizedBody = row.body.replace(/\{\{name\}\}/gi, row.lead_name || "");
    const cfg = configByProduct.get(row.product_id);
    const fromEmail = cfg?.email_from ?? process.env.EMAIL_FROM;
    const fallbackSenderEmail = cfg?.username ?? process.env.SMTP_USER ?? process.env.EMAIL_FROM;
    const sender = resolveSender(
      fromEmail,
      fallbackSenderEmail,
      row.from_name,
      !cfg
    );
    console.log(`[send-scheduled-emails] Resolved sender — from: "${sender.fromHeader}", envelope: ${sender.envelopeFrom}`);
    const transporter = getTransporter(row.product_id);

    try {
      console.log(`[send-scheduled-emails] Sending email id=${row.id} to ${row.lead_email} with subject "${personalizedSubject}"`);
      await transporter.sendMail({
        from: sender.fromHeader,
        envelope: { from: sender.envelopeFrom, to: row.lead_email },
        to: row.lead_email,
        subject: personalizedSubject,
        text: personalizedBody,
        html: textToHtml(personalizedBody),
      });
      console.log(`[send-scheduled-emails] Email id=${row.id} sent successfully to ${row.lead_email}`);

      await supabaseAdmin
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      // Update lead status to FOLLOWED
      await supabaseAdmin
        .from("leads")
        .update({ status: "FOLLOWED" })
        .eq("product_id", row.product_id)
        .eq("email", row.lead_email);

      console.log(`[send-scheduled-emails] Lead ${row.lead_email} status updated to FOLLOWED`);
      sentCount++;
    } catch (err: any) {
      console.error(`[send-scheduled-emails] Failed to send email id=${row.id} to ${row.lead_email}:`, err.message);

      await supabaseAdmin
        .from("scheduled_emails")
        .update({ status: "failed" })
        .eq("id", row.id);

      failedCount++;
    }
  }

  console.log(`[send-scheduled-emails] Done — sent: ${sentCount}, failed: ${failedCount}`);
  return NextResponse.json({
    message: `Follow-up emails processed. ${sentCount} sent, ${failedCount} failed.`,
    sentCount,
    failedCount,
  });
}
