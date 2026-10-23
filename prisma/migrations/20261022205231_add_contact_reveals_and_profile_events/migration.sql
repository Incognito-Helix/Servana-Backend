-- CreateEnum
CREATE TYPE "HiredResponse" AS ENUM ('yes', 'no');

-- CreateEnum
CREATE TYPE "ProfileEventType" AS ENUM ('impression', 'view', 'contact_tap');

-- CreateTable
CREATE TABLE "contact_reveals" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstRevealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followupSentAt" TIMESTAMP(3),
    "hiredResponse" "HiredResponse",

    CONSTRAINT "contact_reveals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_events" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "ProfileEventType" NOT NULL,
    "boostId" TEXT,
    "viewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_reveals_customerId_idx" ON "contact_reveals"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_reveals_profileId_customerId_key" ON "contact_reveals"("profileId", "customerId");

-- CreateIndex
CREATE INDEX "profile_events_profileId_createdAt_idx" ON "profile_events"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "profile_events_boostId_idx" ON "profile_events"("boostId");

-- CreateIndex
CREATE INDEX "profile_events_viewerId_type_createdAt_idx" ON "profile_events"("viewerId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "boosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
