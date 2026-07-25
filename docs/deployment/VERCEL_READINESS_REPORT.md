# Humn Vercel readiness report

## Runtime environment contract

### Required in Vercel

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL used by browser, Server Components, Route Handlers, and Proxy. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser-safe Supabase publishable key. |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical production HTTPS origin used for OAuth callbacks, password recovery, metadata, robots, and sitemap. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged Supabase access for upload finalization, provenance records, strike state, and administrative server paths. |
| `AUTH_RECOVERY_SECRET` | Server only | Independent HMAC secret for short-lived password-recovery grants. |

### Optional compatibility

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Legacy fallback when a project has not moved to Supabase publishable keys. Do not set it when the publishable key is used unless compatibility is required. |

### Vercel-managed system variables read by the app

`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_ENV` are used for deployment-aware origin fallback and production/preview indexing behavior. They are not Humn secrets.

### Supabase Edge Function runtime variables

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are read inside `supabase/functions`. Supabase supplies these to deployed functions; they are not configured in Vercel.

### Not required by the Vercel web runtime

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`

Those are mobile or local-maintenance variables.

## Code/config changes in this readiness pass

- Centralized production-origin resolution and removed production reliance on a localhost fallback.
- OAuth and password-recovery callback construction now use the deployment origin helper.
- Added production-aware robots and a real sitemap route.
- Migrated deprecated Next.js 16 `middleware.ts` to `proxy.ts`.
- Proxy now supports Supabase publishable keys and legacy anon keys.
- Documented the exact environment contract with names-only `.env.example` files.
- Added `npm run audit:deploy`, `npm run build:web`, and `npm run check:deploy`.
- Approved native install scripts for `sharp` and `@contentauth/c2pa-node` in project policy.
- Removed three unused development-only files that were creating a false environment-variable contract.

## Supabase SSR/serverless review

- Browser code uses `createBrowserClient`.
- Server Components, Server Actions, and Route Handlers create cookie-backed server clients per request.
- Proxy copies refreshed cookies to both the request and response.
- Privileged admin access is isolated in a `server-only` module and does not use a public prefix.
- Upload and proof-processing routes explicitly use the Node.js runtime for `sharp` and C2PA native dependencies.

## Edge Functions

The repository contains:

- `create-report`
- `create-upload-session`
- `delete-account`
- `export-user-data`
- `finalize-upload`
- `generate-discover-feed`

The current web account page directly invokes `delete-account` and `export-user-data`. The other four remain mobile/future-path dependencies. A terminal deployment earlier in the Humn setup confirmed all six were deployed to the linked Supabase project; redeploy them after any function-source change.

## Known production blocker outside config scope

Humn currently accepts image uploads up to 15 MB and sends the file body through a Next.js Route Handler. Vercel Functions enforce a 4.5 MB request-body limit. The app can build and deploy, but production uploads above that limit will fail until the upload flow is rebuilt to send the original directly to Supabase Storage and pass only a storage path to the processing function. This pass does not silently reduce the product limit or change the upload feature.
