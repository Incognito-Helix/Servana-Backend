import { afterAll, describe, it, expect } from "@jest/globals";
import prisma from "../src/config/prisma.js";

describe("Database connectivity", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to PostgreSQL and executes a query", async () => {
    const result = await prisma.$queryRaw`SELECT 1`;

    expect(result).toBeDefined();
  });
});
