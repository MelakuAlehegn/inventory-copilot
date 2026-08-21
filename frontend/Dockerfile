# Frontend image for the Inventory Copilot web app (Next.js standalone).
# Build from the frontend/ dir:
#   docker build -t inventory-copilot-frontend ./frontend
# NEXT_PUBLIC_API_URL is inlined into the client bundle at BUILD time, so pass the real
# backend URL as a build-arg for a deploy:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t ... ./frontend

# --- deps: install node_modules from the lockfile (cached until it changes) ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# React 19 + next-auth beta need the legacy peer resolver (same as local/CI).
RUN npm ci --legacy-peer-deps

# --- build: compile the app into .next/standalone ---
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle; override per environment at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime: just the standalone server + static assets ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone bundles a trimmed node_modules + server.js; static assets are copied separately.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
