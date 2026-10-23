import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express from "express";
import request from "supertest";
import { inspect } from "node:util";
import { Writable } from "node:stream";

const mockPrisma = {
  vendorProfile: { findUnique: jest.fn() },
  verification: { count: jest.fn() },
  $transaction: jest.fn(),
};

const mockTx = {
  verification: { create: jest.fn() },
  vendorProfile: { update: jest.fn() },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

// Skip real auth/role checks. The NIN route, validation and service stay real.
jest.unstable_mockModule("../src/middlewares/auth.js", () => ({
  default: (req, _res, next) => {
    req.user = { id: "user-123", userId: "user-123", role: "vendor" };
    next();
  },
}));
jest.unstable_mockModule("../src/middlewares/role.js", () => ({
  default: () => (_req, _res, next) => next(),
}));

const { createHttpLogger } = await import("../src/middlewares/logger.js");
const { default: errorHandler } =
  await import("../src/middlewares/errorHandler.js");
const { default: verificationRoutes } =
  await import("../src/routes/verification.routes.js");

const PASS_NIN = "12345678901";
const FAIL_NIN = "12345670000";
const BODY_MARKER = "SECRET_BODY_MARKER_xyz";

// Same middleware order as src/app.js, with the log output captured.
function buildApp() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });

  const app = express();
  app.use(createHttpLogger(stream));
  app.use(express.json());
  app.use((req, _res, next) => {
    req.body = req.body ?? {};
    next();
  });
  app.use("/verifications", verificationRoutes);
  app.use(errorHandler);

  return { app, lines };
}

describe("logging on POST /verifications/nin", () => {
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    mockPrisma.vendorProfile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockTx));
    mockTx.verification.create.mockImplementation(({ data }) => ({
      id: "verification-1",
      ...data,
      checkedAt: new Date(),
    }));
    mockTx.vendorProfile.update.mockResolvedValue({ id: "profile-1" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const wait = () => new Promise((r) => setTimeout(r, 50));

  const allOutput = (lines) =>
    lines.join("") +
    inspect(consoleErrorSpy.mock.calls, { depth: 6 }) +
    inspect(consoleLogSpy.mock.calls, { depth: 6 });

  it("carries a request ID and never logs the NIN or body (passing NIN)", async () => {
    const { app, lines } = buildApp();

    const res = await request(app)
      .post("/verifications/nin")
      .set("Authorization", "Bearer test-token-abc")
      .send({ nin: PASS_NIN, note: BODY_MARKER });

    await wait();

    const requestId = res.headers["x-request-id"];
    expect(requestId).toBeTruthy();

    const output = allOutput(lines);
    expect(lines.length).toBeGreaterThan(0);
    expect(output).toContain(requestId);
    expect(output).not.toContain(PASS_NIN);
    expect(output).not.toContain(BODY_MARKER);
    expect(output).not.toContain("test-token-abc");
  });

  it("never logs the NIN when verification fails", async () => {
    const { app, lines } = buildApp();

    await request(app)
      .post("/verifications/nin")
      .send({ nin: FAIL_NIN, note: BODY_MARKER });

    await wait();

    const output = allOutput(lines);
    expect(lines.length).toBeGreaterThan(0);
    expect(output).not.toContain(FAIL_NIN);
    expect(output).not.toContain(BODY_MARKER);
  });

  it("never logs the NIN when the JSON body is malformed", async () => {
    const { app, lines } = buildApp();

    const res = await request(app)
      .post("/verifications/nin")
      .set("Content-Type", "application/json")
      .send(`{"nin":"${PASS_NIN}","note":"${BODY_MARKER}"`); // missing }

    await wait();

    expect(res.status).toBe(400);

    const output = allOutput(lines);
    expect(output).toContain(res.headers["x-request-id"]);
    expect(output).not.toContain(PASS_NIN);
    expect(output).not.toContain(BODY_MARKER);
  });

  it("reuses an incoming x-request-id", async () => {
    const { app, lines } = buildApp();

    const res = await request(app)
      .post("/verifications/nin")
      .set("x-request-id", "abc-123")
      .send({ nin: PASS_NIN });

    await wait();

    expect(res.headers["x-request-id"]).toBe("abc-123");
    expect(allOutput(lines)).toContain("abc-123");
  });
});
