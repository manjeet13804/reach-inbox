import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { setupImapClients, addImapClient, removeImapClient } from "./lib/imap";
import { categorizeEmail } from "./lib/openai";
import { sendInterestedEmailNotification } from "./lib/slack";
import { sendWebhookNotification } from "./lib/webhook";
import { insertImapAccountSchema } from "@shared/schema";

// Simple log function for demonstration
const log = (message: string) => console.log(message);

// Add test data for development
async function addTestData() {
  const startTime = Date.now();
  log("Adding test data...");

  try {
    // Add a test IMAP account
    const account = await storage.addImapAccount({
      host: "imap.example.com",
      port: "993",
      username: "test@example.com",
      password: "password123"
    });
    log("Test IMAP account created");

    // Add some test emails
    const emailData = [
      {
        accountId: account.id.toString(),
        messageId: "1",
        from: "client@company.com",
        to: "test@example.com",
        subject: "Interested in your services",
        body: "Hi, I saw your website and I'm interested in learning more about your services. Can we schedule a call?",
        date: new Date("2024-02-24T10:00:00Z"),
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
        date: new Date("2024-02-24T11:00:00Z"),
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
        date: new Date("2024-02-24T12:00:00Z"),
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
        date: new Date("2024-02-24T13:00:00Z"),
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

export async function registerRoutes(app: Express) {
  const startTime = Date.now();

  try {
    // Initialize IMAP clients and sync emails
    await setupImapClients();

    // Email routes
    app.get('/api/emails', async (req, res) => {
      const { search, category, folder, accountId } = req.query;
      try {
        if (category && typeof category !== 'string') {
          return res.status(400).json({ error: 'Invalid category parameter' });
        }
        if (folder && typeof folder !== 'string') {
          return res.status(400).json({ error: 'Invalid folder parameter' });
        }
        if (search && typeof search !== 'string') {
          return res.status(400).json({ error: 'Invalid search parameter' });
        }
        if (accountId && typeof accountId !== 'string') {
          return res.status(400).json({ error: 'Invalid accountId parameter' });
        }

        const emails = await storage.getEmails({
          accountId: accountId as string,
          search: search as string,
          category: category as string,
          folder: folder as string
        });

        // Set aggressive cache control headers to prevent 304 Not Modified responses
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '-1');
        res.setHeader('Surrogate-Control', 'no-store');
        
        // Generate a truly unique ETag with timestamp and random value
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        res.setHeader('ETag', `W/"${uniqueId}"`);
        
        // Disable If-Modified-Since behavior
        res.setHeader('Last-Modified', (new Date()).toUTCString());

        res.json(emails);
      } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
      }
    });

    // Add IMAP account route
    app.post('/api/accounts', async (req, res) => {
      try {
        const accountData = insertImapAccountSchema.parse(req.body);
        const account = await storage.addImapAccount(accountData);
        await addImapClient(account);
        res.json(account);
      } catch (error) {
        res.status(400).json({ error: 'Invalid account data' });
      }
    });

    // Categorize email route
    app.post('/api/emails/:id/categorize', async (req, res) => {
      const emailId = parseInt(req.params.id);
      try {
        const email = await storage.getEmail(emailId);
        if (!email) {
          return res.status(404).json({ error: 'Email not found' });
        }
        const category = await categorizeEmail(email.subject, email.body);
        const updatedEmail = await storage.updateEmailCategory(emailId, category);
        
        if (category === "INTERESTED") {
          await sendInterestedEmailNotification(updatedEmail);
          await sendWebhookNotification(updatedEmail);
        }
        
        res.json(updatedEmail);
      } catch (error) {
        res.status(500).json({ error: 'Failed to categorize email' });
      }
    });

    // Add test data in development
    if (process.env.NODE_ENV !== "production") {
      log("Development mode detected, adding test data...");
      await addTestData();
    }

    // Skip IMAP setup in development
    if (process.env.NODE_ENV !== "production") {
      log("Development mode: Skipping IMAP setup");
    } else {
      log("Setting up IMAP clients...");
      await setupImapClients();
      log("IMAP clients setup complete");
    }

    // IMAP Account Routes
    app.get("/api/accounts", async (_req, res) => {
      const accounts = await storage.getImapAccounts();
      res.json(accounts);
    });

    // This route is now handled above with better error handling
    // app.get("/api/emails", async (req, res) => {
    //   const { accountId, folder, category, search } = req.query;
    //   const emails = await storage.getEmails({
    //     accountId: accountId as string,
    //     folder: folder as string,
    //     category: category as string,
    //     search: search as string
    //   });
    //   res.json(emails);
    // });

    log(`Routes registration completed in ${Date.now() - startTime}ms`);
    return createServer(app);
  } catch (error) {
    log(`Error during route registration: ${error}`);
    throw error;
  }
}