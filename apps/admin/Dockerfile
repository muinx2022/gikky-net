FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace package manifests
COPY package.json package-lock.json turbo.json .npmrc ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/tiptap-editor/package.json ./packages/tiptap-editor/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all workspace deps
RUN npm ci

# Copy admin app source (no local @repo/* dependencies)
COPY apps/admin ./apps/admin

# Build args for NEXT_PUBLIC_* vars (baked into bundle at build time)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js
WORKDIR /app/apps/admin
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
COPY --from=builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder /app/apps/admin/package.json ./apps/admin/package.json

WORKDIR /app/apps/admin

EXPOSE 3001

CMD ["/app/node_modules/.bin/next", "start", "--port", "3001"]
