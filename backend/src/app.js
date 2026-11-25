import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import legacyAuthRoutes from "../routes/authRoutes.js";
import { loadUser } from "./middleware/security.js";
import activityRoutes from "./routes/activity.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";

export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.confirmPassword",
    "req.body.currentPassword",
    "req.body.nextPassword",
  ],
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (request) => request.url === "/api/v1/health" } }));

  app.use("/", (req, res)=>{
    res.send("Server starting");
  })
  app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
  }));
  app.use("/api/auth", legacyAuthRoutes);
  app.get("/api/health", (request, response) => {
    response.json({ success: true, message: "Schevo backend is running." });
  });
  app.get("/api/v1/health", (request, response) => response.json({ ok: true }));
  app.use("/api/v1", loadUser);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/projects", projectRoutes);
  app.use("/api/v1/activity", activityRoutes);
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/v1")) {
      next(new HttpError(404, "Not found."));
      return;
    }
    response.status(404).json({ success: false, message: "Route not found." });
  });
  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const status = error.status || error.statusCode || 500;
    if (status >= 500) request.log?.error?.({ err: error.message });
    const legacy = request.path.startsWith("/api/auth");
    const payload = {
      ...(legacy && { success: false }),
      message: legacy
        ? error.message || "Internal server error."
        : status >= 500 ? "Something went wrong. Try again." : error.message,
      ...(!legacy && error.details && { details: error.details }),
      ...(legacy && process.env.NODE_ENV === "development" && { stack: error.stack }),
    };
    response.status(status).json(payload);
  });
  return app;
}
