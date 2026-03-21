# Biz Manager App

Multi-user business operations app built with Next.js.

Current features:

- Login and registration
- Role selection for owner, manager, and staff
- Role-based page access
- Staff management
- Revenue and expense management
- Saved schedule editor
- Guided next-step flow after login

## Local storage

This version stores app data in:

`data/app-data.json`

That means you can test the full flow locally without setting up a database first.

## Run locally

```bash
npm install
npm run dev
```

Open:

- `/login`
- `/register`
- `/dashboard`

## Deploy on Vercel

This repository is a monorepo-like layout.

When creating the Vercel project:

1. Import the GitHub repository
2. Set **Root Directory** to `biz-manager-app`
3. Framework preset: `Next.js`
4. Add environment variable:
   - `JWT_SECRET`

Suggested production env value:

```bash
JWT_SECRET=replace-with-a-long-random-secret
```

## Current limitations

- Data is file-based, not database-backed yet
- Scheduler uses saved staff and saved assignments, but payroll closing is not fully implemented
- Korean UI copy still needs a cleanup pass
