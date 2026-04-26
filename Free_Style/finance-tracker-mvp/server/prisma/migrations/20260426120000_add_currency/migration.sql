CREATE TYPE "Currency" AS ENUM ('RUB', 'EUR');

ALTER TABLE "transactions"
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'RUB';
