import express from "express";
import request from "supertest";
import auth from "../src/middlewares/auth.js";
import errorHandler from "../src/middlewares/errorHandler.js";
import { signToken } from "../src/services/token.service.js";

const buildApp = () => {
  const app = express();

  app.get("/protected", auth, (req, res) => {
    res.status(200).json({ success: true, user: req.user });
  });

  app.use(errorHandler);
  return app;
};

describe("Auth middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "7d";
  });

  it("attaches req.user as { id, role } for a valid token", async () => {
    const token = signToken({ id: "user-1", role: "vendor" });

    const response = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ id: "user-1", role: "vendor" });
  });

  it("returns 401 when there is no Authorization header", async () => {
    const response = await request(buildApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a tampered token", async () => {
    const token = signToken({ id: "user-1", role: "vendor" });

    const response = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token.slice(0, -2)}xx`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  it("returns 401 with TOKEN_EXPIRED for an expired token", async () => {
    process.env.JWT_EXPIRES_IN = "-1s";
    const token = signToken({ id: "user-1", role: "vendor" });

    const response = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("TOKEN_EXPIRED");
  });
});
