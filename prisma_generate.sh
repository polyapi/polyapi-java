#!/bin/bash
set -e
prisma generate --generator js --schema ./prisma/schema.prisma
