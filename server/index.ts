import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
app.set("trust proxy", 1); // Required for secure cookies behind Render's proxy
const httpServer = createServer(app);

// Gzip every response above 1 KB. JSON from this API compresses ~8-10x, and egress
// is billed per byte on Cloud Run/Render while the CPU cost of gzip at this size is
// negligible next to the DB round trip that produced the payload.
app.use(compression({
  threshold: 1024,
  // Never compress the SSE streams. compression() buffers until it has enough bytes
  // to emit a block, so an event stream — whose frames are a few dozen bytes and must
  // arrive the instant they're written — gets held indefinitely and the live queue
  // boards silently stop updating. Verified: with the stream compressed, not a single
  // push arrives.
  filter: (req, res) => {
    const type = String(res.getHeader("Content-Type") || "");
    if (type.includes("text/event-stream")) return false;
    return compression.filter(req, res);
  },
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// Brute-force protection on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skip: () => process.env.NODE_ENV !== "production",
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/partner-signup", authLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Never log response bodies in production — they may contain PII
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Unknown /api paths must be answered here. Both serveStatic and setupVite end in
  // an app.use("*") SPA fallback, so without this a typo'd or removed endpoint came
  // back as index.html with a 200 — every client call site treats that as success
  // and then dies on res.json().
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status} ${message}`, err.stack || "");
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    const localUrl = `http://localhost:${port}`;
    log(`serving on port ${port}`);
    console.log(`\n  Local:   ${localUrl}`);

    if (process.env.NODE_ENV !== "production") {
      import("os").then(({ networkInterfaces }) => {
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]!) {
            if (net.family === "IPv4" && !net.internal) {
              console.log(`  Network: http://${net.address}:${port}`);
            }
          }
        }
        console.log();
      });

      import("child_process").then(({ exec }) => {
        const cmd =
          process.platform === "darwin"
            ? `open ${localUrl}`
            : process.platform === "win32"
              ? `start ${localUrl}`
              : `xdg-open ${localUrl}`;
        exec(cmd);
      });
    }
  });
})();
