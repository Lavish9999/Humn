# Required pre-implementation review

## 1. Product positioning
HUMAN is a trust-led visual discovery network, not an AI detector and not a generic image network. Its defensible category is evidence-backed discovery of real human work.

## 2. Competitive pattern analysis
Use familiar discovery mechanics—masonry feeds, search, saves, collections, follows, public pages—because they reduce learning cost. Differentiate through Proof Stories, Origin Status, creator attribution, structured inquiries, trust-weighted ranking, and creator-fair exploration.

## 3–5. Mechanics, differences, originality
Common mechanics are implemented using original terminology, spacing, navigation, styling, copy, and ranking logic. No competing user content, assets, code, proprietary terminology, or exact interface composition is used.

## 6. Information architecture
Mobile: Discover / Search / Create / Collections / You. Web: public discovery and publishing. Admin: role-gated trust-and-safety queues.

## 7. User-role matrix
Guest: public read. User: save/follow/comment/report. Creator: publish and manage owned work. Collaborator: collection-scoped rights. Staff roles: queue-scoped access. Admin: configuration without direct unrestricted database editing.

## 8. Feature priority
P0: auth, profiles, data model, storage, RLS, discover, work detail, collections, publishing integrity, reporting. P1: verification adapters, moderation decisions, appeals, creator studio. P2: subscriptions, visual search, local discovery, native commerce.

## 9. Database plan
PostgreSQL is the source of truth. Normalized ownership tables, explicit policy/status enums where stable, JSON schemas for category-specific extensibility, append-only security/audit event tables, pgvector for visual embeddings.

## 10. Verification architecture
Secure upload → validation → hashes → metadata/C2PA → provider adapters → evidence review → configurable risk calculation → origin status. Provider scores remain private and no single classifier decides a case.

## 11. Moderation architecture
Reports create cases. Role-based queues surface only necessary evidence. Every decision requires structured reason and audit entry. Appeals are reviewed by a more senior role.

## 12. Threat model
Key threats: bulk synthetic uploads, forged proof, account theft, coordinated reports, scraping, webhook fraud, moderator misuse, MIME spoofing, session theft, and enumeration. Controls are documented in `docs/security/THREAT_MODEL.md`.

## 13. Subscription model
Free trust information and core discovery. Plus for organization tools. Creator Pro for professional tools. Payment never alters trust or moderation outcomes. Unified server-side entitlements reconcile RevenueCat and Stripe.

## 14. Major risks
Cold-start content supply; false positives; moderation cost; creator proof friction; storage/analysis cost; marketplace legal scope; Apple/Google credential configuration; performance of large image feeds.

## 15. Phased build
Foundation → Discovery → Creation/verification → Trust/safety → Creator platform → Monetization → Release hardening. Each phase has explicit tests and cannot be declared complete while critical integration credentials or tests are missing.
