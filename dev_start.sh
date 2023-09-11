#!/bin/bash
docker start redis 2>/dev/null || docker run --name redis -p 6379:6379 -d redis
vault server -dev -dev-root-token-id root &
SKIP_KNATIVE=1 yarn run start:dev &
cd science && flask --app app run --debug