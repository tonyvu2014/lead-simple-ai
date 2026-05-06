-- ============================================================
-- Lead Daily App — Seed Data
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- WARNING: clears existing test rows first (safe to re-run)
-- ============================================================

-- ── Clean up previous seed data ──────────────────────────────
DELETE FROM users WHERE email IN (
  'alice@example.com',
  'bob@example.com'
);

-- ── Users ─────────────────────────────────────────────────────
-- Passwords are bcrypt hashes of "password123"
INSERT INTO users (id, email, password, joined_date, subscription)
VALUES
  (
    'aaaaaaaa-0000-4000-a000-000000000001',
    'alice@example.com',
    '$2b$12$KIX/m4vfWrwwBRboNjFnKOQ5.zJ3Xg2jLYm7kFcS1JdV0uUH5Wq9i',
    NOW() - INTERVAL '30 days',
    'pro'
  ),
  (
    'aaaaaaaa-0000-4000-a000-000000000002',
    'bob@example.com',
    '$2b$12$KIX/m4vfWrwwBRboNjFnKOQ5.zJ3Xg2jLYm7kFcS1JdV0uUH5Wq9i',
    NOW() - INTERVAL '10 days',
    'free'
  );

-- ── Products ───────────────────────────────────────────────────
INSERT INTO products (id, user_id, name, description, url)
VALUES
  (
    'bbbbbbbb-0000-4000-b000-000000000001',
    'aaaaaaaa-0000-4000-a000-000000000001',
    'LeadDaily',
    'AI-powered lead generation and cold email outreach tool for indie hackers and small businesses.',
    'https://leaddaily.app'
  ),
  (
    'bbbbbbbb-0000-4000-b000-000000000002',
    'aaaaaaaa-0000-4000-a000-000000000001',
    'Scan2Sheet',
    'Scan physical documents and convert them into editable spreadsheets instantly using OCR and AI.',
    'https://scan2sheet.com'
  ),
  (
    'bbbbbbbb-0000-4000-b000-000000000003',
    'aaaaaaaa-0000-4000-a000-000000000002',
    'DevPulse',
    'Developer productivity dashboard that tracks coding time, commits, and deployment frequency.',
    'https://devpulse.io'
  );

-- ── Leads ─────────────────────────────────────────────────────
INSERT INTO leads (product_id, name, email, status)
VALUES
  -- LeadDaily leads
  ('bbbbbbbb-0000-4000-b000-000000000001', 'ABC Plumbing',        'contact@abcplumbing.com',      'COLD'),
  ('bbbbbbbb-0000-4000-b000-000000000001', 'XYZ Marketing',       'hello@xyzmarketing.com',        'WARM'),
  ('bbbbbbbb-0000-4000-b000-000000000001', 'Green Lawns Co',      'info@greenlawns.com.au',        'FOLLOWED'),
  ('bbbbbbbb-0000-4000-b000-000000000001', 'Sydney Roofing',      'admin@sydneyroofing.com.au',    'COLD'),
  ('bbbbbbbb-0000-4000-b000-000000000001', 'BlueSky Real Estate', 'sales@blueskyrealestate.com',  'WARM'),
  -- Scan2Sheet leads
  ('bbbbbbbb-0000-4000-b000-000000000002', 'Metro Accountants',   'accounts@metrocpa.com',         'COLD'),
  ('bbbbbbbb-0000-4000-b000-000000000002', 'FastDocs Legal',      'info@fastdocslegal.com',        'WARM'),
  -- DevPulse leads
  ('bbbbbbbb-0000-4000-b000-000000000003', 'Startup Labs',        'team@startuplabs.io',           'COLD'),
  ('bbbbbbbb-0000-4000-b000-000000000003', 'CodeCraft Agency',    'hello@codecraft.dev',           'FOLLOWED');

-- ── Contacts ──────────────────────────────────────────────────
INSERT INTO contacts (product_id, type, subject, content)
VALUES
  -- LeadDaily — cold email
  (
    'bbbbbbbb-0000-4000-b000-000000000001',
    'COLD',
    'Grow your business with AI-powered leads',
    'Hi {{name}},

I''m reaching out because I think LeadDaily could save you hours every week.

LeadDaily uses AI to find highly targeted leads for your business and sends personalised cold emails automatically — so you can focus on closing deals instead of prospecting.

Would you be open to a quick 15-minute call this week to see if it''s a fit?

Best,
Alice'
  ),
  -- LeadDaily — follow-up email
  (
    'bbbbbbbb-0000-4000-b000-000000000001',
    'FOLLOW-UP',
    'Just following up — LeadDaily',
    'Hi {{name}},

I sent you a note a few days ago about LeadDaily and wanted to follow up in case it got buried.

We''ve helped businesses like yours generate 50–100 new leads per week with zero manual effort.

Happy to share a short demo if you''re curious. Just reply to this email!

Best,
Alice'
  ),
  -- Scan2Sheet — cold email
  (
    'bbbbbbbb-0000-4000-b000-000000000002',
    'COLD',
    'Stop retyping documents — try Scan2Sheet',
    'Hi {{name}},

Do you ever spend time manually entering data from scanned documents or PDFs into spreadsheets?

Scan2Sheet eliminates that entirely. Snap a photo or upload a file and get a clean, editable spreadsheet in seconds — powered by OCR and AI.

Free to try. Would love your feedback!

Cheers,
Alice'
  ),
  -- Scan2Sheet — follow-up
  (
    'bbbbbbbb-0000-4000-b000-000000000002',
    'FOLLOW-UP',
    'Quick follow-up: Scan2Sheet',
    'Hi {{name}},

Just a quick follow-up on Scan2Sheet. Teams that process invoices, receipts, or contracts regularly tell us they save 3–5 hours a week.

Would it be worth a 10-minute look?

Cheers,
Alice'
  ),
  -- DevPulse — cold email
  (
    'bbbbbbbb-0000-4000-b000-000000000003',
    'COLD',
    'Track your team''s engineering velocity',
    'Hi {{name}},

DevPulse gives engineering teams a single dashboard to track coding time, PR throughput, and deployment frequency — without changing any workflows.

We integrate with GitHub, GitLab, and Jira in under 5 minutes.

Worth a look? Free 14-day trial available.

Bob'
  );
