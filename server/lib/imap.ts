import { ImapFlow } from 'imapflow';
import { type ImapAccount, type InsertEmail } from '@shared/schema';
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
    await this.client.connect();
  }

  async disconnect() {
    await this.client.logout();
  }

  async syncEmails() {
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
        from: message.envelope.from[0].address,
        to: message.envelope.to[0].address,
        subject: message.envelope.subject,
        body: message.bodyParts.get('text')?.toString() || '',
        date: new Date(message.envelope.date),
        folder: 'INBOX',
        category: null,
        metadata: {}
      };

      await storage.addEmail(email);
    }
  }

  async watchInbox() {
    await this.client.mailboxOpen('INBOX');

    this.client.on('exists', async (data: any) => {
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
          from: message.envelope.from[0].address,
          to: message.envelope.to[0].address,
          subject: message.envelope.subject,
          body: message.bodyParts.get('text')?.toString() || '',
          date: new Date(message.envelope.date),
          folder: 'INBOX',
          category: null,
          metadata: {}
        };

        await storage.addEmail(email);
      }
    });
  }
}

const imapClients = new Map<number, ImapClient>();

export async function setupImapClients() {
  // In development mode, we skip all IMAP operations
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client setup skipped');
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

export async function addImapClient(account: ImapAccount) {
  // In development mode, we skip all IMAP operations
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client creation skipped');
    return;
  }

  const client = new ImapClient(account);
  await client.connect();
  await client.syncEmails();
  await client.watchInbox();
  imapClients.set(account.id, client);
}

export async function removeImapClient(accountId: number) {
  // In development mode, we skip all IMAP operations
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: IMAP client removal skipped');
    return;
  }

  const client = imapClients.get(accountId);
  if (client) {
    await client.disconnect();
    imapClients.delete(accountId);
  }
}