#!/bin/bash
source .env
docker build --progress=plain \
  -t polyapi.azurecr.io/polyapi:latest \
  -f docker/Dockerfile \
  .
docker push polyapi.azurecr.io/polyapi