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

## Running Hashicorp Vault Locally

Run `vault server -dev -dev-root-token-id root`

To setup initially, see here: https://github.com/polyapi/poly-alpha/issues/516#issuecomment-1607810143


## Running the Node Server

This will run the Node server on port 8000:

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Running the Science Server

Head to the [Science Server README](https://github.com/polyapi/poly-alpha/blob/develop/science/README.md) for instructions on how to start your science server!

## Endpoints

`POST /functions/api` - creates Poly API function\
`PUT /webhook/:functionAlias` - creates a webhook handle to be used in an API with `functionAlias` as name of the
listener function\
`PUT /webhook/:context/:functionAlias` - creates a webhook handle to be used in an API with `context.functionAlias` as
name of the listener function\