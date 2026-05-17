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
  // Verify the request comes from Vercel Cron (or an authorised caller)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch all pending scheduled emails whose send_at has passed
  const { data: due, error: fetchError } = await supabaseAdmin
    .from("scheduled_emails")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", now);

  if (fetchError) {
    console.error("Failed to fetch scheduled emails:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ message: "No scheduled emails due." });
  }

  // Fetch email configs for all unique product_ids in this batch
  const uniqueProductIds = [...new Set(due.map((r: { product_id: string }) => r.product_id))];
  const { data: emailConfigs } = await supabaseAdmin
    .from("email_config")
    .select("product_id, host, port, username, password, email_from")
    .in("product_id", uniqueProductIds);

  // Map product_id → config for fast lookup
  const configByProduct = new Map(
    (emailConfigs ?? []).map((c: { product_id: string; host: string; port: number; username: string; password: string; email_from: string }) => [c.product_id, c])
  );

  // Helper: get (or create) a nodemailer transporter for a given product
  const transporterCache = new Map<string, ReturnType<typeof nodemailer.createTransport>>();
  function getTransporter(productId: string) {
    if (transporterCache.has(productId)) return transporterCache.get(productId)!;
    const cfg = configByProduct.get(productId);
    const host = cfg?.host ?? process.env.SMTP_HOST;
    const port = cfg?.port ?? Number(process.env.SMTP_PORT) ?? 587;
    const user = cfg?.username ?? process.env.SMTP_USER;
    const pass = cfg?.password ?? process.env.SMTP_PASS;
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
    const transporter = getTransporter(row.product_id);

    try {
      await transporter.sendMail({
        from: sender.fromHeader,
        envelope: { from: sender.envelopeFrom, to: row.lead_email },
        to: row.lead_email,
        subject: personalizedSubject,
        text: personalizedBody,
      });

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

      sentCount++;
    } catch (err: any) {
      console.error(`Failed to send follow-up to ${row.lead_email}:`, err.message);

      await supabaseAdmin
        .from("scheduled_emails")
        .update({ status: "failed" })
        .eq("id", row.id);

      failedCount++;
    }
  }

  return NextResponse.json({
    message: `Follow-up emails processed. ${sentCount} sent, ${failedCount} failed.`,
    sentCount,
    failedCount,
  });
}
