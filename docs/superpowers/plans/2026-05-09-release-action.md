# Release GitHub Action & kbhapp Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the canvas app as an arm64 Docker container to GHCR on every push to main, and integrate it into the kbhapp Docker Compose stack behind nginx.

**Architecture:** A GitHub Action in the canvas repo uses QEMU + Buildx to cross-compile an arm64 image and pushes it to `ghcr.io/mazzok/canvas`. The Dockerfile is extended with a build arg for the Vite base path. The kbhapp repo gets a new `canvas-app` service in docker-compose and a new nginx location block.

**Tech Stack:** GitHub Actions, Docker Buildx, QEMU, GHCR, Vite, Quarkus, nginx

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `canvas/.github/workflows/release.yml` | GitHub Action: build arm64 image, push to GHCR |
| Modify | `canvas/Dockerfile` | Add `VITE_BASE_PATH` build arg, pass as env during frontend build |
| Modify | `canvas/frontend/vite.config.ts` | Read `VITE_BASE_PATH` env var for `base` config |
| Modify | `kbhapp/docker-compose.yml` | Add `canvas-app` service, update nginx `depends_on` |
| Modify | `kbhapp/nginx/config/nginx.conf` | Add `/canvas/` location block |

---

### Task 1: Vite base path configuration

**Files:**
- Modify: `canvas/frontend/vite.config.ts`

- [ ] **Step 1: Update vite.config.ts to read VITE_BASE_PATH**

In `frontend/vite.config.ts`, replace the entire file with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
} as any)
```

The only change is adding `base: process.env.VITE_BASE_PATH || '/'` on line 5.

- [ ] **Step 2: Verify local dev is unaffected**

Run: `cd frontend && npx vite build --mode development 2>&1 | head -5`

Expected: Build succeeds. Assets are generated with `/` prefix (default behavior unchanged).

- [ ] **Step 3: Verify VITE_BASE_PATH is respected**

Run: `cd frontend && VITE_BASE_PATH=/canvas/ npx vite build 2>&1 | head -5`

Expected: Build succeeds. If you inspect `dist/index.html`, script/link tags will reference `/canvas/assets/...` instead of `/assets/...`.

- [ ] **Step 4: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat: support VITE_BASE_PATH env var for subpath deployment"
```

---

### Task 2: Dockerfile build arg for base path

**Files:**
- Modify: `canvas/Dockerfile`

- [ ] **Step 1: Add VITE_BASE_PATH build arg to Dockerfile**

Replace the entire `Dockerfile` with:

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build

# Build arg for frontend base path (default: "/" for local dev)
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Copy backend Maven descriptor first (layer cache)
COPY backend/pom.xml backend/pom.xml

# Copy frontend sources (frontend-maven-plugin downloads Node itself)
COPY frontend/package.json frontend/
COPY frontend/index.html frontend/
COPY frontend/vite.config.ts frontend/
COPY frontend/tsconfig*.json frontend/
COPY frontend/eslint.config.js frontend/
COPY frontend/public/ frontend/public/
COPY frontend/src/ frontend/src/

# Copy backend sources
COPY backend/src/ backend/src/

# Build: installs Node, builds React, packages Quarkus
RUN mvn -f backend/pom.xml package -DskipTests

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /build/backend/target/quarkus-app/lib/      /app/lib/
COPY --from=builder /build/backend/target/quarkus-app/*.jar      /app/
COPY --from=builder /build/backend/target/quarkus-app/app/       /app/app/
COPY --from=builder /build/backend/target/quarkus-app/quarkus/   /app/quarkus/
EXPOSE 8080
CMD ["java", "-jar", "/app/quarkus-run.jar"]
```

Changes from original: added `ARG VITE_BASE_PATH=/` and `ENV VITE_BASE_PATH=${VITE_BASE_PATH}` after the `WORKDIR` line. The `ENV` makes it available to the `mvn` build which runs `vite build` via frontend-maven-plugin.

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add VITE_BASE_PATH build arg to Dockerfile"
```

---

### Task 3: GitHub Action workflow

**Files:**
- Create: `canvas/.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create the release workflow**

Create `.github/workflows/release.yml` with:

```yaml
name: Build & Push ARM64 Container

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/arm64
          push: true
          build-args: |
            VITE_BASE_PATH=/canvas/
          tags: |
            ghcr.io/mazzok/canvas:latest
            ghcr.io/mazzok/canvas:${{ github.sha }}
```

**Key points:**
- `permissions.packages: write` grants `GITHUB_TOKEN` access to push to GHCR
- `platforms: linux/arm64` builds only arm64 (no multi-arch)
- `build-args` sets `VITE_BASE_PATH=/canvas/` so the frontend serves under `/canvas/`
- Two tags: `latest` (for docker-compose pulls) and commit SHA (for rollback)

- [ ] **Step 3: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML OK"`

Expected: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Action for arm64 container builds to GHCR"
```

---

### Task 4: kbhapp docker-compose integration

**Files:**
- Modify: `kbhapp/docker-compose.yml` (at `D:/GIT/kbhapp/docker-compose.yml`)

- [ ] **Step 1: Add canvas-app service to docker-compose.yml**

Add the following service block after the `kbh-apex-services` service (after line 61, before `mongo-db`):

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

- [ ] **Step 2: Add canvas-app to nginx depends_on**

Update the nginx service's `depends_on` list (line 11-13) from:

```yaml
    depends_on:
      - kbh-app-config
      - kbh-mail-services
      - kbh-apex-services
```

to:

```yaml
    depends_on:
      - kbh-app-config
      - kbh-mail-services
      - kbh-apex-services
      - canvas-app
```

- [ ] **Step 3: Validate docker-compose syntax**

Run: `cd D:/GIT/kbhapp && docker compose config --quiet 2>&1 && echo "Compose OK" || echo "Compose FAIL"`

Expected: `Compose OK` (or Docker not available — syntax is still validated by reading the file)

- [ ] **Step 4: Commit (in kbhapp repo)**

```bash
cd D:/GIT/kbhapp
git add docker-compose.yml
git commit -m "feat: add canvas-app service from ghcr.io/mazzok/canvas"
```

---

### Task 5: nginx routing for canvas

**Files:**
- Modify: `kbhapp/nginx/config/nginx.conf` (at `D:/GIT/kbhapp/nginx/config/nginx.conf`)

- [ ] **Step 1: Add canvas location block to nginx.conf**

Add the following block after the existing backend routes section (after line 32, the `/info` location block, before the log viewing endpoints):

```nginx
  # ---- CANVAS GAME ----
  location /canvas/ {
      proxy_pass http://canvas-app:8080/canvas/;
  }
```

WebSocket headers (`Upgrade`, `Connection`) are already set at server level (lines 10-11), so no additional WebSocket config is needed.

- [ ] **Step 2: Validate nginx config syntax**

Run: `docker run --rm -v "D:/GIT/kbhapp/nginx/config/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1-alpine nginx -t 2>&1`

Expected: `nginx: configuration file /etc/nginx/nginx.conf syntax is ok`

If Docker is unavailable, visually verify the block is syntactically correct (matching braces, semicolons).

- [ ] **Step 3: Commit (in kbhapp repo)**

```bash
cd D:/GIT/kbhapp
git add nginx/config/nginx.conf
git commit -m "feat: add /canvas/ reverse proxy route to nginx"
```

---

### Task 6: Verify end-to-end (local smoke test)

- [ ] **Step 1: Verify Dockerfile builds locally (amd64, not arm64)**

Run from canvas repo root:

```bash
docker build -t canvas-test --build-arg VITE_BASE_PATH=/canvas/ .
```

Expected: Multi-stage build completes. Maven downloads dependencies, frontend-maven-plugin installs Node, builds React with `/canvas/` base path, Quarkus packages the app.

If Docker is unavailable on this machine, skip this step — the GitHub Action will validate on push to main.

- [ ] **Step 2: Verify the image starts**

```bash
docker run --rm -p 8080:8080 -e QUARKUS_HTTP_ROOT_PATH=/canvas canvas-test
```

Expected: Quarkus starts and logs show it's listening on port 8080 with root path `/canvas`.

If Docker is unavailable, skip — CI will validate.

- [ ] **Step 3: Commit any fixes if needed**

Only if steps 1-2 revealed issues.
