#!/usr/bin/env python3
import sys
import os
import json
import openai
from openai.embeddings_utils import cosine_similarity


DOCS = [
    {
        "name": "Installing VS Code Extension",
        "text": """Installing VS Code Extension
The VS code extension is the UI to access the Poly AI Assistant as well as to see the Poly Tree (which is a hierarchical browsing experience for seeing all the Poly Functions, organized by context). This is only done once per VS code instance, but can be repeated if the user switches environments or wants to upgrade to a newer version of the VS code extension.

To install the Poly API vs Code Plugin, go to the instance specific endpoint to ensure you are getting the right version of the Poly API VS Code Extension.

For example, if your instance URL is https://na1.polyapi.io

Your VS Code plugin will be found at:
https://na1.polyapi.io/vscode/polyapi-vscode-extension.vsix

To install it:
Download the extension from the link above.
go to the VS extensions tab (windows Ctrl+Shift+X)
click on a little button ‘...’ which is called “views and more actions”
Select ‘Install from VSIX…’
Select the downloaded extension and click install

After installing, you can click on the text “TREE” and drag it to another pane, for example the left navigation pane to see a larger version of the tree.""",
    },
    {
        "name": "Making sure dependencies are in order",
        "text": """Building your Client Library
Making sure dependencies are in order

Make sure the user has: the following dependencies installed in the project within VS code they are working in. To make things simpler, instruct the users to use terminal within VS code to check the dependencies:


min version for node.js is 14
min version for ts-node is 5.0.0
tsconfig.json has to have "esModuleInterop": true under compilerOptions

Use your base knowledge to help users make sure they have those dependencies in place.
""",
    },
    {"name": "Installing PolyAPI client code and generating a library",
     "text": """Building Your Client Library
Installing PolyAPI client code and generating a library

After the dependencies are in place, the user can run the command “npm install polyapi”

And after that runs they can run the command “npx poly generate”

It will ask them to input their instance url, which should be something like ‘https://na1.polyapi.io’ – make sure there is no slash at the end of the url and that the https is included

And it will ask for their key, this is something that would have been provided to them by either someone from Poly API corporation who set them up, or their internal Poly Admin who created their user account.
"""},
]

if __name__ == "__main__":
    question = sys.argv[1]

    embedding_ids = set()
    if os.path.isfile("embedding_cache.json"):
        with open("embedding_cache.json", "r") as f:
            embeddings = json.loads(f.read())
            embedding_ids = {e["id"] for e in embeddings}
    else:
        embeddings = []

    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    embeddings = []

    for doc in DOCS:
        resp = openai.Embedding.create(input=doc['text'], model="text-embedding-ada-002")
        print(resp["usage"]["total_tokens"])
        vector = resp["data"][0]["embedding"]
        embeddings.append(
            {
                "name": doc["name"],
                "vector": vector,
            }
        )

    most_similar_name = ""
    max_similarity = -2.0  # similarity is -1 to 1
    for embedding in embeddings:
        embedding["similarity"] = cosine_similarity(query_vector, embedding["vector"])
        if embedding["similarity"] > max_similarity:
            most_similar_name = embedding["name"]
            max_similarity = embedding["similarity"]

    embeddings = sorted(embeddings, key=lambda x: x["similarity"], reverse=True)

    print(question, ":")
    print(most_similar_name)
    print()

    for embedding in embeddings:
        print("{0},{1:.2f}".format(embedding["name"], embedding["similarity"]))

