import { type Email, type ImapAccount, type InsertEmail, type InsertImapAccount } from "@shared/schema";

export interface IStorage {
  // IMAP Account methods
  getImapAccounts(): Promise<ImapAccount[]>;
  addImapAccount(account: InsertImapAccount): Promise<ImapAccount>;
  removeImapAccount(id: number): Promise<void>;

  // Email methods
  addEmail(email: InsertEmail): Promise<Email>;
  getEmail(id: number): Promise<Email | undefined>;
  getEmails(options: {
    accountId?: string;
    folder?: string;
    category?: string;
    search?: string;
  }): Promise<Email[]>;
  updateEmailCategory(id: number, category: string): Promise<Email>;
}

export class MemStorage implements IStorage {
  private accounts: Map<number, ImapAccount>;
  private emails: Map<number, Email>;
  private currentAccountId: number;
  private currentEmailId: number;

  constructor() {
    this.accounts = new Map();
    this.emails = new Map();
    this.currentAccountId = 1;
    this.currentEmailId = 1;
  }

  async getImapAccounts(): Promise<ImapAccount[]> {
    return Array.from(this.accounts.values());
  }

  async addImapAccount(account: InsertImapAccount): Promise<ImapAccount> {
    const id = this.currentAccountId++;
    const newAccount = { ...account, id };
    this.accounts.set(id, newAccount);
    return newAccount;
  }

  async removeImapAccount(id: number): Promise<void> {
    this.accounts.delete(id);
  }

  async addEmail(email: InsertEmail): Promise<Email> {
    const id = this.currentEmailId++;
    const newEmail = { ...email, id };
    this.emails.set(id, newEmail);
    return newEmail;
  }

  async getEmail(id: number): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmails(options: {
    accountId?: string;
    folder?: string;
    category?: string;
    search?: string;
  }): Promise<Email[]> {
    let emails = Array.from(this.emails.values());

    if (options.accountId) {
      emails = emails.filter(e => e.accountId === options.accountId);
    }

    if (options.folder) {
      emails = emails.filter(e => e.folder === options.folder);
    }

    if (options.category) {
      emails = emails.filter(e => e.category === options.category);
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      emails = emails.filter(e =>
        e.subject.toLowerCase().includes(searchLower) ||
        e.body.toLowerCase().includes(searchLower)
      );
    }

    return emails.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async updateEmailCategory(id: number, category: string): Promise<Email> {
    const email = await this.getEmail(id);
    if (!email) throw new Error("Email not found");
    
    const updatedEmail = { ...email, category };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }
}

export const storage = new MemStorage();
