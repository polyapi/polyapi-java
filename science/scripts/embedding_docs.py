#!/usr/bin/env python3
import sys
import os
import json
import openai
from openai.embeddings_utils import cosine_similarity
from app.completion import spec_prompt


DOCS = [ ]

if __name__ == "__main__":
    question = sys.argv[1]

    embedding_ids = set()
    if os.path.isfile("embedding_cache.json"):
        with open("embedding_cache.json", "r") as f:
            embeddings = json.loads(f.read())
            embedding_ids = {e['id'] for e in embeddings}
    else:
        embeddings = []

    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    with open('test_set.json', "r") as f:
        FULL_SPECS = json.loads(f.read())

    for spec in FULL_SPECS:
        if spec['id'] in embedding_ids:
            # embedding already in cache! move on!
            pass
        else:
            spec_str = spec_prompt(spec)  # type: ignore
            resp = openai.Embedding.create(input=spec_str, model="text-embedding-ada-002")
            print(resp["usage"]["total_tokens"])
            vector = resp["data"][0]["embedding"]
            embeddings.append(
                {
                    "id": spec["id"],
                    "name": spec['context'] + '.' + spec['name'],
                    "vector": vector,
                }
            )

    with open("embedding_cache.json", "w") as f:
        f.write(json.dumps(embeddings))

    most_similar_name = ""
    max_similarity = -2.0  # similarity is -1 to 1
    for embedding in embeddings:
        embedding["similarity"] = cosine_similarity(query_vector, embedding['vector'])
        if embedding["similarity"] > max_similarity:
            most_similar_name = embedding["name"]
            max_similarity = embedding["similarity"]

    embeddings = sorted(embeddings, key=lambda x: x['similarity'], reverse=True)

    print(question, ":")
    print(most_similar_name)
    print()

    for embedding in embeddings:
        print("{0},{1:.2f}".format(embedding['name'], embedding['similarity']))


# data format
# {
#   "data": [
#     {
#       "embedding": [
#         -0.0108,
#         -0.0107,
#         0.0323,
#         ...
#         -0.0114
#       ],
#       "index": 0,
#       "object": "embedding"
#     }
#   ],
#   "model": "text-embedding-ada-002",
#   "object": "list"
# }
