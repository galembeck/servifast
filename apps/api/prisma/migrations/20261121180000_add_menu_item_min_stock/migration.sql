-- AlterTable: low-stock threshold per menu item. NULL means no alert.
ALTER TABLE "menu_items" ADD COLUMN "min_stock_quantity" INTEGER;

-- A minimum is never negative and only makes sense for items that track
-- stock: the API rejects both cases and the database enforces them too.
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_min_stock_quantity_valid"
  CHECK (
    "min_stock_quantity" IS NULL
    OR ("min_stock_quantity" >= 0 AND "stock_quantity" IS NOT NULL)
  );

-- Alert query: items that track stock and have a minimum.
CREATE INDEX "menu_items_stock_alerts_idx"
  ON "menu_items" ("restaurant_id")
  WHERE "min_stock_quantity" IS NOT NULL;
