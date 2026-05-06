import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase";

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

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      minVersion: "TLSv1.2",
      servername: process.env.SMTP_HOST,
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const row of due) {
    const personalizedSubject = row.subject.replace(/\{\{name\}\}/gi, row.lead_name || "");
    const personalizedBody = row.body.replace(/\{\{name\}\}/gi, row.lead_name || "");
    const fromAddress = row.from_name
      ? `"${row.from_name}" <${process.env.EMAIL_FROM}>`
      : process.env.EMAIL_FROM;

    try {
      await transporter.sendMail({
        from: fromAddress,
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
