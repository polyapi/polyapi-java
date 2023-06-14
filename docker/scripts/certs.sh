#!/bin/bash

FILEPATH=$(pwd)/docker/certs
mkdir $FILEPATH

cat <<EOF > $FILEPATH/openssl.cnf
[ req ]
default_bits       = 2048
distinguished_name = req_distinguished_name
req_extensions     = req_ext

[ req_distinguished_name ]
countryName                 = Country Name (2 letter code)
stateOrProvinceName         = State or Province Name (full name)
localityName               = Locality Name (eg, city)
organizationName           = Organization Name (eg, company)
commonName                 = Common Name (e.g. server FQDN or YOUR name)

[ req_ext ]
subjectAltName = @alt_names

[alt_names]
DNS.1   = polyapi.io
DNS.2   = local.polyapi.io
DNS.3   = registry.polyapi.io
EOF

openssl genrsa -out $FILEPATH/ca.key 2048
openssl req -new -x509 -days 365 -key $FILEPATH/ca.key -subj "/C=CN/ST=GD/L=SZ/O=Poly, Inc./CN=Poly Root CA" -out $FILEPATH/ca.csr
openssl req -newkey rsa:2048 -nodes -keyout $FILEPATH/polyapi.key -subj "/C=CN/ST=GD/L=SZ/O=Poly, Inc./CN=*.polyapi.io" -out $FILEPATH/polyapi.csr -config $FILEPATH/openssl.cnf
openssl x509 -req -extfile $FILEPATH/openssl.cnf -days 365 -in $FILEPATH/polyapi.csr -CA $FILEPATH/ca.csr -CAkey $FILEPATH/ca.key -CAcreateserial -out $FILEPATH/polyapi.crt