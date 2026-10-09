-- DropForeignKey
ALTER TABLE "user_recent_locations" DROP CONSTRAINT "user_recent_locations_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_recent_locations" DROP CONSTRAINT "user_recent_locations_zoneId_fkey";

-- AddForeignKey
ALTER TABLE "user_recent_locations" ADD CONSTRAINT "user_recent_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recent_locations" ADD CONSTRAINT "user_recent_locations_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
