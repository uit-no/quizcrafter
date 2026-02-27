# Staging Slots Audit Trail — QuizCrafter

**Date:** 2026-02-26
**Deployer:** Marius Solaas
**Resource Group:** `p-qzcrft`
**Guide followed:** `docs/azure-migration/STAGING_SLOTS_GUIDE.md`

---

## Pre-Existing Completed Steps (before this session)

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1.1 | Backend staging slot system-assigned managed identity | Done by Azure admin. Principal ID: `6d7a8ff9-4ec9-40cf-b1ef-bed14628bc0b` |
| Phase 1.2 | AcrPull role assigned to backend staging slot identity | Done before this session |
| Phase 1.3 | Key Vault Secrets User role assigned to backend staging slot identity | Done before this session |
| Phase 2 | VNet integration on backend staging slot (BackendSubnet) | Done by Azure admin. Verified 2026-02-24 |
| Phase 6.0 | Frontend staging slot system-assigned managed identity enabled | Done before this session |
| Phase 6.1 | AcrPull role assigned to frontend staging slot identity | Done before this session |
| Phase 7 | Canvas OAuth staging redirect URI registered in Canvas developer key | Verified 2026-02-24 |

---

## Phase 3: Create Staging Database

**Status:** Completed
**Timestamp:** 2026-02-26

### Commands Run

```bash
# SSH into production backend container (VNet access to PostgreSQL)
az webapp ssh --name p-qzcrft-backend --resource-group p-qzcrft

# Inside the container:
python3 -c "
import os, psycopg2
conn = psycopg2.connect(
    host=os.environ['POSTGRES_SERVER'],
    port=5432,
    dbname='postgres',
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
    sslmode='require'
)
conn.autocommit = True
cur = conn.cursor()
cur.execute('CREATE DATABASE quizcrafter_staging;')
print('Done.')
cur.close()
conn.close()
"
exit
```

### Verification

```bash
az postgres flexible-server db list \
  --server-name p-qzcrft-psql \
  --resource-group p-qzcrft \
  --query "[].name" -o tsv
```

**Result:**

```
azure_maintenance
postgres
azure_sys
quizcrafter
quizcrafter_staging
```

`quizcrafter_staging` confirmed on `p-qzcrft-psql`.

---

## Phase 4: Add Staging Secrets to Key Vault

**Status:** Completed
**Timestamp:** 2026-02-26

### Commands Run

```bash
# 1. Staging secret key (new random value — separate from production)
az keyvault secret set \
  --vault-name p-qzcrft-kv \
  --name "STAGING-SECRET-KEY" \
  --value "$(openssl rand -hex 32)"

# 2. Staging DB password (same PostgreSQL server/user/password as production,
#    kept as a separate secret for future divergence)
PROD_PW=$(az keyvault secret show --vault-name p-qzcrft-kv --name "POSTGRES-PASSWORD" --query "value" -o tsv)
az keyvault secret set \
  --vault-name p-qzcrft-kv \
  --name "STAGING-POSTGRES-PASSWORD" \
  --value "$PROD_PW"

# 3. Staging Canvas redirect URI (staging backend slot URL)
az keyvault secret set \
  --vault-name p-qzcrft-kv \
  --name "STAGING-CANVAS-REDIRECT-URI" \
  --value "https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/auth/callback/canvas"
```

### Verification

```bash
az keyvault secret list --vault-name p-qzcrft-kv --query "[].name" -o tsv | sort
```

**Result:** All 12 secrets present (9 production + 3 staging):

```
AZURE-OPENAI-API-KEY
AZURE-OPENAI-API-VERSION
AZURE-OPENAI-ENDPOINT
CANVAS-BASE-URL
CANVAS-CLIENT-ID
CANVAS-CLIENT-SECRET
CANVAS-REDIRECT-URI
POSTGRES-PASSWORD
SECRET-KEY
STAGING-CANVAS-REDIRECT-URI
STAGING-POSTGRES-PASSWORD
STAGING-SECRET-KEY
postgres-admin-password
postgres-admin-username
```

---

## Phase 5: Configure Backend Staging Slot

**Status:** Completed
**Timestamp:** 2026-02-26

### Phase 5.1 — Set Container Image

```bash
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-backend:latest"
```

### Phase 5.2 — Enable Managed Identity for ACR Pull

```bash
az webapp config appsettings set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --settings \
    DOCKER_REGISTRY_SERVER_URL="https://pqzcrftacr-afb8abgzafb6fxf5.azurecr.io" \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE="false"

az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-backend/slots/staging/config/web \
  --set properties.acrUseManagedIdentityCreds=true
```

### Phase 5.3 — Set Application Settings

> **Note:** The guide's original `--slot-settings` command (names only, no values) fails with Azure CLI 2.82.0: `not enough values to unpack (expected 2, got 1)`. The corrected commands below include values for the slot-sticky settings.

```bash
KV="p-qzcrft-kv"
STAGING_FRONTEND_URL="https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net"

# Set all swappable settings
az webapp config appsettings set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --settings \
    WEBSITES_PORT="8000" \
    POSTGRES_SERVER="p-qzcrft-psql.postgres.database.azure.com" \
    POSTGRES_PORT="5432" \
    POSTGRES_USER="sqladmin" \
    POSTGRES_SSLMODE="require" \
    PROJECT_NAME="QuizCrafter" \
    WEB_CONCURRENCY="2" \
    MALLOC_ARENA_MAX="2" \
    WEBSITES_CONTAINER_STOP_TIME_LIMIT="300" \
    WEBSITE_VNET_ROUTE_ALL="1" \
    CANVAS_BASE_URL="@Microsoft.KeyVault(VaultName=${KV};SecretName=CANVAS-BASE-URL)" \
    CANVAS_CLIENT_ID="@Microsoft.KeyVault(VaultName=${KV};SecretName=CANVAS-CLIENT-ID)" \
    CANVAS_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=${KV};SecretName=CANVAS-CLIENT-SECRET)" \
    AZURE_OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=${KV};SecretName=AZURE-OPENAI-API-KEY)" \
    AZURE_OPENAI_ENDPOINT="@Microsoft.KeyVault(VaultName=${KV};SecretName=AZURE-OPENAI-ENDPOINT)" \
    AZURE_OPENAI_API_VERSION="@Microsoft.KeyVault(VaultName=${KV};SecretName=AZURE-OPENAI-API-VERSION)" \
    ENVIRONMENT="staging" \
    POSTGRES_DB="quizcrafter_staging" \
    POSTGRES_PASSWORD="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-POSTGRES-PASSWORD)" \
    SECRET_KEY="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-SECRET-KEY)" \
    FRONTEND_HOST="${STAGING_FRONTEND_URL}" \
    CANVAS_REDIRECT_URI="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-CANVAS-REDIRECT-URI)"

# Mark slot-specific settings as slot-sticky (corrected: must include name=value pairs)
az webapp config appsettings set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --slot-settings \
    ENVIRONMENT="staging" \
    POSTGRES_DB="quizcrafter_staging" \
    POSTGRES_PASSWORD="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-POSTGRES-PASSWORD)" \
    SECRET_KEY="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-SECRET-KEY)" \
    FRONTEND_HOST="${STAGING_FRONTEND_URL}" \
    CANVAS_REDIRECT_URI="@Microsoft.KeyVault(VaultName=${KV};SecretName=STAGING-CANVAS-REDIRECT-URI)"
```

### Phase 5.4 — Security and Health Check

```bash
az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --always-on true \
  --ftps-state Disabled \
  --http20-enabled true \
  --min-tls-version 1.2

az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --generic-configurations '{"healthCheckPath": "/utils/health-check/"}'
```

### Verification

```bash
# Slot-sticky settings
az webapp config appsettings list \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "[].{name:name, slotSetting:slotSetting}" -o table

# ACR managed identity
az resource show \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-backend/slots/staging/config/web \
  --query "properties.acrUseManagedIdentityCreds" -o tsv

# Container image, health check, security
az webapp config show \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "{linuxFxVersion:linuxFxVersion, alwaysOn:alwaysOn, ftpsState:ftpsState, http20Enabled:http20Enabled, healthCheckPath:healthCheckPath}" \
  -o json
```

**Result — Slot-sticky settings (6 confirmed):**

| Name | SlotSetting |
|------|-------------|
| `ENVIRONMENT` | True |
| `POSTGRES_DB` | True |
| `POSTGRES_PASSWORD` | True |
| `SECRET_KEY` | True |
| `FRONTEND_HOST` | True |
| `CANVAS_REDIRECT_URI` | True |

**Result — ACR managed identity:** `true`

**Result — Container image / security / health check:**

```json
{
  "alwaysOn": true,
  "ftpsState": "Disabled",
  "healthCheckPath": "/utils/health-check/",
  "http20Enabled": true,
  "linuxFxVersion": "DOCKER|pqzcrftacr-afb8abgzafb6fxf5.azurecr.io/quizcrafter-backend:latest"
}
```

---

## Phase 6: Configure Frontend Staging Slot

**Status:** Completed
**Timestamp:** 2026-02-26

> Phases 6.0 and 6.1 (managed identity + AcrPull) were completed before this session.

### Phase 6.2 — Set Container Image, ACR Pull, Clear Startup Command

```bash
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:staging"

az webapp config appsettings set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --settings \
    WEBSITES_PORT="80" \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE="false"

az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --set properties.acrUseManagedIdentityCreds=true

# MUST use resource update — az webapp config set --startup-file "" has no effect
az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --set properties.appCommandLine=""
```

### Phase 6.3 — Security Settings

```bash
az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --always-on true \
  --ftps-state Disabled \
  --http20-enabled true \
  --min-tls-version 1.2
```

### Verification

```bash
az resource show \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --query "properties.acrUseManagedIdentityCreds" -o tsv

az webapp config show \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "{linuxFxVersion:linuxFxVersion, appCommandLine:appCommandLine, alwaysOn:alwaysOn, ftpsState:ftpsState, http20Enabled:http20Enabled}" \
  -o json
```

**Result — ACR managed identity:** `true`

**Result — Container image / startup command / security:**

```json
{
  "alwaysOn": true,
  "appCommandLine": "",
  "ftpsState": "Disabled",
  "http20Enabled": true,
  "linuxFxVersion": "DOCKER|pqzcrftacr-afb8abgzafb6fxf5.azurecr.io/quizcrafter-frontend:staging"
}
```

---

## Phase 8: First Deploy and Verify

**Status:** Completed
**Timestamp:** 2026-02-26

### Backend Start

> Note: The staging slot was in `Administratively Stopped` state. `az webapp restart` does not start a stopped slot — `az webapp start` is required.

```bash
az webapp start \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging
```

### Backend Verification

```bash
curl -s https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/
# Result: true

curl -s https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/ready
# Result: {"status":"ok","db":"ok"}
```

**Result:** Container started. DB connectivity confirmed. However, "Running database migrations..." was NOT visible in logs — migrations did not run. Root cause identified in post-deploy issue below.

### Frontend Staging Image Build and Deploy

```bash
az acr login --name pqzcrftacr

ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"
STAGING_BACKEND="https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net"

# Build with staging backend URL baked in via --build-arg
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL="$STAGING_BACKEND" \
  -t ${ACR_LOGIN}/quizcrafter-frontend:staging \
  ./frontend

docker push ${ACR_LOGIN}/quizcrafter-frontend:staging

az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:staging"

az webapp restart --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging
```

### Frontend Verification

```bash
curl -s -o /dev/null -w "%{http_code}" https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net
# Result: 200

curl -s -o /dev/null -w "%{http_code}" https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net/login
# Result: 200
```

**Result:** nginx serving staging frontend. SPA routing confirmed.

---

## Post-Deploy Fix: Migrations Not Running (appCommandLine)

**Status:** Resolved
**Timestamp:** 2026-02-26

### Symptom

Canvas OAuth login failed on staging with:
```
psycopg2.errors.UndefinedTable: relation "user" does not exist
```

`start.sh` echoes "Running database migrations..." before running `alembic upgrade head`. This message was absent from the startup logs, confirming `start.sh` was not being executed.

### Root Cause

The backend staging slot had a legacy `appCommandLine` set:

```
gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 src.main:app
```

In Azure App Service, `appCommandLine` overrides the Dockerfile `CMD`. This command started Gunicorn directly, bypassing `start.sh` and its `alembic upgrade head` call entirely. The health check passed (Gunicorn was running) but the `quizcrafter_staging` database had no tables.

The production backend had an empty `appCommandLine` (verified) — production was not affected.

### Fix

```bash
# Clear the legacy startup command on backend staging slot
az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-backend/slots/staging/config/web \
  --set properties.appCommandLine=""

# Restart to trigger start.sh → alembic upgrade head → gunicorn
az webapp restart \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging
```

**Result:** "Running database migrations..." appeared in log stream. All 6 migrations applied to `quizcrafter_staging`. Canvas OAuth login succeeded.

---

## Post-Setup Fix: Production Pulled Staging Image on Restart

**Status:** Resolved
**Timestamp:** 2026-02-27

### Symptom

After a staging build was pushed (which updates the `:latest` tag in ACR), restarting the production backend App Service caused it to pull the new, untested staging image. Both production and staging `linuxFxVersion` settings pointed to `quizcrafter-backend:latest` and `quizcrafter-frontend:latest` respectively. Because `:latest` is mutable, any production restart — whether triggered manually, by Azure maintenance, or by a scale event — would re-pull whatever `:latest` currently pointed to in ACR.

### Root Cause

The deployment workflow set `linuxFxVersion` to the `:latest` tag on the staging slot before swapping. Since `linuxFxVersion` is a **swappable** setting, after a swap production also held `...:latest`. A restart of the production slot then fetched the newest `:latest` image from ACR, which could already be a mid-cycle staging build.

### Fix

Updated the deployment guide to configure the staging slot's `linuxFxVersion` with the immutable commit SHA tag instead of `:latest`:

- **Backend** (Step 2): `DOCKER|.../quizcrafter-backend:${COMMIT_SHA}`
- **Frontend** (Step 3, before swap): `DOCKER|.../quizcrafter-frontend:${COMMIT_SHA}`
- **Quick Reference**: both inline commands updated to match

The `:latest` tag is still pushed alongside the SHA tag (Step 1 is unchanged) — it remains available in ACR for convenience but is no longer referenced by either slot's `linuxFxVersion`. After a swap, production inherits the pinned SHA; a restart re-pulls that exact image.

### Affected guide sections

`docs/azure-migration/STAGING_SLOTS_GUIDE.md` — Regular Backend Deployment Workflow § Step 2, Regular Frontend Deployment Workflow § Step 3, Quick Reference.

---

## Issues Found in Guide

| # | Phase | Issue | Resolution |
|---|-------|-------|------------|
| 1 | 5.3 | `az webapp config appsettings set --slot-settings` with only setting names (no values) fails with Azure CLI 2.82.0: `not enough values to unpack (expected 2, got 1)` | Must include `name=value` pairs in `--slot-settings`. Corrected commands documented above. |
| 2 | 5 | Guide does not check or clear `appCommandLine` on the backend staging slot | Added `az resource update --set properties.appCommandLine=""` step (same pattern as frontend Phase 6.2). The staging slot inherited a legacy gunicorn command that bypassed `start.sh` and prevented migrations from running. |
| 3 | 6 | `DOCKER_REGISTRY_SERVER_URL` was set on the frontend **staging** slot but not on the **production** slot. During the first swap, Azure's swap preview flagged it as a config change — the staging value would travel to production and the production config (which lacked the key) would move back to staging, leaving the new staging slot without ACR registry config. | Set `DOCKER_REGISTRY_SERVER_URL` on the production frontend slot: `az webapp config appsettings set --name p-qzcrft-frontend --resource-group p-qzcrft --settings DOCKER_REGISTRY_SERVER_URL="https://pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"`. Backend production slot already had the setting. Guide updated with an explicit production-slot setup step in Phase 6.2. |
