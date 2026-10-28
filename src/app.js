import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import verificationRoutes from "./routes/verification.routes.js";
import "dotenv/config";
import adminRoutes from "./routes/admin.routes.js";
import searchRoutes from "./routes/search.routes.js";
import locationRoutes from "./routes/location.routes.js";
import { httpLogger } from "./middlewares/logger.js";
import uploadRoutes from "./routes/uploads.js";
import reviewRoutes from "./routes/review.routes.js";
import paystackWebhookRoutes from "./routes/paystack-webhook.routes.js";

const app = express();
app.set("trust proxy", 1);
app.use(httpLogger);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

// Paystack needs the original raw request body for signature verification.
app.use(
  "/webhooks/paystack",
  express.raw({ type: "application/json" }),
  paystackWebhookRoutes,
);

app.use(express.json());

app.use("/api/uploads", uploadRoutes);
app.use((req, _res, next) => {
  req.body = req.body ?? {};
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Servana API is running successfully",
  });
});

// Authentication routes
app.use("/auth", authRoutes);

app.use("/vendors", vendorRoutes);
app.use("/verifications", verificationRoutes);

app.use("/admin", adminRoutes);

app.use("/search", searchRoutes);
app.use("/locations", locationRoutes);
app.use("/reviews", reviewRoutes);

app.use(errorHandler);

export default app;
