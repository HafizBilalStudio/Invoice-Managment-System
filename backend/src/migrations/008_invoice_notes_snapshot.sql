ALTER TABLE invoices
  ADD COLUMN payout_notes_snapshot TEXT NULL AFTER bank_country_snapshot;
