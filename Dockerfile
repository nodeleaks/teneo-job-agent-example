FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD node -e "console.log('OK')" || exit 1

# Run as non-root
RUN addgroup -S agent && adduser -S agent -G agent
USER agent

EXPOSE 8080

CMD ["node", "dist/index.js"]
