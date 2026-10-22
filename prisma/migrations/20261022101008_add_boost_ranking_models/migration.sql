-- CreateEnum
CREATE TYPE "BoostType" AS ENUM ('top_spot', 'zone_boost');

-- CreateEnum
CREATE TYPE "BoostStatus" AS ENUM ('pending', 'active', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "boosts" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "status" "BoostStatus" NOT NULL DEFAULT 'pending',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_zones" (
    "id" TEXT NOT NULL,
    "boostId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "boost_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boosts_status_type_startAt_endAt_idx" ON "boosts"("status", "type", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "boosts_profileId_status_idx" ON "boosts"("profileId", "status");

-- CreateIndex
CREATE INDEX "boosts_categoryId_status_idx" ON "boosts"("categoryId", "status");

-- CreateIndex
CREATE INDEX "boost_zones_zoneId_idx" ON "boost_zones"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "boost_zones_boostId_zoneId_key" ON "boost_zones"("boostId", "zoneId");

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_zones" ADD CONSTRAINT "boost_zones_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "boosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_zones" ADD CONSTRAINT "boost_zones_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
