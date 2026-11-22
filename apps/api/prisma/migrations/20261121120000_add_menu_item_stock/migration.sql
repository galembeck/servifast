-- AlterTable: units on hand per menu item. NULL means the item's stock is not
-- tracked (made-to-order dishes), so it is never decremented nor blocked.
ALTER TABLE "menu_items" ADD COLUMN "stock_quantity" INTEGER;

-- The balance can never go negative: closing a tab without enough stock fails
-- (and rolls back) instead of leaving an inconsistent balance.
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_stock_quantity_non_negative"
  CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);
