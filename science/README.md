# Poly Data Science

This Python library contains the code for:

1. Hosting the Python Demo Server - the middleman between the client and OpenAI
2. Training new models on OpenAI

## Tests

WARNING running the tests will modify your local db

TODO at some point separate the local test db and the test db

To run tests, run this:

```
docker start postgres 2>/dev/null || docker run -e POSTGRES_USER=polyapi -e POSTGRES_PASSWORD=secret --name postgres -p 5432:5432 -d postgres
DATABASE_URL=postgres://polyapi:secret@localhost/polyapilocal python -m unittest discover
```

All tests are in the `/tests` directory.

Follow the normal rules of naming for the [Python Unit testing framework](https://docs.python.org/3/library/unittest.html).

## Server

### Prerequisites

Please start the Node server first before trying to install/run the DS server.

See the `../README.md` for instructions on how to start the Node server.

### Run Server Locally

To start the server, run the following:

```bash
# requirements
> cd science
> pip install -r requirements.txt

# prisma
> prisma generate --generator py --schema ../prisma/schema.prisma # generates the library for python to access the db
# if you do not have CLI access to prisma, try adding this to your path in your bashrc:
# export PATH=$PATH:$HOME/.local/bin
# and then reopen a new terminal

> ./load_fixtures.py

# server
# local dev default port of node server is 8000
> flask --app app run --debug
< * Running on http://127.0.0.1:5000
```

Then to hit the server, set your OPEN_API_KEY in your environment. For bash, update your `~/.bashrc`:

```
export OPEN_API_KEY=<your_key>
```

And request the following:

```
POST http://localhost:5000/function-completion/
{"question": "how do I get united flight information for a user?", "user_id": 1}
```

The server will build a query based on your question, send it to OpenAI, and return the response.
