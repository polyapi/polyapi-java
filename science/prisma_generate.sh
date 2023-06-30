#!/bin/bash
set -e
prisma generate --generator py --schema ../prisma/schema.prisma
