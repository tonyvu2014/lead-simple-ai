import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnedProduct } from "@/lib/auth-server";

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

interface Business {
  name: string;
  email: string;
}

export async function POST(request: Request) {
  const { businesses, emailBody, subject, product_id, product_name } = (await request.json()) as {
    businesses: Business[];
    emailBody: string;
    subject: string;
    product_id?: string;
    product_name?: string;
  };

  if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
    return NextResponse.json(
      { error: "No businesses provided." },
      { status: 400 }
    );
  }

  if (!emailBody || typeof emailBody !== "string") {
    return NextResponse.json(
      { error: "Email body is required." },
      { status: 400 }
    );
  }

  if (product_id) {
    const ownership = await requireOwnedProduct(request, product_id);
    if ("response" in ownership) return ownership.response;
  }

  // If a product_id is provided, skip leads that are already WARM or FOLLOWED
  let eligibleBusinesses = businesses;
  if (product_id) {
    const allEmails = businesses.map((b) => b.email.toLowerCase());
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("email, status")
      .eq("product_id", product_id)
      .in("email", allEmails);

    const ineligibleEmails = new Set(
      (existingLeads ?? [])
        .filter((l: { status: string }) => l.status === "WARM" || l.status === "FOLLOWED")
        .map((l: { email: string }) => l.email.toLowerCase())
    );

    eligibleBusinesses = businesses.filter((b) => !ineligibleEmails.has(b.email.toLowerCase()));

    if (eligibleBusinesses.length === 0) {
      return NextResponse.json({
        message: "No eligible leads to email. All provided leads have already been contacted.",
        results: businesses.map((b) => ({ email: b.email, status: "skipped" })),
      });
    }
  }

  // Resolve SMTP config: use product's custom config if it exists, else fall back to env vars
  let smtpHost = process.env.SMTP_HOST;
  let smtpPort = Number(process.env.SMTP_PORT) || 587;
  let smtpUser = process.env.SMTP_USER;
  let smtpPass = process.env.SMTP_PASS;
  let emailFrom = process.env.EMAIL_FROM;
  let hasCustomEmailConfig = false;

  if (product_id) {
    const { data: emailConfig } = await supabaseAdmin
      .from("email_config")
      .select("host, port, username, password, email_from")
      .eq("product_id", product_id)
      .maybeSingle();

    if (emailConfig) {
      smtpHost = emailConfig.host;
      smtpPort = emailConfig.port;
      smtpUser = emailConfig.username;
      smtpPass = emailConfig.password;
      emailFrom = emailConfig.email_from;
      hasCustomEmailConfig = true;
    }
  }

  const useSSL = smtpPort === 465;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: useSSL,
    ...(!useSSL && { requireTLS: true }),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      minVersion: "TLSv1.2",
      servername: smtpHost,
    },
  });

  const results: { email: string; status: string }[] = [];

  const sender = resolveSender(
    emailFrom,
    smtpUser ?? process.env.EMAIL_FROM,
    product_name,
    !hasCustomEmailConfig
  );

  for (const biz of eligibleBusinesses) {
    try {
      const personalizedBody = emailBody.replace(/\{\{name\}\}/gi, biz.name || "");
      await transporter.sendMail({
        from: sender.fromHeader,
        envelope: { from: sender.envelopeFrom, to: biz.email },
        to: biz.email,
        subject: subject || "Hello from LeadDaily.App",
        text: personalizedBody,
        html: textToHtml(personalizedBody),
      });
      results.push({ email: biz.email, status: "sent" });
    } catch (error: any) {
      console.error(`Failed to send to ${biz.email}:`, error.message);
      results.push({ email: biz.email, status: "failed" });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  console.log('Results:', results);

  // If a product_id was provided, upsert sent leads to WARM status
  // and schedule follow-up emails if a FOLLOW-UP contact template exists
  if (product_id) {
    const sentEmails = results
      .filter((r) => r.status === "sent")
      .map((r) => r.email.toLowerCase());

    if (sentEmails.length > 0) {
      // Fetch existing leads for this product with matching emails
      const { data: existingLeads } = await supabaseAdmin
        .from("leads")
        .select("id, email")
        .eq("product_id", product_id)
        .in("email", sentEmails);

      const existingEmailSet = new Set(
        (existingLeads ?? []).map((l: { email: string }) => l.email.toLowerCase())
      );

      // Update existing leads to WARM
      if (existingLeads && existingLeads.length > 0) {
        await supabaseAdmin
          .from("leads")
          .update({ status: "WARM" })
          .eq("product_id", product_id)
          .in("email", sentEmails);
      }

      // Insert new leads that don't exist yet, with WARM status
      const newLeads = eligibleBusinesses
        .filter((b) => sentEmails.includes(b.email.toLowerCase()) && !existingEmailSet.has(b.email.toLowerCase()))
        .map((b) => ({ product_id, name: b.name, email: b.email, status: "WARM" }));

      if (newLeads.length > 0) {
        await supabaseAdmin.from("leads").insert(newLeads);
      }

      // Check if a FOLLOW-UP contact template exists for this product
      const { data: followUpContact } = await supabaseAdmin
        .from("contacts")
        .select("subject, content")
        .eq("product_id", product_id)
        .eq("type", "FOLLOW-UP")
        .maybeSingle();

      if (followUpContact?.subject && followUpContact?.content) {
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + 5);

        const scheduledRows = eligibleBusinesses
          .filter((b) => sentEmails.includes(b.email.toLowerCase()))
          .map((b) => ({
            product_id,
            lead_email: b.email,
            lead_name: b.name,
            subject: followUpContact.subject,
            body: followUpContact.content,
            from_name: product_name ?? null,
            send_at: sendAt.toISOString(),
          }));

        if (scheduledRows.length > 0) {
          await supabaseAdmin.from("scheduled_emails").insert(scheduledRows);
        }
      }
    }
  }

  return NextResponse.json({
    message: `Email sending complete. ${sentCount} sent, ${failedCount} failed.`,
    results,
  });
}
