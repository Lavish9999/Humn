# Nontechnical manual test — Phase 1

1. Start Supabase and all three apps using `docs/deployment/LOCAL_SETUP.md`.
2. Open the web app and confirm the landing page, Discover, Search, Collections, and Sign-in navigation work.
3. Create an account with an email you can verify. Confirm the verification email arrives.
4. Sign in. Refresh the page and confirm the session persists.
5. Open Collections and create private, invite-only, and public Collections. Refresh and confirm they remain.
6. Open Discover. With no seeded Works, confirm the honest empty state appears instead of fake content.
7. Run the optional development TEST CONTENT seed after creating a test creator (future seed helper) and confirm content appears from the database.
8. Open the mobile app. Sign in with the same email account and confirm the session survives an app restart.
9. Confirm Discover and Collections read from the same backend.
10. Sign out from You and confirm protected content returns to authentication.
11. Set your test profile role to `moderator` using Supabase Studio, open the admin console, and confirm the queue is visible.
12. Change the role back to `user` and confirm the admin console denies access.
13. Run `npm run typecheck`, `npm run test`, and `npx supabase test db` and capture any failures before advancing to Phase 2.
