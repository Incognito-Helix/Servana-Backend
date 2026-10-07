/*
  Warnings:

  - You are about to drop the column `userAt` on the `user_recent_locations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,zoneId]` on the table `user_recent_locations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('instagram', 'tiktok', 'x', 'facebook', 'other');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'passed', 'failed');

-- DropForeignKey
ALTER TABLE "user_recent_locations" DROP CONSTRAINT "user_recent_locations_userId_fkey";

-- DropIndex
DROP INDEX "user_recent_locations_userId_zoneId_idx";

-- AlterTable
ALTER TABLE "user_recent_locations" DROP COLUMN "userAt",
ADD COLUMN     "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "about" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "state" TEXT,
    "city" TEXT,
    "zoneId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "streetAddress" TEXT,
    "offersHomeService" BOOLEAN NOT NULL DEFAULT false,
    "serviceRadiusKm" INTEGER,
    "worksRemotely" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "profileImageUrl" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "status" "ProfileStatus" NOT NULL DEFAULT 'draft',
    "rejectionReason" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "avgRating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "locationChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_categories" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ninLast4" VARCHAR(4) NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "failedReason" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMin" INTEGER NOT NULL,
    "priceMax" INTEGER,
    "description" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_images" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "portfolio_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_userId_key" ON "vendor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_slug_key" ON "vendor_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_phone_key" ON "vendor_profiles"("phone");

-- CreateIndex
CREATE INDEX "vendor_profiles_latitude_longitude_idx" ON "vendor_profiles"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "vendor_profiles_zoneId_idx" ON "vendor_profiles"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_profileId_categoryId_key" ON "vendor_categories"("profileId", "categoryId");

-- CreateIndex
CREATE INDEX "social_links_profileId_idx" ON "social_links"("profileId");

-- CreateIndex
CREATE INDEX "verifications_profileId_checkedAt_idx" ON "verifications"("profileId", "checkedAt");

-- CreateIndex
CREATE INDEX "services_profileId_idx" ON "services"("profileId");

-- CreateIndex
CREATE INDEX "portfolio_images_profileId_idx" ON "portfolio_images"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_profileId_dayOfWeek_key" ON "working_hours"("profileId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "user_recent_locations_userId_zoneId_key" ON "user_recent_locations"("userId", "zoneId");

-- AddForeignKey
ALTER TABLE "user_recent_locations" ADD CONSTRAINT "user_recent_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_images" ADD CONSTRAINT "portfolio_images_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
