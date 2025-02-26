import OpenAI from "openai";
import { type EmailCategory } from "@shared/schema";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function categorizeEmail(
  subject: string,
  body: string
): Promise<EmailCategory> {
  if (!openai) {
    // Return a mock category for testing when OpenAI is not configured
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
          content: `Subject: ${subject}\n\nBody: ${body}`
        }
      ],
      temperature: 0,
      max_tokens: 10
    });

    const category = response.choices[0].message.content?.trim() as EmailCategory;
    return category;
  } catch (error) {
    console.error("Error categorizing email:", error);
    return "INTERESTED"; // Default category on error
  }
}