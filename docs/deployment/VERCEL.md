# Humn web deployment on Vercel

## Project configuration

- Framework preset: Next.js
- Root Directory: `apps/web`
- Include source files outside the Root Directory: enabled (required for `packages/*` workspaces)
- Install command: Vercel automatic npm workspace install
- Build command: `npm run build`
- Output directory: framework default (`.next`)
- Node.js: 22 or newer, matching the repository `engines` field

The repository root lockfile must be committed so Vercel can identify npm workspaces and install shared packages reproducibly.

## Vercel environment variables

### Required public

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by browser, Server Components, Route Handlers, and Proxy.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key safe for browser use.
- `NEXT_PUBLIC_SITE_URL`: Canonical HTTPS origin for OAuth, password recovery, metadata, robots, and sitemap.

### Required server-only

- `SUPABASE_SERVICE_ROLE_KEY`: Privileged Supabase key used only by server-only upload and administrative data paths. Never prefix with `NEXT_PUBLIC_`.
- `AUTH_RECOVERY_SECRET`: Independent random secret used to sign short-lived password-recovery grants.

### Optional compatibility

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Legacy fallback if the project still uses an anon key instead of the publishable key.

Vercel also supplies `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_ENV`. Humn uses them as deployment-aware fallbacks and preview/production indicators; they do not replace setting the canonical `NEXT_PUBLIC_SITE_URL` for production.

## Supabase Auth dashboard

Set the production site URL to the final Humn HTTPS domain. Add redirect URLs for:

- `https://YOUR_DOMAIN/auth/callback`
- Vercel preview URLs only when preview OAuth/password recovery is intentionally supported.

Google and Apple provider consoles must use the same Supabase callback/provider configuration already established for the project.

## Supabase Edge Functions

The web account page directly invokes:

- `export-user-data`
- `delete-account`

The repository also contains mobile/future functions:

- `create-report`
- `create-upload-session`
- `finalize-upload`
- `generate-discover-feed`

Deploy all functions separately from Vercel with:

```powershell
npx supabase functions deploy
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. These are not Vercel variables.

## Production build

From the monorepo root:

```powershell
npm run check:deploy
```

This audits environment references and runtime localhost URLs, runs the web typecheck, and runs the optimized Next.js production build.

## Known deployment blocker: upload request size

The web upload form currently allows files up to 15 MB and sends the file through a Next.js Route Handler. Vercel Functions reject request bodies above 4.5 MB. The first deployment can build and serve the rest of Humn, but uploads larger than the platform limit require a separate direct-to-Supabase upload architecture before launch. Do not silently lower the Humn limit or claim those files are supported on Vercel until that flow is rebuilt and verified.
