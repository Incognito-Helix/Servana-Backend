import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

const checks = [
  ["zones", () => prisma.zone.count(), 8],
  [
    "parent categories",
    () => prisma.category.count({ where: { parentId: null } }),
    5,
  ],
  ["admin users", () => prisma.user.count({ where: { role: "admin" } }), 1],
  [
    "non-admin users",
    () => prisma.user.count({ where: { role: { not: "admin" } } }),
    0,
  ],
  ["vendor profiles", () => prisma.vendorProfile.count(), 0],
  ["boosts", () => prisma.boost.count(), 0],
  ["reviews", () => prisma.review.count(), 0],
];

const main = async () => {
  let failed = false;

  for (const [label, count, expected] of checks) {
    const actual = await count();
    const ok = actual === expected;
    if (!ok) failed = true;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${label}: ${actual} (expected ${expected})`,
    );
  }

  const subCategories = await prisma.category.count({
    where: { parentId: { not: null } },
  });
  console.log(`INFO  sub-categories: ${subCategories}`);

  if (failed) process.exitCode = 1;
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
