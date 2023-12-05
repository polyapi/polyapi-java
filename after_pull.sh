#!/bin/bash
set -e
docker start redis 2>/dev/null || docker run --name redis -p 6379:6379 -d redis
docker start postgres 2>/dev/null || docker run -e POSTGRES_USER=polyapi -e POSTGRES_PASSWORD=secret --name postgres -p 5432:5432 -d postgres
yarn install
yarn prisma migrate dev
cd science
prisma generate --generator py --schema ../prisma/schema.prisma
cd ..
