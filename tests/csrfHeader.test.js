import { jest, describe, test, expect } from "@jest/globals";
import csrfHeader from "../src/middlewares/csrfHeader.js";

describe("CSRF header middleware", () => {
  const createResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    return res;
  };

  const createRequest = (method, headers = {}) => ({
    method,
    headers,
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  });

  test.each(["GET", "HEAD", "OPTIONS"])(
    "allows safe method %s without a CSRF header",
    (method) => {
      const req = createRequest(method);
      const res = createResponse();
      const next = jest.fn();

      csrfHeader(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  test("rejects a POST request without a CSRF header", () => {
    const req = createRequest("POST");
    const res = createResponse();
    const next = jest.fn();

    csrfHeader(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "CSRF_HEADER_MISSING",
        message: "Required CSRF header is missing or invalid.",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("allows a POST request with a non-empty CSRF header", () => {
    const req = createRequest("POST", {
      "x-csrf-token": "test-token",
    });
    const res = createResponse();
    const next = jest.fn();

    csrfHeader(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("rejects an empty CSRF header", () => {
    const req = createRequest("POST", {
      "x-csrf-token": "   ",
    });
    const res = createResponse();
    const next = jest.fn();

    csrfHeader(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
