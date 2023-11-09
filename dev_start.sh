#!/bin/bash
docker start redis 2>/dev/null || docker run --name redis -p 6379:6379 -d redis
docker start postgres 2>/dev/null || docker run -e POSTGRES_USER=polyapi -e POSTGRES_PASSWORD=secret --name postgres -p 5432:5432 -d postgres
vault server -dev -dev-root-token-id root &
SKIP_KNATIVE=1 yarn run start:dev &
cd science && flask --app app run --debug