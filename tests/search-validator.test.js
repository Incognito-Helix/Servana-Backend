import { describe, expect, it } from "@jest/globals";
import searchQuerySchema from "../src/validators/search.validator.js";

describe("Search query validation", () => {
  it("requires latitude and longitude", () => {
  const { error } = searchQuerySchema.validate(
    {},
    { abortEarly: false },
  );

  expect(error).toBeDefined();

  const fields = error.details.map((detail) => detail.path[0]);

  expect(fields).toContain("latitude");
  expect(fields).toContain("longitude");
});
  });

  it("rejects coordinates outside valid ranges", () => {
    const { error } = searchQuerySchema.validate({
      latitude: 100,
      longitude: -200,
    });

    expect(error).toBeDefined();
  });

  it("accepts valid coordinates and applies pagination defaults", () => {
    const { error, value } = searchQuerySchema.validate({
      latitude: 6.5244,
      longitude: 3.3792,
    });

    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(10);
  });

  it("accepts category and service filters", () => {
    const { error, value } = searchQuerySchema.validate({
      latitude: 6.5244,
      longitude: 3.3792,
      categoryId: "category-1",
      serviceId: "service-1",
    });

    expect(error).toBeUndefined();
    expect(value.categoryId).toBe("category-1");
    expect(value.serviceId).toBe("service-1");
  });

  it("rejects a limit greater than 50", () => {
    const { error } = searchQuerySchema.validate({
      latitude: 6.5244,
      longitude: 3.3792,
      limit: 51,
    });

    expect(error).toBeDefined();
  });

  it("rejects page numbers below 1", () => {
    const { error } = searchQuerySchema.validate({
      latitude: 6.5244,
      longitude: 3.3792,
      page: 0,
    });

    expect(error).toBeDefined();
  });
