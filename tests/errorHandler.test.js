import express from "express";
import request from "supertest";
import errorHandler from "../src/middlewares/errorHandler.js";

describe("Standard error responses", () => {
  it("returns the standard format for an internal server error", async () => {
    const app = express();

    app.get("/test-error", (req, res, next) => {
      next(new Error("Something went wrong"));
    });

    app.use(errorHandler);

    const response = await request(app).get("/test-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
      fieldErrors: {},
    });
  });

  it("preserves a custom status and error code", async () => {
    const app = express();

    app.get("/test-error", (req, res, next) => {
      const error = new Error("Resource not found");
      error.status = 404;
      error.code = "NOT_FOUND";
      next(error);
    });

    app.use(errorHandler);

    const response = await request(app).get("/test-error");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "Resource not found",
      fieldErrors: {},
    });
  });
});
