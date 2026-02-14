FROM node:20-alpine

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy workspace package manifests (required for npm workspaces to resolve)
COPY package.json package-lock.json turbo.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/refne/package.json ./apps/refne/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/tiptap-editor/package.json ./packages/tiptap-editor/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all workspace deps
RUN npm ci

# Copy Strapi source + shared packages
COPY apps/api ./apps/api
COPY packages ./packages

# Build Strapi admin panel
WORKDIR /app/apps/api
RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "start"]
