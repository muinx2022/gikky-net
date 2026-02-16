FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace package manifests
COPY package.json package-lock.json turbo.json .npmrc ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/tiptap-editor/package.json ./packages/tiptap-editor/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all workspace deps
RUN npm ci

# Copy web app source + shared packages (web depends on @repo/ui and @repo/tiptap-editor)
COPY apps/web ./apps/web
COPY packages ./packages

# Build args for NEXT_PUBLIC_* vars (baked into bundle at build time)
ARG NEXT_PUBLIC_STRAPI_URL
ARG NEXT_PUBLIC_STRAPI_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USE_CUSTOM_UPLOAD
ARG NEXT_PUBLIC_CUSTOM_UPLOAD_ENDPOINT
ARG NEXT_PUBLIC_LEGACY_UPLOAD_ENDPOINT
ARG AUTH_SECRET
ARG NEXTAUTH_URL
ENV NEXT_PUBLIC_STRAPI_URL=${NEXT_PUBLIC_STRAPI_URL}
ENV NEXT_PUBLIC_STRAPI_API_URL=${NEXT_PUBLIC_STRAPI_API_URL}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_USE_CUSTOM_UPLOAD=${NEXT_PUBLIC_USE_CUSTOM_UPLOAD}
ENV NEXT_PUBLIC_CUSTOM_UPLOAD_ENDPOINT=${NEXT_PUBLIC_CUSTOM_UPLOAD_ENDPOINT}
ENV NEXT_PUBLIC_LEGACY_UPLOAD_ENDPOINT=${NEXT_PUBLIC_LEGACY_UPLOAD_ENDPOINT}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

# Build Next.js
WORKDIR /app/apps/web
RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy node_modules (includes workspace symlinks to packages/)
COPY --from=builder /app/node_modules ./node_modules
# Copy built Next.js app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
# Copy packages so workspace symlinks resolve at runtime
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
