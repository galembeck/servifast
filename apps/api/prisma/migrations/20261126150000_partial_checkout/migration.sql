-- Reuse the immutable checkout snapshot/invoice ledger for free partial receipts.
-- Existing PEOPLE/ITEMS divisions and legacy payments remain unchanged.
ALTER TABLE bill_splits DROP CONSTRAINT bill_splits_mode_check;
ALTER TABLE bill_splits ADD CONSTRAINT bill_splits_mode_check CHECK (mode IN ('PEOPLE', 'ITEMS', 'PARTIAL'));
