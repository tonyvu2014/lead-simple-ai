import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadSimple.AI",
  description:
    "Find leads and send cold outreach emails using AI-powered business search",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
