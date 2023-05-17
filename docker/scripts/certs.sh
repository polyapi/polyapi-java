#!/bin/bash

FILEPATH=docker/certs
mkdir $FILEPATH
openssl genrsa -out $FILEPATH/polyapi.key 2048
openssl req -new -key $FILEPATH/polyapi.key -out $FILEPATH/polyapi.csr -subj "/CN=*.polyapi.io"
openssl x509 -req -days 365 -in $FILEPATH/polyapi.csr -signkey $FILEPATH/polyapi.key -out $FILEPATH/polyapi.crt