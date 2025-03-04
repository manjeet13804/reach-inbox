import { ImapFlow } from 'imapflow';
import { type ImapAccount, type InsertEmail, type EmailCategory } from '@shared/schema';
import { storage } from '../storage';

export class ImapClient {
  private client: ImapFlow;
  private account: ImapAccount;

  constructor(account: ImapAccount) {
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
    try {
      await this.client.connect();
    } catch (error) {
      console.error(`Failed to connect to IMAP server for account ${this.account.id}:`, error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.logout();
    } catch (error) {
      console.error(`Failed to disconnect from IMAP server for account ${this.account.id}:`, error);
      throw error;
    }
  }

  async syncEmails() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      await this.client.mailboxOpen('INBOX');

      const messages = await this.client.fetch('1:*', {
        uid: true,
        envelope: true,
        bodyStructure: true,
        bodyParts: ['text']
      });

      for await (const message of messages) {
        if (new Date(message.envelope.date) < cutoffDate) continue;

        const email: InsertEmail = {
          accountId: this.account.id.toString(),
          messageId: message.uid.toString(),
          from: message.envelope.from?.[0]?.address || '',
          to: message.envelope.to?.[0]?.address || '',
          subject: message.envelope.subject || '',
          body: message.bodyParts.get('text')?.toString() || '',
          date: new Date(message.envelope.date),
          folder: 'INBOX',
          category: null,
          metadata: {}
        };

        await storage.addEmail(email);
      }
    } catch (error) {
      console.error(`Failed to sync emails for account ${this.account.id}:`, error);
      throw error;
    }
  }

  async watchInbox() {
    try {
      await this.client.mailboxOpen('INBOX');

      this.client.on('exists', async (data: any) => {
        try {
          const messages = await this.client.fetch(data.seq, {
            uid: true,
            envelope: true,
            bodyStructure: true,
            bodyParts: ['text']
          });

          for await (const message of messages) {
            const email: InsertEmail = {
              accountId: this.account.id.toString(),
              messageId: message.uid.toString(),
              from: message.envelope.from?.[0]?.address || '',
              to: message.envelope.to?.[0]?.address || '',
              subject: message.envelope.subject || '',
              body: message.bodyParts.get('text')?.toString() || '',
              date: new Date(message.envelope.date),
              folder: 'INBOX',
              category: null,
              metadata: {}
            };

            await storage.addEmail(email);
          }
        } catch (error) {
          console.error(`Failed to process new email for account ${this.account.id}:`, error);
        }
      });
    } catch (error) {
      console.error(`Failed to watch inbox for account ${this.account.id}:`, error);
      throw error;
    }
  }
}

const imapClients = new Map<number, ImapClient>();

export async function setupImapClients() {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client setup skipped');
    return;
  }

  try {
    const accounts = await storage.getImapAccounts();
    for (const account of accounts) {
      const client = new ImapClient(account);
      await client.connect();
      await client.syncEmails();
      await client.watchInbox();
      imapClients.set(account.id, client);
    }
  } catch (error) {
    console.error('Failed to setup IMAP clients:', error);
    throw error;
  }
}

export async function addImapClient(account: ImapAccount) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client creation skipped');
    return;
  }

  try {
    const client = new ImapClient(account);
    await client.connect();
    await client.syncEmails();
    await client.watchInbox();
    imapClients.set(account.id, client);
  } catch (error) {
    console.error(`Failed to add IMAP client for account ${account.id}:`, error);
    throw error;
  }
}

export async function removeImapClient(accountId: number) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client removal skipped');
    return;
  }

  try {
    const client = imapClients.get(accountId);
    if (client) {
      await client.disconnect();
      imapClients.delete(accountId);
    }
  } catch (error) {
    console.error(`Failed to remove IMAP client for account ${accountId}:`, error);
    throw error;
  }
}