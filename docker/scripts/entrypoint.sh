#!/bin/bash
DB="${PRISMA_HOME_DIR}/db/poly.db" 
if [ -f $DB ]; then
    echo "Using existing db at ${DB}"   
else
    echo "Recreating ${DB}"
    yarn prisma migrate deploy
fi
yarn run build
nohup yarn run start:prod &
cd science
nohup flask --app app run --host 0.0.0.0 --debug