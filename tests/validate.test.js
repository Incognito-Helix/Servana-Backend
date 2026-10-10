import express from "express";
import request from "supertest";
import Joi from "joi";
import validate from "../src/middlewares/validate.js";
import errorHandler from "../src/middlewares/errorHandler.js";

describe("Validation middleware", () => {
	const schema = Joi.object({
		name: Joi.string().required(),
		email: Joi.string().email().required(),
	});

	const createApp = () => {
		const app = express();

		app.use(express.json());

		app.post("/test-validation", validate(schema), (req, res) => {
			res.status(200).json({
				success: true,
				data: req.body,
			});
		});

		app.use(errorHandler);

		return app;
	};

	it("returns 400 for invalid input", async () => {
		const response = await request(createApp()).post("/test-validation").send({
			name: "",
			email: "not-an-email",
		});

		expect(response.status).toBe(400);
		expect(response.body.success).toBe(false);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect(response.body.error.message).toBe("Validation Error");
		expect(response.body.error.fieldErrors).toHaveProperty("name");
		expect(response.body.error.fieldErrors).toHaveProperty("email");
	});

	it("allows valid input to continue", async () => {
		const response = await request(createApp()).post("/test-validation").send({
			name: "Test User",
			email: "test@example.com",
		});

		expect(response.status).toBe(200);
		expect(response.body.success).toBe(true);
		expect(response.body.data.name).toBe("Test User");
	});
});
