# LeadDaily

A Next.js web app that uses OpenAI to find businesses matching your criteria and sends cold outreach emails to them in bulk.

## Prerequisites

- Node.js (v18+)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- SMTP credentials for sending emails (e.g. Gmail App Password)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the example `.env` file and fill in your credentials:

   ```bash
   cp .env .env.local
   ```

   Edit `.env` with your values:

   ```env
   # OpenAI
   OPENAI_API_KEY=your-openai-api-key-here

   # SMTP (Email)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password-here
   EMAIL_FROM=your-email@gmail.com

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

   # App URL (used by cron jobs to make internal API calls)
   # Set to your production URL on Vercel, e.g. https://your-app.vercel.app
   # Falls back to NEXT_PUBLIC_APP_URL, then the request origin if not set
   APP_BASE_URL=https://your-app.vercel.app
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

   # Cron job secret (must match the value in vercel.json)
   CRON_SECRET=your-random-secret-here
   ```

   > **Gmail users:** You need to generate an [App Password](https://myaccount.google.com/apppasswords) (requires 2FA enabled) and use it as `SMTP_PASS`.

   > **Supabase:** Find your URL and keys in the [Supabase dashboard](https://supabase.com/dashboard) under your project's Settings → API. Use the **anon/public** key for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the **service_role** key for `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only).

   > **CRON_SECRET:** Generate a strong random string (e.g. `openssl rand -hex 32`) and set the same value in Vercel's environment variables.

## Running the App

**Development mode:**

```bash
npm run dev
```

**Production build:**

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Enter a search prompt** — Describe the type of businesses you're looking for, including location.
   Example: `Small and Medium Business Plumbing Services in St Marys, NSW`

2. **Write your email** — Fill in the subject line and email body content.

3. **Click Search** — The app calls OpenAI to generate a list of up to 100 matching businesses with names and email addresses. Results are displayed in a table.

4. **Click Send Emails** — The app sends your email to every business in the results list via SMTP. A status message shows how many emails were sent successfully and how many failed.

## Deploying to Vercel

This is a Next.js app that deploys to Vercel with zero configuration.

1. **Install the Vercel CLI** (if you don't have it):

   ```bash
   npm i -g vercel
   ```

2. **Add environment variables** in the [Vercel dashboard](https://vercel.com) under your project's Settings → Environment Variables:

   - `OPENAI_API_KEY`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_BASE_URL` (set to your production URL, e.g. `https://your-app.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` (same as `APP_BASE_URL`)
   - `CRON_SECRET`

3. **Deploy:**

   ```bash
   vercel            # preview deployment
   vercel --prod     # production deployment
   ```

   Or connect your GitHub repo in the Vercel dashboard for automatic deployments on push.

## Project Structure

```
lead-daily-app/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page (client component)
│   ├── globals.css             # Global styles
│   └── api/
│       ├── search/
│       │   └── route.ts        # POST /api/search — OpenAI business lookup
│       └── send-emails/
│           └── route.ts        # POST /api/send-emails — bulk email sender
├── public/                     # Static assets
├── next.config.ts
├── vercel.json
├── .env                        # Environment variables (not committed)
├── .gitignore
├── tsconfig.json
└── package.json
```

## API Endpoints

| Method | Endpoint           | Description                        |
| ------ | ------------------ | ---------------------------------- |
| POST   | `/api/search`      | Search businesses via OpenAI       |
| POST   | `/api/send-emails` | Send emails to a list of businesses |

## Important Notes

- OpenAI generates business data based on its training data — **email addresses may not be real or current**. For production use, integrate a verified business directory API (e.g. Google Places, Yelp, or a data provider).
- Be mindful of anti-spam laws (CAN-SPAM, GDPR, etc.) when sending cold outreach emails.
- SMTP providers may have daily sending limits. Check your provider's policies.
