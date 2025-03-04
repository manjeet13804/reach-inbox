import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
 
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


// Enhanced cache control middleware for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    // Set aggressive headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '-1');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Generate a truly unique ETag for each request using timestamp + random value
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    res.setHeader('ETag', `W/"${uniqueId}"`);
    
    // Disable If-Modified-Since behavior
    res.setHeader('Last-Modified', (new Date()).toUTCString());
    
    // Add timestamp to query params for GET requests to force fresh responses
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      url.searchParams.set('_t', uniqueId);
      req.url = url.pathname + url.search;
    }
  }
  next();
});

// Request logging middleware
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
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log(`Starting server initialization in ${process.env.NODE_ENV || 'development'} mode...`);
    const startTime = Date.now();

    log("Registering routes...");
    const routesStartTime = Date.now();
    const server = await registerRoutes(app);
    log(`Routes registered successfully in ${Date.now() - routesStartTime}ms`);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Error in request:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // For development, use a simple static middleware first to verify server works
    log("Setting up server middleware...");
    const middlewareStartTime = Date.now();

    if (app.get("env") === "development") {
      // Temporarily use simple static serving to test server startup
      app.use(express.static("dist/public"));
      app.get("*", (_req, res) => {
        res.send("Server is running in development mode");
      });
      log("Using simple static middleware for testing");
    } else {
      serveStatic(app);
      log("Static serving setup complete");
    }
    log(`Middleware setup completed in ${Date.now() - middlewareStartTime}ms`);

    // Simplified server options
    const port = 5000;
    log(`Attempting to listen on port ${port}...`);
    server.listen({
      port,
      host: "0.0.0.0"
    }, () => {
      const totalTime = Date.now() - startTime;
      log(`Server is now listening on port ${port} (startup took ${totalTime}ms)`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();