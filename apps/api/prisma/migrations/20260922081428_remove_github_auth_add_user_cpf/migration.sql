
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" TEXT;

-- DropTable
DROP TABLE "accounts";

-- DropEnum
DROP TYPE "AccountProvider";

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

