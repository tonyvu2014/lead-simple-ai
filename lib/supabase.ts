import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

// Client-side client — uses the anon key, subject to RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client — uses the service role key, bypasses RLS.
// Only import this in API routes (server-side), never in client components.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey ?? supabaseAnonKey
);

// ── Type definitions matching the database schema ──────────────────────────

export type SubscriptionTier = "free" | "pro" | "enterprise";
export type LeadStatus = "COLD" | "WARM" | "FOLLOWED";
export type ContactType = "COLD" | "FOLLOW-UP";

export interface User {
  id: string;
  email: string;
  joined_date: string;
  subscription: SubscriptionTier;
  product_count: number;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  url: string | null;
  daily_schedule_enabled: boolean;
}

export interface Lead {
  id: string;
  product_id: string;
  name: string;
  email: string;
  status: LeadStatus;
}

export interface Contact {
  id: string;
  product_id: string;
  type: ContactType;
  subject: string;
  content: string;
}

export type ScheduledEmailStatus = "pending" | "sent" | "failed";

export interface ScheduledEmail {
  id: string;
  product_id: string;
  lead_email: string;
  lead_name: string;
  subject: string;
  body: string;
  from_name: string | null;
  send_at: string;
  sent_at: string | null;
  status: ScheduledEmailStatus;
}
