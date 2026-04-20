import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface Business {
  name: string;
  email: string;
}

export async function POST(request: Request) {
  const { businesses, emailBody, subject } = (await request.json()) as {
    businesses: Business[];
    emailBody: string;
    subject: string;
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

  for (const biz of businesses) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: biz.email,
        subject: subject || "Hello from LeadDaily.App",
        text: emailBody,
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

  return NextResponse.json({
    message: `Email sending complete. ${sentCount} sent, ${failedCount} failed.`,
    results,
  });
}
