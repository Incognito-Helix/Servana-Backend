import express from "express";
import request from "supertest";
import errorHandler from "../src/middlewares/errorHandler.js";

const buildApp = (error) => {
  const app = express();

  app.get("/test-error", (req, res, next) => {
    next(error);
  });

  app.use(errorHandler);
  return app;
};

describe("Standard error responses", () => {
  it("hides the internal message on a server error", async () => {
    const response = await request(
      buildApp(new Error("JWT_SECRET is not configured.")),
    ).get("/test-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal Server Error",
        fieldErrors: {},
      },
    });
  });

  it("keeps the status, code and message of a client error", async () => {
    const error = new Error("Resource not found");
    error.status = 404;
    error.code = "NOT_FOUND";

    const response = await request(buildApp(error)).get("/test-error");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        fieldErrors: {},
      },
    });
  });

  it("returns field level detail on a validation error", async () => {
    const error = new Error("Validation Error");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    error.fieldErrors = { email: "Email is required" };

    const response = await request(buildApp(error)).get("/test-error");

    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors).toEqual({
      email: "Email is required",
    });
  });
});
