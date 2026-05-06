import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase";

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

  const results: { email: string; status: string }[] = [];

  for (const biz of eligibleBusinesses) {
    try {
      const fromAddress = product_name
        ? `"${product_name}" <${process.env.EMAIL_FROM}>`
        : process.env.EMAIL_FROM;
      const personalizedBody = emailBody.replace(/\{\{name\}\}/gi, biz.name || "");
      await transporter.sendMail({
        from: fromAddress,
        to: biz.email,
        subject: subject || "Hello from LeadDaily.App",
        text: personalizedBody,
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
