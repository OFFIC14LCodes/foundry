-- ── founder_invoices ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS founder_invoices (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_number text       NOT NULL,
  client_name   text        NOT NULL,
  client_email  text,
  line_items    jsonb       NOT NULL DEFAULT '[]',
  due_date      date,
  notes         text,
  status        text        NOT NULL DEFAULT 'draft',
  total_amount  numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_invoices_user_id
  ON founder_invoices(user_id, created_at DESC);

ALTER TABLE founder_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "founder_invoices_select" ON founder_invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "founder_invoices_insert" ON founder_invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "founder_invoices_update" ON founder_invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "founder_invoices_delete" ON founder_invoices
  FOR DELETE USING (auth.uid() = user_id);

-- ── monthly_close_notes ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monthly_close_notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_year    text        NOT NULL,
  revenue       numeric(10,2),
  expenses      numeric(10,2),
  net           numeric(10,2),
  forge_insight text,
  founder_note  text,
  revenue_goal  numeric(10,2),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monthly_close_notes_user_id
  ON monthly_close_notes(user_id, created_at DESC);

ALTER TABLE monthly_close_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_close_notes_select" ON monthly_close_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "monthly_close_notes_insert" ON monthly_close_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_close_notes_update" ON monthly_close_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "monthly_close_notes_delete" ON monthly_close_notes
  FOR DELETE USING (auth.uid() = user_id);
