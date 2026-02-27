# Staging Slots Guide — QuizCrafter on Azure App Service

**Resource Group:** `p-qzcrft`
**Branch:** `azure-migration`
**Last Updated:** 2026-02-24

---

## Table of Contents

1. [Overview](#overview)
2. [URLs and Resource Reference](#urls-and-resource-reference)
3. [One-Time Setup](#one-time-setup)
   - [Phase 1: Staging Slot Managed Identity + RBAC Roles](#phase-1-staging-slot-managed-identity--rbac-roles)
   - [Phase 2: Verify VNet Integration on Staging Slot — COMPLETED](#phase-2-verify-vnet-integration-on-staging-slot--completed)
   - [Phase 3: Create Staging Database](#phase-3-create-staging-database)
   - [Phase 4: Add Staging Secrets to Key Vault](#phase-4-add-staging-secrets-to-key-vault)
   - [Phase 5: Configure Backend Staging Slot](#phase-5-configure-backend-staging-slot)
   - [Phase 6: Configure Frontend Staging Slot](#phase-6-configure-frontend-staging-slot)
   - [Phase 7: Canvas OAuth — Add Staging Redirect URI — COMPLETED](#phase-7-canvas-oauth--add-staging-redirect-uri--completed)
   - [Phase 8: First Deploy and Verify Staging](#phase-8-first-deploy-and-verify-staging)
4. [Slot Settings Reference](#slot-settings-reference)
5. [Regular Backend Deployment Workflow](#regular-backend-deployment-workflow)
6. [Regular Frontend Deployment Workflow](#regular-frontend-deployment-workflow)
7. [Combined Deployment (Backend + Frontend)](#combined-deployment-backend--frontend)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)
10. [Quick Reference](#quick-reference)

---

## Overview

Azure App Service deployment slots let you deploy new code to a **staging slot**, test it there, then do a near-instant **swap** to make it live in production — with zero downtime and a one-command rollback.

### How Slot Swap Works

1. You deploy a new Docker image to the **staging slot**
2. Azure warms up the staging slot (calls the health check endpoint)
3. Only when the container is healthy does Azure atomically switch traffic routing
4. The old production container moves to the staging slot (becomes your rollback target)
5. Rollback = swap again (takes ~30 seconds)

### What Swaps vs. What Stays

Settings are categorized as:

- **Slot-sticky** (`--slot-settings`): Stay with the slot — staging always has staging values, production always has production values. Use for DB name, redirect URIs, `ENVIRONMENT`, and secrets that differ between environments.
- **Swappable**: Travel with the container image. Use for all infrastructure settings that are the same in both environments.

This means: after a swap, the new production container automatically connects to the **production database**, not the staging database.

### Migration Safety

`backend/scripts/start.sh` runs `alembic upgrade head` on every container startup. Because the DB connection settings are slot-sticky, each slot always migrates its own database:

- Staging slot → migrates `quizcrafter_staging`
- Production slot → migrates `quizcrafter`

**Important:** Keep migrations backward-compatible (additive only — new columns with defaults, new tables). During the swap warmup, the new code runs against the production DB before traffic switches; the old code should still be able to read that DB.

---

## URLs and Resource Reference

| Service | URL |
|---------|-----|
| **Backend (production)** | `https://p-qzcrft-backend-eab9c7dga9d4cxgv.westeurope-01.azurewebsites.net` |
| **Backend (staging slot)** | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net` |
| **Frontend (production)** | `https://p-qzcrft-frontend-gjabc8deeeahbjh3.westeurope-01.azurewebsites.net` |
| **Frontend (staging slot)** | `https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net` |
| **Backend health (staging)** | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/` |
| **Backend deep health (staging)** | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/ready` |

| Resource | Name |
|----------|------|
| Resource group | `p-qzcrft` |
| Backend App Service | `p-qzcrft-backend` |
| Frontend App Service | `p-qzcrft-frontend` |
| Staging slot (both) | `staging` |
| ACR login server | `pqzcrftacr-afb8abgzafb6fxf5.azurecr.io` |
| Key Vault | `p-qzcrft-kv` |
| PostgreSQL server | `p-qzcrft-psql.postgres.database.azure.com` |
| Production database | `quizcrafter` |
| Staging database | `quizcrafter_staging` |

---

## One-Time Setup

Run these steps once. After they are complete, use the [deployment workflows](#regular-backend-deployment-workflow) for every subsequent release.

### Phase 1: Staging Slot Managed Identity + RBAC Roles

The backend staging slot needs its own system-assigned managed identity to pull images from ACR and read secrets from Key Vault.

#### 1.1 Enable system-assigned managed identity on the staging slot — COMPLETED

> Done by Azure admin. Principal ID: `6d7a8ff9-4ec9-40cf-b1ef-bed14628bc0b`. Verified 2026-02-24.

```bash
# Get the principalId for the role assignments below
STAGING_IDENTITY=$(az webapp identity show \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query principalId -o tsv)

echo "Staging slot managed identity: $STAGING_IDENTITY"
```

#### 1.2 Assign AcrPull role to staging slot identity

```bash
ACR_ID=$(az acr show --name pqzcrftacr --query id -o tsv)

az role assignment create \
  --assignee "$STAGING_IDENTITY" \
  --role AcrPull \
  --scope "$ACR_ID"
```

#### 1.3 Assign Key Vault Secrets User to staging slot identity

```bash
KV_ID=$(az keyvault show --name p-qzcrft-kv --query id -o tsv)

az role assignment create \
  --assignee "$STAGING_IDENTITY" \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"
```

#### Verification 1

```bash
# Confirm both roles are assigned
az role assignment list \
  --assignee "$STAGING_IDENTITY" \
  --query "[].{role:roleDefinitionName, scope:scope}" -o table
```

Expected: two rows — `AcrPull` and `Key Vault Secrets User`.

---

### Phase 2: Verify VNet Integration on Staging Slot — COMPLETED

> Done by Azure admin. Staging slot integrated with `BackendSubnet` in `p-qzcrft-network-vnet`. Verified 2026-02-24.

To re-verify:

```bash
az webapp vnet-integration list \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  -o table
```

If this ever needs to be reconfigured:

```bash
# Only if you have Contributor access on the network resource group
SUBNET_ID=$(az network vnet subnet show \
  --vnet-name p-qzcrft-network-vnet \
  --name BackendSubnet \
  --resource-group p-qzcrft-network \
  --query id -o tsv)

az webapp vnet-integration add \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --vnet "$SUBNET_ID"
```

---

### Phase 3: Create Staging Database

The staging slot uses a dedicated database on the same PostgreSQL server. The database must be created from within the VNet (use the backend container or Azure admin portal).

#### Option A: Via Azure CLI (requires public access or existing VNet path)

```bash
az postgres flexible-server db create \
  --server-name p-qzcrft-psql \
  --resource-group p-qzcrft \
  --database-name quizcrafter_staging
```

#### Option B: Via the backend container (recommended — no public access needed)

```bash
# SSH into the production backend container (has VNet access)
az webapp ssh --name p-qzcrft-backend --resource-group p-qzcrft

# Inside the container, connect to PostgreSQL and create the database
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

#### Verification 3

```bash
az postgres flexible-server db list \
  --server-name p-qzcrft-psql \
  --resource-group p-qzcrft \
  --query "[].name" -o tsv
```

Expected: output includes `quizcrafter_staging`.

---

### Phase 4: Add Staging Secrets to Key Vault

The staging slot uses three dedicated secrets. All other secrets (Canvas, OpenAI) are shared with production.

```bash
KV="p-qzcrft-kv"

# 1. Separate secret key for staging (never share JWT signing keys between environments)
az keyvault secret set \
  --vault-name $KV \
  --name "STAGING-SECRET-KEY" \
  --value "$(openssl rand -hex 32)"

# 2. Staging DB password — same server/user as production so same password value,
#    but kept as a separate secret so it can diverge in the future.
#    Copy the current production password value:
PROD_PW=$(az keyvault secret show --vault-name $KV --name "POSTGRES-PASSWORD" --query "value" -o tsv)
az keyvault secret set \
  --vault-name $KV \
  --name "STAGING-POSTGRES-PASSWORD" \
  --value "$PROD_PW"

# 3. Canvas staging redirect URI (staging backend slot URL)
az keyvault secret set \
  --vault-name $KV \
  --name "STAGING-CANVAS-REDIRECT-URI" \
  --value "https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/auth/callback/canvas"
```

#### Verification 4

```bash
az keyvault secret list --vault-name p-qzcrft-kv --query "[].name" -o tsv | sort
```

Expected: the three new staging secrets appear alongside the existing 9 production secrets.

---

### Phase 5: Configure Backend Staging Slot

This phase configures the staging slot to mirror production, with slot-sticky overrides for the environment-specific values.

#### 5.1 Set container image

```bash
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-backend:latest"
```

#### 5.2 Enable managed identity for ACR pull

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

# Clear startup command — MUST use resource update (--startup-file "" has no effect).
# If appCommandLine is non-empty, it overrides the Dockerfile CMD and bypasses start.sh,
# which means alembic upgrade head never runs and the database has no tables.
az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-backend/slots/staging/config/web \
  --set properties.appCommandLine=""
```

#### 5.3 Set all application settings

The block below sets all settings. The `--slot-settings` flag at the end marks the environment-specific ones as slot-sticky so they never swap to production.

```bash
KV="p-qzcrft-kv"
STAGING_FRONTEND_URL="https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net"

# Set all settings (swappable + slot-specific in one command)
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
```

Now mark the environment-specific settings as **slot-sticky** (these are the ones that must NOT swap):

```bash
KV="p-qzcrft-kv"
STAGING_FRONTEND_URL="https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net"

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

> **Note:** `--slot-settings` requires `name=value` pairs — passing only names fails with Azure CLI 2.82.0+ (`not enough values to unpack`). The command above includes the values explicitly.
>
> **Why these six?** They are the only settings with different values between staging and production. Everything else (port, DB server, Canvas app credentials, OpenAI, worker count) is identical in both environments and should travel with the code when slots are swapped.

#### 5.4 Security and health check

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

#### Verification 5

```bash
# Confirm slot-sticky markers are set
az webapp config appsettings list \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "[?slotSetting==true].name" -o tsv
```

Expected output (6 sticky settings):
```
ENVIRONMENT
POSTGRES_DB
POSTGRES_PASSWORD
SECRET_KEY
FRONTEND_HOST
CANVAS_REDIRECT_URI
```

```bash
# Confirm acrUseManagedIdentityCreds
az resource show \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-backend/slots/staging/config/web \
  --query "properties.acrUseManagedIdentityCreds" -o tsv
```

Expected: `true`

---

### Phase 6: Configure Frontend Staging Slot

The frontend staging slot serves a Docker container (nginx:1 from ACR), identical in structure to production. Because `VITE_API_URL` is baked into the static bundle at Docker build time, the staging slot needs its own system-assigned managed identity to pull images from ACR.

> **No Key Vault access needed** — the frontend container has no secrets. All configuration is baked at build time.

#### 6.0 Enable managed identity on the frontend staging slot

```bash
# Enable system-assigned managed identity
az webapp identity assign \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging

# Get the principal ID for role assignments
FRONTEND_STAGING_IDENTITY=$(az webapp identity show \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --query principalId -o tsv)

echo "Frontend staging slot identity: $FRONTEND_STAGING_IDENTITY"
```

#### 6.1 Assign AcrPull role to frontend staging slot identity

```bash
ACR_ID=$(az acr show --name pqzcrftacr --query id -o tsv)

az role assignment create \
  --assignee "$FRONTEND_STAGING_IDENTITY" \
  --role AcrPull \
  --scope "$ACR_ID"
```

#### Verification 6.1

```bash
az role assignment list \
  --assignee "$FRONTEND_STAGING_IDENTITY" \
  --query "[].{role:roleDefinitionName, scope:scope}" -o table
```

Expected: one row — `AcrPull`.

---

#### 6.2 Set container image and ACR pull

```bash
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

# Switch to Docker container mode
az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:staging"

# Container settings — set on BOTH slots so these swappable settings are symmetric.
# If only set on staging, the first swap moves them to production and the new staging
# slot loses them, breaking ACR pull on the next deploy.
az webapp config appsettings set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --settings \
    DOCKER_REGISTRY_SERVER_URL="https://${ACR_LOGIN}" \
    WEBSITES_PORT="80" \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE="false"

az webapp config appsettings set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --settings \
    DOCKER_REGISTRY_SERVER_URL="https://${ACR_LOGIN}" \
    WEBSITES_PORT="80" \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE="false"

# Enable managed identity for ACR pull
az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --set properties.acrUseManagedIdentityCreds=true

# Clear startup command (MUST use resource update — --startup-file "" has no effect)
az resource update \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --set properties.appCommandLine=""
```

#### 6.3 Security settings

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

#### Verification 6.3

```bash
az resource show \
  --ids /subscriptions/f2d616a4-6e35-4999-aa17-22fa2c83dca5/resourceGroups/p-qzcrft/providers/Microsoft.Web/sites/p-qzcrft-frontend/slots/staging/config/web \
  --query "properties.acrUseManagedIdentityCreds" -o tsv
# Expected: true

az webapp config show \
  --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging \
  --query "{linuxFxVersion:linuxFxVersion, appCommandLine:appCommandLine}" -o json
# Expected: { "linuxFxVersion": "DOCKER|...quizcrafter-frontend:staging", "appCommandLine": "" }
```

> The frontend has no slot-sticky settings — both slots serve static files with the same nginx container configuration. The difference (which backend URL is baked in) is controlled at **Docker build time** via `--build-arg VITE_API_URL`, not through app settings.

---

### Phase 7: Canvas OAuth — Add Staging Redirect URI — COMPLETED

> Staging redirect URI already registered in Canvas developer key. Verified 2026-02-24.

In Canvas LMS, open the developer key for this application and add the staging redirect URI alongside the existing production one:

```
https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/auth/callback/canvas
```

**Steps:**

1. Log in to `https://uit.instructure.com` as an admin
2. Go to **Admin → Developer Keys**
3. Find the QuizCrafter developer key
4. Edit it and add the staging URL to the **Redirect URIs** field (one URI per line)
5. Save

No code changes are needed — `CANVAS_REDIRECT_URI` on the staging slot already points to this URL (set via Key Vault in Phase 4/5).

---

### Phase 8: First Deploy and Verify Staging

Deploy the current production image to staging and run the initial migrations.

```bash
# Pull the current production image into staging
az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|pqzcrftacr-afb8abgzafb6fxf5.azurecr.io/quizcrafter-backend:latest"

# Restart to apply all settings
az webapp restart \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging
```

Wait ~90 seconds for container startup and migration, then verify:

```bash
# Shallow health check
curl -s https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/
# Expected: true

# Deep health check (confirms DB connectivity + migrations ran)
curl -s https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/ready
# Expected: {"status":"ok","db":"ok"}
```

For the frontend, build a staging Docker image and deploy it to the staging slot:

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

Verify:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net
# Expected: 200
```

**Setup is complete.** The staging environment is now a running, fully configured mirror of production.

---

## Slot Settings Reference

This table shows every backend app setting and its swap behavior. Use this as a reference when adding new settings in the future.

| Setting | Value in staging | Slot-sticky? | Reason |
|---------|-----------------|:---:|--------|
| `ENVIRONMENT` | `staging` | ✅ | Different label per environment |
| `POSTGRES_DB` | `quizcrafter_staging` | ✅ | Different DB per slot |
| `POSTGRES_PASSWORD` | KV → `STAGING-POSTGRES-PASSWORD` | ✅ | Different secret per slot |
| `SECRET_KEY` | KV → `STAGING-SECRET-KEY` | ✅ | Never share JWT keys between envs |
| `FRONTEND_HOST` | staging frontend URL | ✅ | CORS — must match the frontend serving this backend |
| `CANVAS_REDIRECT_URI` | KV → `STAGING-CANVAS-REDIRECT-URI` | ✅ | OAuth callback must match the slot's URL |
| `WEBSITES_PORT` | `8000` | ❌ | Same in both environments |
| `POSTGRES_SERVER` | `p-qzcrft-psql.postgres.database.azure.com` | ❌ | Same server |
| `POSTGRES_PORT` | `5432` | ❌ | Same |
| `POSTGRES_USER` | `sqladmin` | ❌ | Same user |
| `POSTGRES_SSLMODE` | `require` | ❌ | Same |
| `PROJECT_NAME` | `QuizCrafter` | ❌ | Same |
| `WEB_CONCURRENCY` | `2` | ❌ | Same |
| `MALLOC_ARENA_MAX` | `2` | ❌ | Same — reduces glibc memory fragmentation |
| `WEBSITES_CONTAINER_STOP_TIME_LIMIT` | `300` | ❌ | Same |
| `WEBSITE_VNET_ROUTE_ALL` | `1` | ❌ | Same — both slots need VNet routing |
| `CANVAS_BASE_URL` | KV → `CANVAS-BASE-URL` | ❌ | Same Canvas instance |
| `CANVAS_CLIENT_ID` | KV → `CANVAS-CLIENT-ID` | ❌ | Same Canvas app |
| `CANVAS_CLIENT_SECRET` | KV → `CANVAS-CLIENT-SECRET` | ❌ | Same Canvas app |
| `AZURE_OPENAI_API_KEY` | KV → `AZURE-OPENAI-API-KEY` | ❌ | Same OpenAI resource |
| `AZURE_OPENAI_ENDPOINT` | KV → `AZURE-OPENAI-ENDPOINT` | ❌ | Same |
| `AZURE_OPENAI_API_VERSION` | KV → `AZURE-OPENAI-API-VERSION` | ❌ | Same |
| `DOCKER_REGISTRY_SERVER_URL` | ACR URL | ❌ | Same registry |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `false` | ❌ | Same |

> **Rule of thumb:** If the value is the same in both environments, it is swappable. If it differs (URL, DB name, secret identity), make it slot-sticky.

---

## Regular Backend Deployment Workflow

Use this for every new backend release.

### Step 1: Build and push a new image

```bash
# From the project root
az acr login --name pqzcrftacr

COMMIT_SHA=$(git rev-parse --short HEAD)
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

docker build --platform linux/amd64 \
  -t ${ACR_LOGIN}/quizcrafter-backend:latest \
  -t ${ACR_LOGIN}/quizcrafter-backend:${COMMIT_SHA} \
  ./backend

docker push ${ACR_LOGIN}/quizcrafter-backend --all-tags
```

### Step 2: Deploy to staging slot

Tell the staging slot to pull the new image. Use the commit SHA tag — not `:latest` — so that a future production restart re-pulls the exact tested image rather than whatever `:latest` points to at that moment.

```bash
az webapp config set \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|pqzcrftacr-afb8abgzafb6fxf5.azurecr.io/quizcrafter-backend:${COMMIT_SHA}"

az webapp restart \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging
```

### Step 3: Monitor startup and migrations

```bash
# Tail logs — watch for migration output and FastAPI startup message
az webapp log tail \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging
# Press Ctrl+C when you see "Application startup complete"
```

### Step 4: Verify staging slot health

```bash
STAGING_URL="https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net"

curl -s "${STAGING_URL}/utils/health-check/"
# Expected: true

curl -s "${STAGING_URL}/utils/health-check/ready"
# Expected: {"status":"ok","db":"ok"}

# Optionally: check API docs load
curl -s -o /dev/null -w "%{http_code}" "${STAGING_URL}/docs"
# Expected: 200
```

Test any new features manually on the staging backend URL.

### Step 5: Swap to production

When satisfied with staging:

```bash
az webapp deployment slot swap \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --target-slot production
```

Azure warms up the staging container with production's slot-sticky settings, then atomically switches traffic. The command completes when the swap is done (usually 30–60 seconds).

### Step 6: Verify production

```bash
PROD_URL="https://p-qzcrft-backend-eab9c7dga9d4cxgv.westeurope-01.azurewebsites.net"

curl -s "${PROD_URL}/utils/health-check/"
# Expected: true

curl -s "${PROD_URL}/utils/health-check/ready"
# Expected: {"status":"ok","db":"ok"}
```

After a successful swap the **old production image** is now running in the staging slot, ready to swap back if needed.

---

## Regular Frontend Deployment Workflow

The frontend has `VITE_API_URL` baked into the Docker image at build time. Because of this, the workflow uses two image builds: one with the staging backend URL for testing, one with the production backend URL before swapping.

> **Key note on `--build-arg`:** The Dockerfile declares `ARG VITE_API_URL` with **no default value**. When no `--build-arg` is passed, the ARG is unset and Vite reads `frontend/.env.production` (`https://quizcrafter-api.uit.no`). When `--build-arg VITE_API_URL=<value>` is passed, that value overrides `.env.production`. Never pass `--build-arg VITE_API_URL=` (empty string) — Vite treats process env vars as higher priority than `.env` files and would bake the empty string into the bundle.

### Step 1: Build staging image and deploy to staging slot

```bash
# From the project root
az acr login --name pqzcrftacr

ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"
STAGING_BACKEND="https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net"

# Build with staging backend URL baked in
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL="$STAGING_BACKEND" \
  -t ${ACR_LOGIN}/quizcrafter-frontend:staging \
  ./frontend

docker push ${ACR_LOGIN}/quizcrafter-frontend:staging

# Tell staging slot to pull the new image
az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:staging"

az webapp restart --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging
```

### Step 2: Test the staging frontend

Open the staging frontend URL in a browser and verify:

```
https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net
```

Confirm it talks to the staging backend (API calls go to the staging backend URL).

### Step 3: Build production image (before swap)

Once testing is complete, build the image **without** `--build-arg` — Vite will read `frontend/.env.production` and bake in `https://quizcrafter-api.uit.no`. This is the image that will go live.

Use the commit SHA tag — not `:latest` — so that a future production restart re-pulls the exact tested image rather than whatever `:latest` points to at that moment.

```bash
COMMIT_SHA=$(git rev-parse --short HEAD)
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io"

# No --build-arg: Vite reads frontend/.env.production → https://quizcrafter-api.uit.no
docker build --platform linux/amd64 \
  -t ${ACR_LOGIN}/quizcrafter-frontend:latest \
  -t ${ACR_LOGIN}/quizcrafter-frontend:${COMMIT_SHA} \
  ./frontend

docker push ${ACR_LOGIN}/quizcrafter-frontend --all-tags

# Redeploy staging slot with the production image (pinned to commit SHA)
az webapp config set \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:${COMMIT_SHA}"

az webapp restart --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging
```

### Step 4: Swap frontend to production

```bash
az webapp deployment slot swap \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --target-slot production
```

### Step 5: Verify production frontend

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://p-qzcrft-frontend-gjabc8deeeahbjh3.westeurope-01.azurewebsites.net
# Expected: 200

# SPA routing still works
curl -s -o /dev/null -w "%{http_code}" \
  https://p-qzcrft-frontend-gjabc8deeeahbjh3.westeurope-01.azurewebsites.net/login
# Expected: 200
```

---

## Combined Deployment (Backend + Frontend)

When releasing changes to both services together, do the backend swap first so the new API is live before the new frontend. This ensures backward compatibility during the brief window when some users may have cached the old frontend.

```bash
# 1. Build and push backend image
# 2. Deploy and verify backend staging slot
# 3. Swap backend (production now has new API)
az webapp deployment slot swap \
  --name p-qzcrft-backend --resource-group p-qzcrft \
  --slot staging --target-slot production

# 4. Build frontend with production backend URL
# 5. Deploy to frontend staging slot
# 6. Swap frontend
az webapp deployment slot swap \
  --name p-qzcrft-frontend --resource-group p-qzcrft \
  --slot staging --target-slot production
```

---

## Rollback Procedures

### Rollback backend

The previous production image is sitting in the staging slot after a swap. Swap back immediately:

```bash
az webapp deployment slot swap \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --target-slot production
```

> If the issue is a database migration that cannot be reversed, you may need to run `alembic downgrade <revision>` from inside the container before swapping back. For additive-only migrations, the old code will simply ignore new columns.

### Rollback frontend

```bash
az webapp deployment slot swap \
  --name p-qzcrft-frontend \
  --resource-group p-qzcrft \
  --slot staging \
  --target-slot production
```

This puts the old frontend (which points to the old or current production backend) back into production.

### Rollback both (combined)

Swap frontend back first, then backend (reverse order of deployment):

```bash
az webapp deployment slot swap \
  --name p-qzcrft-frontend --resource-group p-qzcrft \
  --slot staging --target-slot production

az webapp deployment slot swap \
  --name p-qzcrft-backend --resource-group p-qzcrft \
  --slot staging --target-slot production
```

---

## Troubleshooting

### Container won't start on staging slot

```bash
# View live logs
az webapp log tail \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging

# Download full logs
az webapp log download \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --log-file /tmp/staging-logs.zip
```

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Container didn't respond to HTTP pings` | `WEBSITES_PORT` not set | Verify `WEBSITES_PORT=8000` on staging slot |
| `ImagePullBackOff` / ACR auth error | Staging identity lacks AcrPull | Check Phase 1 — assign AcrPull to staging slot identity |
| `KeyVaultReferenceError` on any setting | Staging identity lacks KV Secrets User | Check Phase 1 — assign Key Vault role to staging slot identity |
| DB connection refused / timeout | No VNet integration | Check Phase 2 — add VNet integration to staging slot |
| `relation "..." does not exist` | Migrations haven't run | Container likely crashed before `alembic upgrade head` completed; fix root cause and restart |
| `changethis` error on startup | `SECRET_KEY` or `POSTGRES_PASSWORD` not set | Verify Key Vault references resolve (see below) |

### Key Vault references not resolving

```bash
# List settings that contain "KeyVault" — look for any showing the literal reference string instead of a resolved value
az webapp config appsettings list \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "[?contains(value, '@Microsoft.KeyVault')].name" -o tsv
```

If any setting still shows the raw `@Microsoft.KeyVault(...)` string (instead of being resolved), the managed identity cannot access Key Vault. Verify:

```bash
STAGING_IDENTITY=$(az webapp identity show \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query principalId -o tsv)

az role assignment list \
  --assignee "$STAGING_IDENTITY" \
  --query "[].{role:roleDefinitionName}" -o table
```

### Staging slot DB connectivity

```bash
# SSH into staging slot (if VNet integration is configured)
az webapp ssh \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging

# Inside container — test DNS and TCP
nslookup p-qzcrft-psql.postgres.database.azure.com
# Should resolve to a private IP (172.17.x.x), NOT a public Azure IP

python3 -c "import socket; s=socket.create_connection(('p-qzcrft-psql.postgres.database.azure.com', 5432), timeout=5); print('TCP OK'); s.close()"
exit
```

### Swap fails or traffic doesn't switch

```bash
# Check both slots' current state
az webapp show \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --query "{state:state}" -o json

az webapp show \
  --name p-qzcrft-backend \
  --resource-group p-qzcrft \
  --slot staging \
  --query "{state:state}" -o json
```

Both should show `"state": "Running"` before a swap. If the staging slot shows `Stopped` or is failing health checks, Azure will refuse to complete the swap (this is the safety mechanism — it won't swap an unhealthy container into production).

### After a swap: staging has unexpected content

After a swap, the staging slot contains the **old production image**. If you deploy a new test build to staging, it will overwrite that. This is expected behavior.

---

## Quick Reference

### Staging slot URLs

| Endpoint | URL |
|----------|-----|
| Backend staging | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net` |
| Backend health (shallow) | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/` |
| Backend health (deep) | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/utils/health-check/ready` |
| Backend API docs | `https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net/docs` |
| Frontend staging | `https://p-qzcrft-frontend-staging-daatccdfh4f8djcr.westeurope-01.azurewebsites.net` |

### Most-used commands

```bash
# --- DEPLOY ---

# Build and push backend image
COMMIT_SHA=$(git rev-parse --short HEAD) && \
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io" && \
docker build --platform linux/amd64 \
  -t ${ACR_LOGIN}/quizcrafter-backend:latest \
  -t ${ACR_LOGIN}/quizcrafter-backend:${COMMIT_SHA} \
  ./backend && \
docker push ${ACR_LOGIN}/quizcrafter-backend --all-tags

# Deploy backend image to staging slot (pin to commit SHA — not :latest)
az webapp config set \
  --name p-qzcrft-backend --resource-group p-qzcrft --slot staging \
  --linux-fx-version "DOCKER|pqzcrftacr-afb8abgzafb6fxf5.azurecr.io/quizcrafter-backend:${COMMIT_SHA}" && \
az webapp restart --name p-qzcrft-backend --resource-group p-qzcrft --slot staging

# Build frontend for staging testing (VITE_API_URL points to staging backend)
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io" && \
docker build --platform linux/amd64 \
  --build-arg VITE_API_URL="https://p-qzcrft-backend-staging-a0byd6avbhatbgeq.westeurope-01.azurewebsites.net" \
  -t ${ACR_LOGIN}/quizcrafter-frontend:staging ./frontend && \
docker push ${ACR_LOGIN}/quizcrafter-frontend:staging && \
az webapp config set \
  --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:staging" && \
az webapp restart --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging

# Build frontend for production (before swap — no --build-arg, uses frontend/.env.production)
# Pin to commit SHA — not :latest — so a production restart re-pulls the exact tested image
ACR_LOGIN="pqzcrftacr-afb8abgzafb6fxf5.azurecr.io" && \
COMMIT_SHA=$(git rev-parse --short HEAD) && \
docker build --platform linux/amd64 \
  -t ${ACR_LOGIN}/quizcrafter-frontend:latest \
  -t ${ACR_LOGIN}/quizcrafter-frontend:${COMMIT_SHA} ./frontend && \
docker push ${ACR_LOGIN}/quizcrafter-frontend --all-tags && \
az webapp config set \
  --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging \
  --linux-fx-version "DOCKER|${ACR_LOGIN}/quizcrafter-frontend:${COMMIT_SHA}" && \
az webapp restart --name p-qzcrft-frontend --resource-group p-qzcrft --slot staging

# --- SWAP ---

# Swap backend to production
az webapp deployment slot swap \
  --name p-qzcrft-backend --resource-group p-qzcrft \
  --slot staging --target-slot production

# Swap frontend to production
az webapp deployment slot swap \
  --name p-qzcrft-frontend --resource-group p-qzcrft \
  --slot staging --target-slot production

# --- MONITOR ---

# Tail staging backend logs
az webapp log tail --name p-qzcrft-backend --resource-group p-qzcrft --slot staging

# Tail production backend logs
az webapp log tail --name p-qzcrft-backend --resource-group p-qzcrft

# SSH into staging backend
az webapp ssh --name p-qzcrft-backend --resource-group p-qzcrft --slot staging

# --- STATUS ---

# Check slot-sticky settings
az webapp config appsettings list \
  --name p-qzcrft-backend --resource-group p-qzcrft --slot staging \
  --query "[?slotSetting==true].name" -o tsv

# Check which image is running on staging
az webapp config show \
  --name p-qzcrft-backend --resource-group p-qzcrft --slot staging \
  --query "linuxFxVersion" -o tsv

# Check which image is running on production
az webapp config show \
  --name p-qzcrft-backend --resource-group p-qzcrft \
  --query "linuxFxVersion" -o tsv
```

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-24 | Claude Code | Initial guide creation |
| 2026-02-26 | Claude Code | Updated Phase 5.3 (WEB_CONCURRENCY=2, MALLOC_ARENA_MAX=2); rewrote Phase 6 for container-based frontend (managed identity + nginx via ACR, removed PM2/zip); updated Phase 8 first-deploy, Slot Settings table, frontend deployment workflow, and Quick Reference to match Step 10 and Step 12 of audit trail |
| 2026-02-26 | Claude Code | Phase 6.2: added `DOCKER_REGISTRY_SERVER_URL` to both staging and production slots (swappable settings must be set on both sides to prevent asymmetry after the first swap; see audit trail issue #3) |
| 2026-02-27 | Claude Code | Backend Step 2, Frontend Step 3, Quick Reference: changed `linuxFxVersion` in staging slot config from `:latest` to `${COMMIT_SHA}` — prevents a production restart from pulling a newer untested image when `:latest` has been updated for a staging build |
