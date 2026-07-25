# Security threat model

| Threat | Primary controls |
|---|---|
| Bulk AI uploads | signed upload sessions, rate limits, hashes, provider consensus, account velocity, queue routing |
| Fabricated proof | short-lived challenges, in-app capture, private evidence, metadata consistency, manual review |
| Stolen creator account | secure tokens, session inventory, reauthentication, suspicious-login events, revocation |
| Cross-account access | RLS, ownership foreign keys, negative policy tests, service-role isolation |
| Coordinated reporting | reporter reputation, rate limits, deduplication, no automatic takedown |
| Malicious files | signature validation, MIME validation, malware scanner, derivative generation |
| Webhook fraud | provider signature validation, replay windows, idempotency keys |
| Scraping | rate limits, CDN controls, progressive resolution, anomaly detection, legal controls |
| Moderator abuse | least privilege, MFA, evidence minimization, immutable audit logs, review sampling |
| Subscription fraud | server webhooks, unified entitlements, provider reconciliation, no local premium truth |

No production secret belongs in a client bundle. Private originals and proof evidence are never served from predictable public URLs.
