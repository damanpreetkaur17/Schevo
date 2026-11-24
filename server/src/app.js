import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import { loadUser } from "./middleware/security.js";
import activityRoutes from "./routes/activity.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";

export const logger = pino({ level: process.env.NODE_ENV === "test" ? "silent" : "info", redact: ["req.headers.cookie", "req.body.password", "req.body.currentPassword", "req.body.nextPassword"] });

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (request) => request.url === "/api/v1/health" } }));
  app.get("/api/v1/health", (request, response) => response.json({ ok: true }));
  app.use("/api/v1", loadUser);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/projects", projectRoutes);
  app.use("/api/v1/activity", activityRoutes);
  app.use((request, response, next) => next(new HttpError(404, "Not found.")));
  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const status = error.status || 500;
    if (status >= 500) request.log?.error?.({ err: error.message });
    response.status(status).json({
      message: status >= 500 ? "Something went wrong. Try again." : error.message,
      details: error.details || undefined,
    });
  });
  return app;
}
