import "dotenv/config";
import app from "./src/app.js";
import { startBoostScheduler } from "./src/services/boost-scheduler.service.js";
import {
  startEmailQueue,
  stopEmailQueue,
} from "./src/services/email-queue.service.js";

const PORT = process.env.PORT || 8080;

let boostScheduler;

const server = app.listen(PORT, () => {
  console.log(`Servana API is running on port ${PORT}`);

  boostScheduler = startBoostScheduler();

  startEmailQueue().catch((error) => {
    console.error("[email-queue] Failed to start worker:", error);
  });
});

let isShuttingDown = false;

const shutdown = (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`[server] ${signal} received. Shutting down...`);

  server.close(async (error) => {
    if (error) {
      console.error("[server] Error closing HTTP server:", error);
      process.exitCode = 1;
    }

    boostScheduler?.stop();

    try {
      await stopEmailQueue();
    } catch (stopError) {
      console.error("[email-queue] Error stopping worker:", stopError);
      process.exitCode = 1;
    }

    if (!error) {
      console.log("[server] HTTP server closed.");
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
