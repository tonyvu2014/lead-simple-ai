-- ============================================================
-- Lead Daily App — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE lead_status AS ENUM ('COLD', 'WARM', 'FOLLOWED');
CREATE TYPE contact_type AS ENUM ('COLD', 'FOLLOW-UP');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'scale');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,           -- store a bcrypt hash, never plaintext
  joined_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription subscription_tier NOT NULL DEFAULT 'free',
  product_count INT NOT NULL DEFAULT 0
);

-- ============================================================
-- PRODUCTS
-- (one user → many products)
-- ============================================================

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  url         TEXT,
  daily_schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- LEADS
-- (one product → many leads)
-- ============================================================

CREATE TABLE leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  status     lead_status NOT NULL DEFAULT 'COLD'
);

-- ============================================================
-- CONTACTS  (email correspondence tied to a product)
-- (one product → many contacts)
-- ============================================================

CREATE TABLE contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type       contact_type NOT NULL,
  subject    TEXT NOT NULL,
  content    TEXT NOT NULL
);

-- ============================================================
-- INDEXES  (commonly queried foreign keys)
-- ============================================================

CREATE INDEX idx_products_user_id    ON products(user_id);
CREATE INDEX idx_leads_product_id    ON leads(product_id);
CREATE INDEX idx_contacts_product_id ON contacts(product_id);

-- ============================================================
-- TRIGGER: keep users.product_count in sync automatically
-- ============================================================

CREATE OR REPLACE FUNCTION sync_product_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET product_count = product_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET product_count = product_count - 1 WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_product_count
AFTER INSERT OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION sync_product_count();

-- ============================================================
-- SCHEDULED EMAILS
-- (follow-up emails queued to be sent after a delay)
-- ============================================================

CREATE TYPE scheduled_email_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE scheduled_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lead_email TEXT NOT NULL,
  lead_name  TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  from_name  TEXT,
  send_at    TIMESTAMPTZ NOT NULL,
  sent_at    TIMESTAMPTZ,
  status     scheduled_email_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_scheduled_emails_status_send_at ON scheduled_emails(status, send_at);
