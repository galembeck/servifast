-- AlterEnum
ALTER TYPE "order_item_status" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "delivered_at" TIMESTAMP(3);
