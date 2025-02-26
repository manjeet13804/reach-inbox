import { WebClient } from "@slack/web-api";
import { type Email } from "@shared/schema";

const slack = process.env.SLACK_BOT_TOKEN ? new WebClient(process.env.SLACK_BOT_TOKEN) : null;

export async function sendInterestedEmailNotification(email: Email) {
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
              text: `*From:*\n${email.from}`
            },
            {
              type: "mrkdwn",
              text: `*Subject:*\n${email.subject}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Body:*\n${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`
          }
        }
      ]
    });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
}