# Career AI Boost

A full-stack AI-powered career platform built with React, Vite, TypeScript, Supabase, and TipTap.

## Features

- 📄 Resume upload & parsing (PDF / DOCX)
- 🤖 AI-powered ATS resume analysis
- ✨ Resume enhancement with rich editor
- 🎤 AI mock interview with voice recognition
- 📧 AI marketing email generator
- 💼 Job search integration (JSearch / RapidAPI)
- 💳 Points-based billing via Paymob

## Getting Started

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd career-ai-boost
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Then fill in your actual values in .env
```

> ⚠️ **Never commit `.env` to git.** It is already listed in `.gitignore`.

### 4. Run locally

```bash
npm run dev
```

### 5. Run tests

```bash
npm test
```

## Security Notes

- Points deduction is handled server-side via the `deduct-points` Edge Function to prevent client-side manipulation.
- Paymob webhook uses real HMAC-SHA512 verification.
- Admin role checks use the `has_role` RPC function (SECURITY DEFINER).

## Project Structure

```
src/
  components/    # Reusable UI components
  contexts/      # React contexts (Auth, Language)
  hooks/         # Custom React hooks
  i18n/          # Translations (Arabic / English)
  integrations/  # Supabase client & types
  lib/           # Utility functions & points logic
  pages/         # Route-level page components
  test/          # Unit tests

supabase/
  functions/     # Edge Functions (AI, payments, jobs)
  migrations/    # Database schema migrations
```
