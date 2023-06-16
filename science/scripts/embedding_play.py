import openai

# blog post: https://openai.com/blog/new-and-improved-embedding-model

# example of code search: https://github.com/openai/openai-cookbook/blob/main/examples/Code_search.ipynb

if __name__ == "__main__":
    resp = openai.Embedding.create(input="hi wrorld", model='text-embedding-ada-002')
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
    print(len(resp['data'][0]['embedding']))
