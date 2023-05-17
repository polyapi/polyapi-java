# Docker

This folder contains the Dockerfile along with other artifacts to be able to run a locally built container using docker-compose.

> Note that this was built for shell script using Mac.

## Pre-requisites

Docker and docker-compose must be installed. [Click here](https://docs.docker.com/get-docker/) for installation instructions.

## Building the container

To build the container run the following command from the project root folder:

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

Poly will be accessible via `https://localhost` in port `80`. To change this port modify `80:8000` accordingly in the `docker/docker-compose.yaml`.

### Stop docker-compose

To stop docker-compose run:

```zsh
docker-compose --verbose -f docker/docker-compose.yaml down
```

> if started in the foreground simply hit `crl + c`

## Adjust /etc/hosts (optional)

If you want to access poly e.g. via `https://local.polyapi.io` add the following entry in `/etc/hosts`

```bash
127.0.0.1   local.polyapi.io
```
