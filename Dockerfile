FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 moneypath && useradd --system --uid 1001 --gid moneypath moneypath
COPY --from=build --chown=moneypath:moneypath /app/.next/standalone ./
COPY --from=build --chown=moneypath:moneypath /app/.next/static ./.next/static
USER moneypath
EXPOSE 3000
CMD ["node", "server.js"]
