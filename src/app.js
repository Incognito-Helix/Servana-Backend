import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
	res.status(200).json({
		message: "Servana API is running successfully",
	});
});

export default app;
