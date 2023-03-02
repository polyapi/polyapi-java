# Poly Data Science

This Python library contains the code for:

1. Hosting the Python Demo Server - the middleman between the client and OpenAI
2. Training new models on OpenAI

## Server

To start the server, run the following:

```
> cd train
> flask --app server run
< * Running on http://127.0.0.1:5000
```

Then to hit the server, request the following:

```
POST /function_completion/
{"question": "how do I get united flight information for a user?"}
```

The server will build a query based on your question, send it to OpenAI, and return the response.


## Training

This python library will train a new model, upload it to OpenAI, and validate it!

Once we are sure we want to roll out a new model, we simply update the environment variables for the OpenAI model and restart the NodeJS server:

```bash
OPENAI_MODEL="davinci:ft-poly-api-2023-02-25-01-33-45"
OPENAI_TEMPERATURE=0
OPENAI_TOP_P=1
```

## Need Data?

Ok so you have a new hypothesis for how to create a hot new model?

How do you train it?

Our training data currently lives in this Google Sheet

https://docs.google.com/spreadsheets/d/1TwV1uSw3cDrRf8BOBfXMhCd-Wm-m2U8ilhZSuUHKo3s/edit#gid=0

To train using this data:

1. `cd poly-alpha/train`
2. Download as CSV
3. Put the CSV here: `./data/examples.csv`
4. Run `./train_new_model.py`
5. Wait for OpenAI to finish creating the new model:
`openai api fine_tunes.follow -i <fine_tune_id_printed_by_train_new_model.py>`