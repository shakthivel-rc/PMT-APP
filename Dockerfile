# Base Project SPA image.
#
# Builds the Vite bundle, then serves it from nginx. The dev server is deliberately not
# used here: `vite preview` does not apply `server.proxy`, so the SPA would have no way to
# reach the API. nginx reproduces the dev proxy's behaviour — including stripping the
# `/api` prefix — so the same `VITE_API_BASE_URL=/api` default works in both.

# ---------------------------------------------------------------------------- builder ---
# Node 24 is Active LTS (since 2025-10-28); 22 entered maintenance 2025-10-21. Keep this
# in step with `.nvmrc` and the `engines` range in package.json. The runtime stage below
# has no Node at all, so it is unaffected.
FROM node:24-slim AS builder

WORKDIR /app

# package.json + lockfile first: a source-only change then reuses the install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The bundle is static, so the API base URL is baked in at build time. `/api` keeps the
# request same-origin and lets nginx do the routing, which is what avoids CORS entirely.
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---------------------------------------------------------------------------- runtime ---
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, never localhost. nginx.conf says `listen 80`, which binds IPv4 only, but this
# image's /etc/hosts maps localhost to ::1 as well and busybox wget tries ::1 first. Unlike
# curl — which the API image's healthcheck uses, and which retries over IPv4 — wget gives up
# there, so the probe reports "connection refused" against a container that is serving every
# request correctly, and the container sits unhealthy forever while the site works fine.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1
