# =============================================================================
# IBMP CRM Frontend — Multi-stage Dockerfile
# =============================================================================
# Stages:
#   deps        — installs node_modules (cached separately for speed)
#   development — CRA dev server with hot-reload
#   builder     — production build (npm run build)
#   production  — nginx serving the static build
# =============================================================================

# ── Shared node_modules layer ─────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline


# ── Development stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Source is bind-mounted at runtime for hot-reload
COPY . .

EXPOSE 3000

ENV CI=false
CMD ["npm", "start"]


# ── Production build stage ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG REACT_APP_API_URL=https://ibmpcrm-api.onrender.com
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV CI=false

RUN npm run build


# ── Production nginx stage ────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config optimised for React SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the React build output
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
