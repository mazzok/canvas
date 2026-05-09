# Release GitHub Action & kbhapp Integration

## Overview

Build and publish the canvas application as an arm64 Docker container via GitHub Actions, and integrate it into the kbhapp Docker Compose stack behind the existing nginx proxy.

## Deliverables

### 1. GitHub Action — `canvas/.github/workflows/release.yml`

**Trigger:** Push to `main` branch.

**Steps:**
1. Checkout canvas repo
2. Set up QEMU for arm64 emulation
3. Set up Docker Buildx
4. Log into GHCR using `GITHUB_TOKEN` (requires `packages: write` permission)
5. Build existing `Dockerfile` targeting `linux/arm64` with build arg `VITE_BASE_PATH=/canvas/`
6. Tag as `ghcr.io/mazzok/canvas:latest` and `ghcr.io/mazzok/canvas:<commit-sha>`
7. Push to GHCR

**Key actions used:**
- `actions/checkout@v4`
- `docker/setup-qemu-action@v3`
- `docker/setup-buildx-action@v3`
- `docker/login-action@v3` (registry: `ghcr.io`)
- `docker/build-push-action@v6` (platform: `linux/arm64`)

**No extra secrets required.** `GITHUB_TOKEN` is provided automatically by GitHub Actions and has GHCR push access for the same repo owner.

### 2. Vite Base Path — `canvas/vite.config.ts`

Read `VITE_BASE_PATH` environment variable at build time, defaulting to `/`:

```ts
base: process.env.VITE_BASE_PATH || '/'
```

- Local dev: serves at `/` (unchanged behavior)
- CI build: GitHub Action sets `VITE_BASE_PATH=/canvas/` as a Docker build arg, resulting in the frontend assets being served under `/canvas/`

The Dockerfile passes this through via `ARG VITE_BASE_PATH=/` and `ENV VITE_BASE_PATH=${VITE_BASE_PATH}` so Maven's frontend-maven-plugin picks it up during the build.

### 3. kbhapp Docker Compose — `kbhapp/docker-compose.yml`

Add `canvas-app` service:

```yaml
canvas-app:
  image: ghcr.io/mazzok/canvas:latest
  environment:
    QUARKUS_MONGODB_CONNECTION_STRING: mongodb://mongo-db:27017
    QUARKUS_MONGODB_DATABASE: canvas
    QUARKUS_HTTP_ROOT_PATH: /canvas
    APP_BASE_URL: ${APP_BASE_URL:-http://localhost}/canvas
  depends_on:
    - mongo-db
  restart: always
```

Changes to existing services:
- Add `canvas-app` to nginx's `depends_on` list

No port mapping — canvas is accessed only through nginx. MongoDB connection uses the existing `mongo-db` service (Mongo 4.4.5) with a separate `canvas` database.

### 4. nginx Config — `kbhapp/nginx/config/nginx.conf`

Add location block:

```nginx
location /canvas/ {
    proxy_pass http://canvas-app:8080/canvas/;
}
```

WebSocket support is already configured at server level (lines 10-11 of existing config set `Upgrade` and `Connection` headers). No additional WebSocket configuration needed.

This config change takes effect when the `kigukirschbaumhaus/nginx-proxy` image is next rebuilt from `kbhapp/nginx/Dockerfile`.

## Architecture

```
Internet
  │
  ▼
nginx (port 80)
  ├── /canvas/  →  canvas-app:8080/canvas/
  ├── /api/     →  kbh-mail-services:8080/api/
  ├── /configuration/ → kbh-app-config:8080/...
  └── /abrechnung/, /utilapp/, ... (static files)

canvas-app
  └── mongodb://mongo-db:27017 (database: canvas)

mongo-db (shared, Mongo 4.4.5)
  ├── used by kbh-app-config
  ├── used by kbh-mail-services
  ├── used by kbh-apex-services
  └── used by canvas-app (database: canvas)
```

## Constraints

- **arm64 only:** The target deployment environment runs arm64. No multi-arch build needed.
- **Mongo 4.4.5 compatibility:** Canvas must work with the existing Mongo 4.4.5 instance. Canvas was originally developed against Mongo 7, but the API surface used (basic CRUD) is compatible with 4.4.5.
- **Build time:** QEMU-emulated arm64 builds on GitHub's amd64 runners will be slow (~10-15 minutes). Acceptable for CI.
- **GHCR visibility:** The container package inherits visibility from the repo. If the canvas repo is public, the image is public. If private, the image is private and kbhapp's host needs `docker login ghcr.io` with a PAT that has `read:packages` scope.

## Out of Scope

- Rebuilding and pushing the `kigukirschbaumhaus/nginx-proxy` Docker Hub image (separate workflow)
- Mongo version upgrade
- Custom domain or SSL configuration
- Health checks for canvas-app in docker-compose (can be added later)
