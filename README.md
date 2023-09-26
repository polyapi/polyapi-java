# Poly API

## Installation

```bash
$ yarn install
```

## Setup the .env file

```bash
# just copy over the template for local development
$ cp .env.template .env
```

## Migrate the DB, Generate Prisma Libraries

```bash
$ ./after_pull.sh
```

## Run Dev Start Script

```bash
$ ./dev_start.sh
```

This script will start:

* Redis
* Postgres
* Vault
* Node Server on 8000
* Flask Server on 5000

## Get your API Key

If this is the first time you are running the server, you probably need your api key! To get it, do this:

```bash
source .env && psql $DATABASE_URL -c 'select key from api_key;'
```

## Test the API Key

To test the API key, copy the api key from the step above and use it to hit the whoami endpoint:

```bash
curl -H "Authorization: Bearer <API_KEY>" localhost:8000/whoami
```
