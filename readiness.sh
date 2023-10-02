#!/bin/bash

response=$(curl --location "http://localhost:8000/health" \
--header 'Authorization:Bearer $POLY_SUPER_ADMIN_USER_KEY')

status=$(echo "$response" | jq -r .status)

echo $status

if [[ "$status" == "ok" ]]; then
   exit 0 # Success, pod is ready
else
   exit 1 # Failure, pod is not ready
fi
