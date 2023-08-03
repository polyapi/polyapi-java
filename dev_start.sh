#!/bin/bash
docker run redis:5.0-stretch &
vault server -dev -dev-root-token-id root &
yarn run start:dev &
cd science && flask --app app run --debug