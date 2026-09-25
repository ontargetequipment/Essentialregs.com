This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

CI (`.github/workflows/ci.yml`) has three jobs:

- **check**, on every PR and push to `main`: `npm run lint`, `npm run typecheck`, `npm test` (`scripts/*.test.ts`) and the pipeline's pytest suite. No secrets.
- **smoke**, when Vercel reports a successful deployment (or by hand with a `base_url`): the Playwright tests in `e2e/` against that deployment. Read-only; never signs up or pays. Production deployments run the anonymous group only. Repository secrets it uses:
  - `VERCEL_AUTOMATION_BYPASS_SECRET` (the project's Protection Bypass for Automation secret). Without it the job skips.
  - `SMOKE_EMAIL` / `SMOKE_PASSWORD` (an existing subscribed account). Without them the signed-in group skips.
- **qa**, manual only: `scripts/corpus_qa.sql` against the database, using the `SUPABASE_DB_URL` secret.

To run the smoke locally against any deployment: `BASE_URL=https://<deployment> npm run smoke` (after `npx playwright install chromium`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
