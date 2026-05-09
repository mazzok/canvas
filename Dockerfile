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
