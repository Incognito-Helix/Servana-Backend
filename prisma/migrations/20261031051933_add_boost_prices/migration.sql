-- CreateEnum
CREATE TYPE "BoostDuration" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateTable
CREATE TABLE "boost_prices" (
    "id" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "durationType" "BoostDuration" NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boost_prices_type_durationType_key" ON "boost_prices"("type", "durationType");
