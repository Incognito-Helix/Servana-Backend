import prisma from "../src/config/prisma.js";

describe("Seed data integrity", () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("contains the expected zones, categories, and admin user", async () => {
        const [zones, categories, admins] = await Promise.all([
            prisma.zone.count(),
            prisma.category.count(),
            prisma.user.count({
                where: { role: "admin" },
            }),
        ]);

        expect(zones).toBe(8);
        expect(categories).toBe(25);
        expect(admins).toBeGreaterThanOrEqual(1);
    });
});