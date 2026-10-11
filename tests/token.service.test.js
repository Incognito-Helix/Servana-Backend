import jwt from "jsonwebtoken";
import { signToken, verifyToken } from "../src/services/token.service.js";

describe("Token service", () => {
  const user = { id: "user-1", role: "vendor", passwordHash: "secret" };

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "7d";
  });

  it("signs a token that holds only the user id and role", () => {
    const decoded = verifyToken(signToken(user));

    expect(decoded.userId).toBe("user-1");
    expect(decoded.role).toBe("vendor");
    expect(decoded.passwordHash).toBeUndefined();
  });

  it("rejects a tampered token", () => {
    const token = signToken(user);
    const tampered = `${token.slice(0, -2)}xx`;

    expect(() => verifyToken(tampered)).toThrow(jwt.JsonWebTokenError);
  });

  it("rejects an expired token", () => {
    process.env.JWT_EXPIRES_IN = "-1s";
    const token = signToken(user);

    expect(() => verifyToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;

    expect(() => signToken(user)).toThrow("JWT_SECRET is not configured.");
  });
});
