/*
  Warnings:

  - A unique constraint covering the columns `[userId,importKey]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "importKey" VARCHAR(120);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_importKey_key" ON "transactions"("userId", "importKey");
