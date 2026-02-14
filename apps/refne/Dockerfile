FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace package manifests
COPY package.json package-lock.json turbo.json .npmrc ./
COPY apps/refne/package.json ./apps/refne/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/tiptap-editor/package.json ./packages/tiptap-editor/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all workspace deps
RUN npm ci

# Copy refne app source (no local @repo/* dependencies)
COPY apps/refne ./apps/refne

# Build args for NEXT_PUBLIC_* vars (baked into bundle at build time)
ARG NEXT_PUBLIC_STRAPI_URL
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_STRAPI_URL=${NEXT_PUBLIC_STRAPI_URL}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

# Build Next.js
WORKDIR /app/apps/refne
RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules
# Copy built Next.js app
COPY --from=builder /app/apps/refne/.next ./apps/refne/.next
COPY --from=builder /app/apps/refne/public ./apps/refne/public
COPY --from=builder /app/apps/refne/package.json ./apps/refne/package.json

WORKDIR /app/apps/refne

EXPOSE 3001

CMD ["node_modules/.bin/next", "start", "--port", "3001"]
