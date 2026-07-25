# Local setup

1. Install Node 22, Docker Desktop, and the Supabase CLI.
2. At repository root, run `npm install`.
3. Run `npx supabase start`.
4. Copy the printed API URL and anon key into `.env.local` and `apps/mobile/.env`.
5. Run `npx supabase db reset` to apply migrations and category seeds.
6. Run `npm run dev:web`, `npm run dev:admin`, and `npm run dev:mobile` in separate terminals.
7. Open web at `http://localhost:3000`, admin at `http://localhost:3001`, and mobile through a development build or simulator.

## OAuth
Configure Apple and Google in Supabase Auth and add the redirect URLs from `supabase/config.toml`. Native Apple requires the iOS bundle identifier and Apple capability. Google requires platform client IDs.

## Production warnings
Do not use the development Supabase project, seed data, local service-role key, or placeholder legal/support emails in production. Third-party provider adapters require credentials and legal review before being enabled.
