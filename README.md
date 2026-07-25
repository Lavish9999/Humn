# HUMAN

HUMAN is a visual discovery platform for human-created work. This repository is the production-oriented foundation for the mobile app, responsive web app, moderation console, Supabase backend, shared packages, tests, and deployment documentation.

## Current delivery status

This repository implements **Phase 1 — Foundation** and the first database-backed slices of Phase 2:

- npm workspaces monorepo
- centralized brand configuration and design tokens
- Expo Router mobile app foundation
- Next.js web app foundation
- Next.js moderation console foundation
- Supabase Auth clients for web/mobile/server
- email/password and OAuth entry points
- normalized PostgreSQL schema for the initial product core
- RLS policies and storage policies
- category seed data and development-only TEST CONTENT
- initial Discover, profile, save, collection, reporting, and moderation data paths
- typed validation schemas
- CI, database tests, architecture, threat-model, and setup documentation

It does **not** claim that production Apple/Google authentication, payments, third-party verification providers, push credentials, or public deployments have been tested without the required external credentials.

## Requirements

- Node.js 22+
- npm 10+
- Docker Desktop
- Supabase CLI
- Expo/EAS account for device builds

## Start locally

```bash
cp .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run dev:web
```

In separate terminals:

```bash
npm run dev:admin
npm run dev:mobile
```

The local Supabase command prints the API URL and anon key. Copy them into `.env.local` and into `apps/mobile/.env` using the `EXPO_PUBLIC_` names.

## Test

```bash
npm run typecheck
npm run test
npx supabase test db
```

See `docs/deployment/LOCAL_SETUP.md` and `docs/testing/MANUAL_TEST_PHASE_1.md` for complete instructions.
