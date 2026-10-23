-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_profileId_createdAt_idx" ON "reviews"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_profileId_rating_idx" ON "reviews"("profileId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_profileId_customerId_key" ON "reviews"("profileId", "customerId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
