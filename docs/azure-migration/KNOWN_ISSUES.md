# Known Issues & Operational Notes

## Canvas Refresh Token Invalidation When Using Staging

**Observed:** 2026-02-26
**Severity:** Developer inconvenience (does not affect production users)

### What happens

When a developer logs into the **staging slot** via Canvas OAuth, Canvas revokes all previously-issued tokens for that user + Canvas developer app combination. Since both staging and production currently share the same `CANVAS_CLIENT_ID` and `CANVAS_CLIENT_SECRET`, this invalidates the developer's production refresh token.

The next time the affected user's production access token expires, the backend tries to refresh it, Canvas returns `invalid_grant` / `refresh_token not found`, and the user gets a 503 error. They are effectively stuck until they manually re-login on production.

This is caused by `"replace_tokens": "1"` in the OAuth callback (`backend/src/auth/router.py`), which is intentional Canvas behavior to prevent duplicate app entries — but it operates across all tokens issued under the same developer key.

### Who is affected

- Developers who test on staging **and** use the same Canvas account on production
- Regular production users (who never touch the staging URL) are **not affected**

### Workaround

If a developer hits a 503 on production after testing on staging, they need to re-login on production via `/auth/login/canvas` to get fresh tokens.

### Proper fix

Register a **separate Canvas developer key** for staging with its own client ID/secret and the staging redirect URI. Then mark `CANVAS_CLIENT_ID` and `CANVAS_CLIENT_SECRET` as slot-sticky in Azure App Service with environment-specific Key Vault secrets (`STAGING-CANVAS-CLIENT-ID`, `STAGING-CANVAS-CLIENT-SECRET`). This isolates staging OAuth flows completely from production.

Additionally, the error handling in `backend/src/canvas/security.py` should treat `invalid_grant` (HTTP 400) as an `AuthenticationError` (rather than `ExternalServiceError`) so affected users get a clean 401 → re-login redirect instead of a permanent 503 loop.
