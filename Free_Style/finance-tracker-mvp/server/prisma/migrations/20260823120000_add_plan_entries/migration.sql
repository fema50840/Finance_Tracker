CREATE TABLE "plan_entries" (
  "id" BIGSERIAL NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'RUB',
  "userId" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "plan_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_entries_userId_date_idx" ON "plan_entries"("userId", "date");
CREATE INDEX "plan_entries_userId_type_date_idx" ON "plan_entries"("userId", "type", "date");
CREATE UNIQUE INDEX "plan_entries_userId_date_category_type_currency_key" ON "plan_entries"("userId", "date", "category", "type", "currency");

ALTER TABLE "plan_entries"
ADD CONSTRAINT "plan_entries_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
