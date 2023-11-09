#!/bin/bash
yarn prisma migrate deploy
nohup yarn run start:prod &
cd science
nohup uwsgi --ini ./uwsgi.ini
