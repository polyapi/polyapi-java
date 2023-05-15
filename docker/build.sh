
#!/bin/bash
source .env
docker build \
  -t ghcr.io/polyapi/polyapi:latest \
  -f docker/Dockerfile \
  .