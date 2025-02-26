import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const emailCategory = z.enum([
  "INTERESTED",
  "MEETING_BOOKED", 
  "NOT_INTERESTED",
  "SPAM",
  "OUT_OF_OFFICE"
]);

export type EmailCategory = z.infer<typeof emailCategory>;

export const imapAccounts = pgTable("imap_accounts", {
  id: serial("id").primaryKey(),
  host: text("host").notNull(),
  port: text("port").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull()
});

export const emails = pgTable("emails", {
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

export const insertImapAccountSchema = createInsertSchema(imapAccounts);
export const insertEmailSchema = createInsertSchema(emails);

export type ImapAccount = typeof imapAccounts.$inferSelect;
export type InsertImapAccount = z.infer<typeof insertImapAccountSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
