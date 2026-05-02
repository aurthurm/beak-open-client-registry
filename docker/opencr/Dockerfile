FROM node:18-bullseye-slim AS builder

WORKDIR /src

RUN apt-get -qq update \
  && apt-get install -y --no-install-recommends git python3 make g++ wget \
  && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
COPY ui/package*.json ./ui/
COPY resources/ ./resources/

RUN cd server && npm install
RUN cd ui && npm install

COPY server/ ./server/
COPY ui/ ./ui/

RUN cd ui && npm run build

FROM node:18-bullseye-slim

WORKDIR /src/server

RUN mkdir -p /var/log \
  && apt-get -qq update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION=v0.5.0
RUN wget -q https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz \
  && tar -C /usr/local/bin -xzf dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz \
  && rm dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz

COPY --from=builder /src/server /src/server
COPY --from=builder /src/resources /src/resources

ENV NODE_ENV=cicd
ENV HAPI_FHIR_URL=http://fhir:8080/fhir/metadata

EXPOSE 3000

ENTRYPOINT dockerize -wait-retry-interval 5s -timeout 60s -wait $HAPI_FHIR_URL node lib/app.js
