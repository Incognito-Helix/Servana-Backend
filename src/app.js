import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import "dotenv/config";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Servana API is running successfully",
  });
});

// Authentication routes
app.use("/auth", authRoutes);

app.use("/vendors", vendorRoutes);

app.use(errorHandler);

export default app;
