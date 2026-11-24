
ALTER TABLE tabs ADD COLUMN stock_debited_at TIMESTAMP(3);
DROP INDEX payments_tab_id_key;
CREATE INDEX payments_tab_id_idx ON payments(tab_id);
CREATE TABLE bill_splits (
 id TEXT PRIMARY KEY, tab_id TEXT NOT NULL UNIQUE REFERENCES tabs(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('PEOPLE','ITEMS')),
 subtotal_in_cents INTEGER NOT NULL CHECK(subtotal_in_cents>=0),
 service_fee_in_cents INTEGER NOT NULL CHECK(service_fee_in_cents>=0),
 discount_in_cents INTEGER NOT NULL CHECK(discount_in_cents>=0),
 amount_in_cents INTEGER NOT NULL CHECK(amount_in_cents>=0), adjustments JSONB NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(amount_in_cents::bigint=subtotal_in_cents::bigint+service_fee_in_cents::bigint-discount_in_cents::bigint)
);
CREATE TABLE partial_invoices (
 id TEXT PRIMARY KEY, split_id TEXT NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>0), name TEXT NOT NULL,
 amount_in_cents INTEGER NOT NULL CHECK(amount_in_cents>=0),
 subtotal_in_cents INTEGER, service_fee_in_cents INTEGER, discount_in_cents INTEGER,
 items JSONB NOT NULL, UNIQUE(split_id,position),
 CHECK(subtotal_in_cents IS NULL OR (subtotal_in_cents>=0 AND service_fee_in_cents>=0 AND discount_in_cents>=0 AND amount_in_cents::bigint=subtotal_in_cents::bigint+service_fee_in_cents::bigint-discount_in_cents::bigint))
);
ALTER TABLE payments ADD COLUMN invoice_id TEXT UNIQUE REFERENCES partial_invoices(id) ON DELETE CASCADE;
-- Keep the old uniqueness guarantee for non-split checkouts.
CREATE UNIQUE INDEX payments_single_tab_unique ON payments(tab_id) WHERE invoice_id IS NULL;

-- Item mutations and split creation serialize on the same parent tab. During
-- a restaurant/tab cascade the parent is absent, so deletion remains possible.
CREATE FUNCTION guard_split_items() RETURNS TRIGGER AS $$
DECLARE target TEXT;
BEGIN
 FOR target IN SELECT id FROM tabs WHERE id IN (
  CASE WHEN TG_OP <> 'INSERT' THEN OLD.tab_id END,
  CASE WHEN TG_OP <> 'DELETE' THEN NEW.tab_id END
 ) ORDER BY id FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM bill_splits WHERE tab_id=target) THEN
   RAISE EXCEPTION 'BILL_SPLIT_LOCKED' USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER frozen_split_items BEFORE INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION guard_split_items();

CREATE FUNCTION guard_split_payment() RETURNS TRIGGER AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM tabs WHERE id=NEW.tab_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM bill_splits WHERE tab_id=NEW.tab_id) THEN
   IF NOT EXISTS(SELECT 1 FROM partial_invoices i JOIN bill_splits s ON s.id=i.split_id
    JOIN tabs t ON t.id=s.tab_id WHERE i.id=NEW.invoice_id AND s.tab_id=NEW.tab_id
    AND t.restaurant_id=NEW.restaurant_id AND i.amount_in_cents=NEW.amount_in_cents) THEN
    RAISE EXCEPTION 'BILL_SPLIT_LOCKED' USING ERRCODE='23514';
   END IF;
  ELSIF NEW.invoice_id IS NOT NULL THEN
   RAISE EXCEPTION 'BILL_SPLIT_LOCKED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.invoice_id IS NOT NULL AND EXISTS(SELECT 1 FROM tabs WHERE id=OLD.tab_id) THEN
  RAISE EXCEPTION 'BILL_SPLIT_LOCKED' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER consistent_split_payments BEFORE INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION guard_split_payment();

CREATE FUNCTION guard_split_snapshot() RETURNS TRIGGER AS $$
DECLARE target TEXT;
BEGIN
 IF TG_TABLE_NAME='bill_splits' THEN target:=OLD.tab_id;
 ELSE SELECT tab_id INTO target FROM bill_splits WHERE id=OLD.split_id;
 END IF;
 IF EXISTS(SELECT 1 FROM tabs WHERE id=target) THEN
  RAISE EXCEPTION 'BILL_SPLIT_LOCKED' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_bill_split BEFORE UPDATE OR DELETE ON bill_splits FOR EACH ROW EXECUTE FUNCTION guard_split_snapshot();
CREATE TRIGGER immutable_partial_invoice BEFORE UPDATE OR DELETE ON partial_invoices FOR EACH ROW EXECUTE FUNCTION guard_split_snapshot();
