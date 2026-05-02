# Stage 1: Build ui-react (pnpm + Vite + TanStack Start)
FROM node:20-slim AS ui-builder

WORKDIR /src

RUN npm install -g pnpm

COPY ui-react/package.json ui-react/pnpm-lock.yaml ./ui-react/
RUN cd ui-react && pnpm install --frozen-lockfile

COPY ui-react/ ./ui-react/
RUN cd ui-react && pnpm build

# Stage 2: Install server dependencies with bun
FROM oven/bun:latest AS server-builder

WORKDIR /src

COPY server/package.json server/bun.lock ./server/
RUN cd server && bun install --frozen-lockfile

COPY server/ ./server/
COPY resources/ ./resources/

# Stage 3: Runtime
FROM oven/bun:latest

WORKDIR /src/server

RUN mkdir -p /var/log \
  && apt-get -qq update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION=v0.5.0
RUN wget -q https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz \
  && tar -C /usr/local/bin -xzf dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz \
  && rm dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz

COPY --from=server-builder /src/server /src/server
COPY --from=server-builder /src/resources /src/resources
# ui-react dist/client → server/gui, served by Express at /crux
COPY --from=ui-builder /src/ui-react/dist/client /src/server/gui

ENV NODE_ENV=cicd
ENV HAPI_FHIR_URL=http://fhir:8080/fhir/metadata

EXPOSE 3000

ENTRYPOINT dockerize -wait-retry-interval 5s -timeout 60s -wait $HAPI_FHIR_URL bun run src/app.ts
