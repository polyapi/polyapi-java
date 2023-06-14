
#!/bin/bash
source .env
docker build --progress=plain \
  -t ghcr.io/polyapi/polyapi:latest \
  -f docker/Dockerfile \
  .