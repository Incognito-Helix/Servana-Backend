import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Servana API is running successfully",
  });
});

//Authentication routes
app.use("/auth", authRoutes);

app.use(errorHandler);
export default app;
