/**
 * seed.mjs — Node.js seed script for Lead Daily App
 *
 * Usage:
 *   node supabase/seed.mjs
 *
 * Requires .env.local to contain:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually (no external dep needed) ────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// ── Seed data ─────────────────────────────────────────────────────────────────

const USERS = [
  {
    email: "alice@example.com",
    // bcrypt hash of "password123" (12 rounds)
    password: "$2b$12$KIX/m4vfWrwwBRboNjFnKOQ5.zJ3Xg2jLYm7kFcS1JdV0uUH5Wq9i",
    subscription: "pro",
  },
  {
    email: "bob@example.com",
    password: "$2b$12$KIX/m4vfWrwwBRboNjFnKOQ5.zJ3Xg2jLYm7kFcS1JdV0uUH5Wq9i",
    subscription: "free",
  },
];

const getProducts = (userIds) => [
  {
    user_id: userIds[0],
    name: "LeadDaily",
    description:
      "AI-powered lead generation and cold email outreach tool for indie hackers and small businesses.",
    url: "https://leaddaily.app",
  },
  {
    user_id: userIds[0],
    name: "Scan2Sheet",
    description:
      "Scan physical documents and convert them into editable spreadsheets instantly using OCR and AI.",
    url: "https://scan2sheet.com",
  },
  {
    user_id: userIds[1],
    name: "DevPulse",
    description:
      "Developer productivity dashboard that tracks coding time, commits, and deployment frequency.",
    url: "https://devpulse.io",
  },
];

const getLeads = (productIds) => [
  // LeadDaily
  { product_id: productIds[0], name: "ABC Plumbing",        email: "contact@abcplumbing.com",    status: "COLD" },
  { product_id: productIds[0], name: "XYZ Marketing",       email: "hello@xyzmarketing.com",      status: "WARM" },
  { product_id: productIds[0], name: "Green Lawns Co",      email: "info@greenlawns.com.au",      status: "FOLLOWED" },
  { product_id: productIds[0], name: "Sydney Roofing",      email: "admin@sydneyroofing.com.au",  status: "COLD" },
  { product_id: productIds[0], name: "BlueSky Real Estate", email: "sales@blueskyrealestate.com", status: "WARM" },
  // Scan2Sheet
  { product_id: productIds[1], name: "Metro Accountants",   email: "accounts@metrocpa.com",       status: "COLD" },
  { product_id: productIds[1], name: "FastDocs Legal",      email: "info@fastdocslegal.com",      status: "WARM" },
  // DevPulse
  { product_id: productIds[2], name: "Startup Labs",        email: "team@startuplabs.io",         status: "COLD" },
  { product_id: productIds[2], name: "CodeCraft Agency",    email: "hello@codecraft.dev",         status: "FOLLOWED" },
];

const getContacts = (productIds) => [
  // LeadDaily — cold
  {
    product_id: productIds[0],
    type: "COLD",
    subject: "Grow your business with AI-powered leads",
    content: `Hi {{name}},

I'm reaching out because I think LeadDaily could save you hours every week.

LeadDaily uses AI to find highly targeted leads for your business and sends personalised cold emails automatically — so you can focus on closing deals instead of prospecting.

Would you be open to a quick 15-minute call this week to see if it's a fit?

Best,
Alice`,
  },
  // LeadDaily — follow-up
  {
    product_id: productIds[0],
    type: "FOLLOW-UP",
    subject: "Just following up — LeadDaily",
    content: `Hi {{name}},

I sent you a note a few days ago about LeadDaily and wanted to follow up in case it got buried.

We've helped businesses like yours generate 50–100 new leads per week with zero manual effort.

Happy to share a short demo if you're curious. Just reply to this email!

Best,
Alice`,
  },
  // Scan2Sheet — cold
  {
    product_id: productIds[1],
    type: "COLD",
    subject: "Stop retyping documents — try Scan2Sheet",
    content: `Hi {{name}},

Do you ever spend time manually entering data from scanned documents or PDFs into spreadsheets?

Scan2Sheet eliminates that entirely. Snap a photo or upload a file and get a clean, editable spreadsheet in seconds — powered by OCR and AI.

Free to try. Would love your feedback!

Cheers,
Alice`,
  },
  // Scan2Sheet — follow-up
  {
    product_id: productIds[1],
    type: "FOLLOW-UP",
    subject: "Quick follow-up: Scan2Sheet",
    content: `Hi {{name}},

Just a quick follow-up on Scan2Sheet. Teams that process invoices, receipts, or contracts regularly tell us they save 3–5 hours a week.

Would it be worth a 10-minute look?

Cheers,
Alice`,
  },
  // DevPulse — cold
  {
    product_id: productIds[2],
    type: "COLD",
    subject: "Track your team's engineering velocity",
    content: `Hi {{name}},

DevPulse gives engineering teams a single dashboard to track coding time, PR throughput, and deployment frequency — without changing any workflows.

We integrate with GitHub, GitLab, and Jira in under 5 minutes.

Worth a look? Free 14-day trial available.

Bob`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertUsers() {
  console.log("👤  Seeding users…");
  const results = [];
  for (const user of USERS) {
    // Upsert on email so the script is re-runnable
    const { data, error } = await supabase
      .from("users")
      .upsert(user, { onConflict: "email" })
      .select("id, email, subscription")
      .single();
    if (error) throw new Error(`users: ${error.message}`);
    results.push(data);
    console.log(`  ✓ ${data.email}  (${data.id})`);
  }
  return results;
}

async function upsertProducts(userIds) {
  console.log("\n📦  Seeding products…");
  const rows = getProducts(userIds);
  const results = [];
  for (const row of rows) {
    // Upsert on (user_id, name) would need a unique constraint; instead delete+insert
    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select("id, user_id, name")
      .single();
    if (error) throw new Error(`products: ${error.message}`);
    results.push(data);
    console.log(`  ✓ ${data.name}  (${data.id})`);
  }
  return results;
}

async function insertLeads(productIds) {
  console.log("\n🎯  Seeding leads…");
  const rows = getLeads(productIds);
  const { data, error } = await supabase.from("leads").insert(rows).select("id, name, status");
  if (error) throw new Error(`leads: ${error.message}`);
  for (const lead of data) console.log(`  ✓ ${lead.name}  [${lead.status}]`);
}

async function insertContacts(productIds) {
  console.log("\n✉️   Seeding contacts…");
  const rows = getContacts(productIds);
  const { data, error } = await supabase.from("contacts").insert(rows).select("id, type, subject");
  if (error) throw new Error(`contacts: ${error.message}`);
  for (const c of data) console.log(`  ✓ [${c.type}] ${c.subject}`);
}

async function cleanExisting(userEmails) {
  console.log("🧹  Removing previous seed rows (if any)…");
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .in("email", userEmails);
  if (users && users.length) {
    const ids = users.map((u) => u.id);
    // CASCADE will remove products → leads/contacts automatically
    await supabase.from("users").delete().in("id", ids);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting seed…\n");

  const emails = USERS.map((u) => u.email);
  await cleanExisting(emails);

  const users = await upsertUsers();
  const userIds = users.map((u) => u.id);

  const products = await upsertProducts(userIds);
  const productIds = products.map((p) => p.id);

  await insertLeads(productIds);
  await insertContacts(productIds);

  console.log("\n✅  Seed complete!");
  console.log("\n── Dashboard test user IDs ──────────────────────────────────");
  for (const u of users) {
    console.log(`  ${u.email}  →  ${u.id}`);
  }
  console.log("────────────────────────────────────────────────────────────\n");
  console.log("Paste either ID into the Dashboard page to explore test data.");
}

main().catch((err) => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
