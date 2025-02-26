// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  accounts;
  emails;
  currentAccountId;
  currentEmailId;
  constructor() {
    this.accounts = /* @__PURE__ */ new Map();
    this.emails = /* @__PURE__ */ new Map();
    this.currentAccountId = 1;
    this.currentEmailId = 1;
  }
  async getImapAccounts() {
    return Array.from(this.accounts.values());
  }
  async addImapAccount(account) {
    const id = this.currentAccountId++;
    const newAccount = { ...account, id };
    this.accounts.set(id, newAccount);
    return newAccount;
  }
  async removeImapAccount(id) {
    this.accounts.delete(id);
  }
  async addEmail(email) {
    const id = this.currentEmailId++;
    const newEmail = { ...email, id };
    this.emails.set(id, newEmail);
    return newEmail;
  }
  async getEmail(id) {
    return this.emails.get(id);
  }
  async getEmails(options) {
    let emails2 = Array.from(this.emails.values());
    if (options.accountId) {
      emails2 = emails2.filter((e) => e.accountId === options.accountId);
    }
    if (options.folder) {
      emails2 = emails2.filter((e) => e.folder === options.folder);
    }
    if (options.category) {
      emails2 = emails2.filter((e) => e.category === options.category);
    }
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      emails2 = emails2.filter(
        (e) => e.subject.toLowerCase().includes(searchLower) || e.body.toLowerCase().includes(searchLower)
      );
    }
    return emails2.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  async updateEmailCategory(id, category) {
    const email = await this.getEmail(id);
    if (!email) throw new Error("Email not found");
    const updatedEmail = { ...email, category };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }
};
var storage = new MemStorage();

// server/lib/imap.ts
import { ImapFlow } from "imapflow";
var ImapClient = class {
  client;
  account;
  constructor(account) {
    this.account = account;
    this.client = new ImapFlow({
      host: account.host,
      port: parseInt(account.port),
      secure: true,
      auth: {
        user: account.username,
        pass: account.password
      },
      logger: false
    });
  }
  async connect() {
    await this.client.connect();
  }
  async disconnect() {
    await this.client.logout();
  }
  async syncEmails() {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    await this.client.mailboxOpen("INBOX");
    const messages = await this.client.fetch("1:*", {
      uid: true,
      envelope: true,
      bodyStructure: true,
      bodyParts: ["text"]
    });
    for await (const message of messages) {
      if (new Date(message.envelope.date) < cutoffDate) continue;
      const email = {
        accountId: this.account.id.toString(),
        messageId: message.uid.toString(),
        from: message.envelope.from[0].address,
        to: message.envelope.to[0].address,
        subject: message.envelope.subject,
        body: message.bodyParts.get("text")?.toString() || "",
        date: new Date(message.envelope.date),
        folder: "INBOX",
        category: null,
        metadata: {}
      };
      await storage.addEmail(email);
    }
  }
  async watchInbox() {
    await this.client.mailboxOpen("INBOX");
    this.client.on("exists", async (data) => {
      const messages = await this.client.fetch(data.seq, {
        uid: true,
        envelope: true,
        bodyStructure: true,
        bodyParts: ["text"]
      });
      for await (const message of messages) {
        const email = {
          accountId: this.account.id.toString(),
          messageId: message.uid.toString(),
          from: message.envelope.from[0].address,
          to: message.envelope.to[0].address,
          subject: message.envelope.subject,
          body: message.bodyParts.get("text")?.toString() || "",
          date: new Date(message.envelope.date),
          folder: "INBOX",
          category: null,
          metadata: {}
        };
        await storage.addEmail(email);
      }
    });
  }
};
var imapClients = /* @__PURE__ */ new Map();
async function setupImapClients() {
  if (process.env.NODE_ENV === "development") {
    console.log("Development mode: IMAP client setup skipped");
    return;
  }
  const accounts = await storage.getImapAccounts();
  for (const account of accounts) {
    const client = new ImapClient(account);
    await client.connect();
    await client.syncEmails();
    await client.watchInbox();
    imapClients.set(account.id, client);
  }
}
async function addImapClient(account) {
  if (process.env.NODE_ENV === "development") {
    console.log("Development mode: IMAP client creation skipped");
    return;
  }
  const client = new ImapClient(account);
  await client.connect();
  await client.syncEmails();
  await client.watchInbox();
  imapClients.set(account.id, client);
}
async function removeImapClient(accountId) {
  if (process.env.NODE_ENV === "development") {
    console.log("Development mode: IMAP client removal skipped");
    return;
  }
  const client = imapClients.get(accountId);
  if (client) {
    await client.disconnect();
    imapClients.delete(accountId);
  }
}

// server/lib/openai.ts
import OpenAI from "openai";
var openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function categorizeEmail(subject, body) {
  if (!openai) {
    console.log("OpenAI not configured, using mock categorization");
    return "INTERESTED";
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Categorize the email into one of these categories: INTERESTED, MEETING_BOOKED, NOT_INTERESTED, SPAM, OUT_OF_OFFICE. 
            Respond with just the category name. Base your decision on both subject and body content.`
        },
        {
          role: "user",
          content: `Subject: ${subject}

Body: ${body}`
        }
      ],
      temperature: 0,
      max_tokens: 10
    });
    const category = response.choices[0].message.content?.trim();
    return category;
  } catch (error) {
    console.error("Error categorizing email:", error);
    return "INTERESTED";
  }
}

// server/lib/slack.ts
import { WebClient } from "@slack/web-api";
var slack = process.env.SLACK_BOT_TOKEN ? new WebClient(process.env.SLACK_BOT_TOKEN) : null;
async function sendInterestedEmailNotification(email) {
  if (!slack || !process.env.SLACK_CHANNEL_ID) {
    console.log("Slack not configured, skipping notification", {
      from: email.from,
      subject: email.subject
    });
    return;
  }
  try {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*New Interested Lead Email*"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*From:*
${email.from}`
            },
            {
              type: "mrkdwn",
              text: `*Subject:*
${email.subject}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Body:*
${email.body.substring(0, 500)}${email.body.length > 500 ? "..." : ""}`
          }
        }
      ]
    });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}

// server/lib/webhook.ts
var WEBHOOK_URL = process.env.WEBHOOK_URL;
async function sendWebhookNotification(email) {
  if (!WEBHOOK_URL) {
    console.log("Webhook not configured, skipping notification", {
      from: email.from,
      subject: email.subject
    });
    return;
  }
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "INTERESTED_EMAIL",
        email: {
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date
        }
      })
    });
  } catch (error) {
    console.error("Error sending webhook notification:", error);
  }
}

// shared/schema.ts
import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var emailCategory = z.enum([
  "INTERESTED",
  "MEETING_BOOKED",
  "NOT_INTERESTED",
  "SPAM",
  "OUT_OF_OFFICE"
]);
var imapAccounts = pgTable("imap_accounts", {
  id: serial("id").primaryKey(),
  host: text("host").notNull(),
  port: text("port").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull()
});
var emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").notNull(),
  messageId: text("message_id").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  date: timestamp("date").notNull(),
  folder: text("folder").notNull(),
  category: text("category"),
  metadata: jsonb("metadata")
});
var insertImapAccountSchema = createInsertSchema(imapAccounts);
var insertEmailSchema = createInsertSchema(emails);

// server/routes.ts
var log = (message) => console.log(message);
async function addTestData() {
  const startTime = Date.now();
  log("Adding test data...");
  try {
    const account = await storage.addImapAccount({
      host: "imap.example.com",
      port: "993",
      username: "test@example.com",
      password: "password123"
    });
    log("Test IMAP account created");
    const emailData = [
      {
        accountId: account.id.toString(),
        messageId: "1",
        from: "client@company.com",
        to: "test@example.com",
        subject: "Interested in your services",
        body: "Hi, I saw your website and I'm interested in learning more about your services. Can we schedule a call?",
        date: /* @__PURE__ */ new Date("2024-02-24T10:00:00Z"),
        folder: "INBOX",
        category: "INTERESTED",
        metadata: {}
      },
      {
        accountId: account.id.toString(),
        messageId: "2",
        from: "meeting@company.com",
        to: "test@example.com",
        subject: "Meeting Confirmed",
        body: "Thank you for your time. I've booked a meeting slot for next Tuesday at 2 PM.",
        date: /* @__PURE__ */ new Date("2024-02-24T11:00:00Z"),
        folder: "INBOX",
        category: "MEETING_BOOKED",
        metadata: {}
      },
      {
        accountId: account.id.toString(),
        messageId: "3",
        from: "noreply@spam.com",
        to: "test@example.com",
        subject: "You've won a prize!",
        body: "Congratulations! You've been selected to receive a special offer...",
        date: /* @__PURE__ */ new Date("2024-02-24T12:00:00Z"),
        folder: "INBOX",
        category: "SPAM",
        metadata: {}
      },
      {
        accountId: account.id.toString(),
        messageId: "4",
        from: "lead@potential.com",
        to: "test@example.com",
        subject: "Product inquiry",
        body: "Hello, We're looking for a solution like yours. Could you send more information?",
        date: /* @__PURE__ */ new Date("2024-02-24T13:00:00Z"),
        folder: "INBOX",
        category: null,
        metadata: {}
      }
    ];
    for (const email of emailData) {
      await storage.addEmail(email);
    }
    log("Test emails created");
    log(`Test data added successfully in ${Date.now() - startTime}ms`);
  } catch (error) {
    log("Error adding test data: " + error);
    throw error;
  }
}
async function registerRoutes(app2) {
  const startTime = Date.now();
  try {
    if (process.env.NODE_ENV !== "production") {
      log("Development mode detected, adding test data...");
      await addTestData();
    }
    if (process.env.NODE_ENV !== "production") {
      log("Development mode: Skipping IMAP setup");
    } else {
      log("Setting up IMAP clients...");
      await setupImapClients();
      log("IMAP clients setup complete");
    }
    app2.get("/api/accounts", async (_req, res) => {
      const accounts = await storage.getImapAccounts();
      res.json(accounts);
    });
    app2.post("/api/accounts", async (req, res) => {
      const parsed = insertImapAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error });
      }
      const account = await storage.addImapAccount(parsed.data);
      if (process.env.NODE_ENV === "production") {
        await addImapClient(account);
      }
      res.json(account);
    });
    app2.delete("/api/accounts/:id", async (req, res) => {
      const id = parseInt(req.params.id);
      if (process.env.NODE_ENV === "production") {
        await removeImapClient(id);
      }
      await storage.removeImapAccount(id);
      res.sendStatus(200);
    });
    app2.get("/api/emails", async (req, res) => {
      const { accountId, folder, category, search } = req.query;
      const emails2 = await storage.getEmails({
        accountId,
        folder,
        category,
        search
      });
      res.json(emails2);
    });
    app2.post("/api/emails/:id/categorize", async (req, res) => {
      const id = parseInt(req.params.id);
      const email = await storage.getEmail(id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      const category = await categorizeEmail(email.subject, email.body);
      const updatedEmail = await storage.updateEmailCategory(id, category);
      if (category === "INTERESTED") {
        await sendInterestedEmailNotification(updatedEmail);
        await sendWebhookNotification(updatedEmail);
      }
      res.json(updatedEmail);
    });
    log(`Routes registration completed in ${Date.now() - startTime}ms`);
    return createServer(app2);
  } catch (error) {
    log(`Error during route registration: ${error}`);
    throw error;
  }
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log2(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log2(logLine);
    }
  });
  next();
});
(async () => {
  try {
    log2(`Starting server initialization in ${process.env.NODE_ENV || "development"} mode...`);
    const startTime = Date.now();
    log2("Registering routes...");
    const routesStartTime = Date.now();
    const server = await registerRoutes(app);
    log2(`Routes registered successfully in ${Date.now() - routesStartTime}ms`);
    app.use((err, _req, res, _next) => {
      console.error("Error in request:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
    log2("Setting up server middleware...");
    const middlewareStartTime = Date.now();
    if (app.get("env") === "development") {
      app.use(express2.static("dist/public"));
      app.get("*", (_req, res) => {
        res.send("Server is running in development mode");
      });
      log2("Using simple static middleware for testing");
    } else {
      serveStatic(app);
      log2("Static serving setup complete");
    }
    log2(`Middleware setup completed in ${Date.now() - middlewareStartTime}ms`);
    const port = 5e3;
    log2(`Attempting to listen on port ${port}...`);
    server.listen({
      port,
      host: "0.0.0.0"
    }, () => {
      const totalTime = Date.now() - startTime;
      log2(`Server is now listening on port ${port} (startup took ${totalTime}ms)`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
