# Stage 1: Build webapp (pnpm + Vite + TanStack Router SPA)
FROM node:20-slim AS ui-builder

WORKDIR /src

RUN npm install -g pnpm

COPY webapp/package.json webapp/pnpm-lock.yaml ./webapp/
RUN cd webapp && pnpm install --frozen-lockfile

COPY webapp/ ./webapp/
RUN cd webapp && pnpm build

# Stage 2: Install server dependencies with pnpm
FROM node:20-slim AS server-builder

WORKDIR /src

RUN npm install -g pnpm

COPY server/package.json server/pnpm-lock.yaml* server/package-lock.json* ./server/
RUN cd server && (pnpm install --no-frozen-lockfile || npm install --legacy-peer-deps)

COPY server/ ./server/
COPY resources/ ./resources/

# Stage 3: Runtime
FROM node:20-slim

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
# webapp dist → server/gui, served by Express at /crux
COPY --from=ui-builder /src/webapp/dist /src/server/gui

ENV NODE_ENV=cicd
ENV HAPI_FHIR_URL=http://fhir:8080/fhir/metadata

EXPOSE 3000

# Install pnpm in runtime
RUN npm install -g pnpm

ENTRYPOINT dockerize -wait-retry-interval 5s -timeout 60s -wait $HAPI_FHIR_URL pnpm start
