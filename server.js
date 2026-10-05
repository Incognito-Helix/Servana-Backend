import app from "./src/app.js";
import "dotenv/config.js";

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
	console.log(`Servana API is running on port ${PORT}`);
});
