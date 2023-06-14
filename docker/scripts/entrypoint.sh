#!/bin/bash
yarn prisma migrate deploy
yarn run build
nohup yarn run start:prod &
cd science
nohup uwsgi --ini ./uwsgi.ini
