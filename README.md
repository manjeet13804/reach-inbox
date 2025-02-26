# Email Aggregator

An email aggregator with IMAP integration, AI categorization, and basic search functionality.

## Features

- IMAP email integration
- AI-powered email categorization
- Search functionality
- Real-time email notifications via Slack
- Webhook integration for external services

## Setup

1. Clone or download the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with the following variables:
```
# Database (Required)
DATABASE_URL=your_postgresql_database_url

# OpenAI (Optional)
OPENAI_API_KEY=your_openai_api_key

# Slack (Optional)
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_ID=your_slack_channel_id

# Webhook (Optional)
WEBHOOK_URL=your_webhook_url
```

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Development Mode

In development mode:
- IMAP operations are skipped
- Test data is automatically loaded
- OpenAI categorization returns mock responses if API key is not configured
- Slack and webhook notifications are logged but not sent if credentials are not provided

## Production Mode

For production deployment:
1. Set NODE_ENV to "production"
2. Configure all required environment variables
3. Build the application:
```bash
npm run build
```
4. Start the production server:
```bash
npm start
```
