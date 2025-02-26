import { type Email } from "@shared/schema";

const WEBHOOK_URL = process.env.WEBHOOK_URL;

export async function sendWebhookNotification(email: Email) {
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