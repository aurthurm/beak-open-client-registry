#!/usr/bin/env bash
set -ex

scriptDir=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
repoRoot=$( cd "$scriptDir/../.." ; pwd -P )

# build the local OpenCR image from this checkout
docker build --no-cache -f "$repoRoot/docker/opencr/Dockerfile" -t client-registry-opencr:latest "$repoRoot"
