import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockGetPendingVendorReviews = jest.fn();
const mockApproveVendorProfile = jest.fn();
const mockRejectVendorProfile = jest.fn();

jest.unstable_mockModule("../src/services/vendor.service.js", () => ({
  getPendingVendorReviews: mockGetPendingVendorReviews,
  approveVendorProfile: mockApproveVendorProfile,
  rejectVendorProfile: mockRejectVendorProfile,
}));

const { default: adminRoutes } = await import("../src/routes/admin.routes.js");
const { default: errorHandler } =
  await import("../src/middlewares/errorHandler.js");
const { signToken } = await import("../src/services/token.service.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);
  app.use(errorHandler);
  return app;
};

describe("Admin vendor review route", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns 401 when no token is provided", async () => {
    const response = await request(buildApp()).get("/admin/vendor-reviews");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockGetPendingVendorReviews).not.toHaveBeenCalled();
  });

  it("returns 403 when a vendor tries to access the review queue", async () => {
    const token = signToken({ id: "vendor-1", role: "vendor" });

    const response = await request(buildApp())
      .get("/admin/vendor-reviews")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mockGetPendingVendorReviews).not.toHaveBeenCalled();
  });

  it("allows an admin to retrieve pending vendor reviews", async () => {
    const profiles = [{ id: "profile-1", businessName: "Test Business" }];
    mockGetPendingVendorReviews.mockResolvedValue(profiles);

    const token = signToken({ id: "admin-1", role: "admin" });

    const response = await request(buildApp())
      .get("/admin/vendor-reviews")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { profiles },
    });
    expect(mockGetPendingVendorReviews).toHaveBeenCalledTimes(1);
  });
});
