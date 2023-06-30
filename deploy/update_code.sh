#!/bin/bash
# run this on server
set -e
cd $HOME/poly-alpha/
git pull
yarn install

# migrate and regenerate the hooks for the npm client
yarn run prisma migrate deploy
yarn run prisma generate --generator js --schema ./prisma/schema.prisma

# regenerate the hooks for the python client
cd science
pip install -r requirements.txt
prisma generate --generator py --schema ../prisma/schema.prisma
cd ..

yarn run build
sudo systemctl restart api.service
sudo systemctl restart science.service
echo 'Waiting for BE...'
sleep 1
sudo systemctl status api.service --no-pager
