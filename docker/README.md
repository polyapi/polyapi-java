# Docker

This folder contains the Dockerfile along with other artifacts to be able to run a locally built container using docker-compose.

> Note that this was built for shell script using Mac.

## Pre-requisites

Docker and docker-compose must be installed. [Click here](https://docs.docker.com/get-docker/) for installation instructions.

## Building the container

To build the poly container run the following command from the project root folder:

```zsh
./docker/scripts/build.sh 
```

> the output of this command will be a locally built container that can be accessed by docker-compose.

## Create a local cert

In order to be able to access the container via HTTPS, an Nginx reserve proxy container was configured to route calls to the Poly. However Nginx requires a self-signed certificate to support HTTPS access.

To generate a local certificate simply run:

```zsh
./docker/scripts/certs.sh 
```

> this commands will create all required certificates under /docker/certs. An entry was already added to `.gitignore` so the content of this folder is never stored in Github. d

## Start/Stop Docker Compose

### Start docker-compose

To start docker-compose run the following command:

```zsh
docker-compose --verbose -f docker/docker-compose.yaml up -d
```

> this will start docker-compose in the background. To start in the foreground remove `-d`

Poly will be accessible via `https://localhost` in port `8000`. To change this port modify `<new port>:8000` accordingly in the `docker/docker-compose.yaml`.

### Stop docker-compose

To stop docker-compose run:

```zsh
docker-compose --verbose -f docker/docker-compose.yaml down
```

> if started in the foreground simply hit `crl + c`

## Adjust /etc/hosts (optional)

If you want to access poly or the docker registry e.g. via `https://*local*.polyapi.io` add the following entry in `/etc/hosts`

```bash
127.0.0.1   local.polyapi.io registry.polyapi.io
```

### Docker Registry

A docker registry is needed by knative to deploy custom function containers. A docker registry has been added to the docker-compose file and will respond to url `registry.polyapi.io` therefore an entry is needed in `/etc/hosts` as per previous section.

Users and passwords are stored in the `/docker/conf/htpasswd` file. The default user and password is `poly`. This can be changed by running the following command:

```sh
docker run \                                                                              ──(Sun,May28)─┘
  --entrypoint htpasswd \
  httpd:2 -Bbn <user> <password> docker/conf/htpasswd
```

To list all containers pushed to the registry you can run:

```curl
curl --insecure --user poly:poly https://registry.polyapi.io/v2/_catalog
```

 > Using local registry isn't working yet (see error below)  however adding this for future reference.

```bash
┌─(~/Code/poly/hello)─────────────────────────────────────────────────────(lweir@lweir-mac:s027)─┐
└─(10:49:47)──> func deploy                                                 ──(Mon,May29)─┘
   🙌 Function image built: registry.polyapi.io/polyapi/damnworld:latest
Error: failed to get credentials: creating push check transport for registry.polyapi.io failed: Get "https://registry.polyapi.io/v2/": tls: failed to verify certificate: x509: “*.polyapi.io” certificate is not trusted
```

> this could potentially be solved by either finding a way to get `func deploy` to trust a self-signed cert or by using a real trusted CA to sign the cert
