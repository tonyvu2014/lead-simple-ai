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

function resolveSender(rawFrom: string | undefined, fallbackEmail: string | undefined, displayName?: string) {
  const envelopeFrom = extractEmailAddress(rawFrom) ?? extractEmailAddress(fallbackEmail);
  if (!envelopeFrom) {
    throw new Error("No valid sender email address available for SMTP envelope.");
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

export async function POST(request: Request) {
  const body = await request.json();
  const { product_id, to, product_name } = body as {
    product_id: string;
    to: string;
    product_name?: string;
  };

  if (!product_id || !to) {
    return NextResponse.json({ error: "product_id and to are required." }, { status: 400 });
  }

  const ownership = await requireOwnedProduct(request, product_id);
  if ("response" in ownership) return ownership.response;

  const { data: emailConfig, error: emailConfigError } = await supabaseAdmin
    .from("email_config")
    .select("host, port, username, password, email_from")
    .eq("product_id", product_id)
    .maybeSingle();

  if (emailConfigError) {
    return NextResponse.json({ error: emailConfigError.message }, { status: 500 });
  }

  if (!emailConfig) {
    return NextResponse.json(
      { error: "No email server config found for this product." },
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: Number(emailConfig.port) || 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
    tls: {
      minVersion: "TLSv1.2",
      servername: emailConfig.host,
    },
  });

  const { fromHeader, envelopeFrom } = resolveSender(
    emailConfig.email_from,
    emailConfig.username || process.env.EMAIL_FROM,
    product_name
  );
  const subject = `SMTP Test - ${product_name ?? "LeadDaily"}`;
  const text = "This is a test email sent from your configured SMTP server in LeadDaily. If you receive this email, your email server configuration is working.";

  try {
    await transporter.sendMail({
      from: fromHeader,
      envelope: { from: envelopeFrom, to },
      to,
      subject,
      text,
    });

    return NextResponse.json({ message: "Test email sent successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send test email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
