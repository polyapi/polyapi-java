import json
from app.completion import simple_chatgpt_question

ROUTER_PROMPT = """
Please categorize the user's question. Here are the categories:

```
{
    "function": "The user is looking for a function or details about a function to address their need",
    "conversation": "The question seems incomplete suggesting the user is referencing information from the preceding conversation",
    "documentation": "The user is looking to understand how to do something specific with the Poly AI assistant",
    "general": "The user is asking a general programming or informational question"
}
```

Please return the category as JSON

For example, if the user asks "How do I get a list of products on shopify?"

You should return `{"category": "function"}` because the user is looking for a function to perform that action.

Here is the question:

%s
"""


def route_question(question: str) -> str:
    prompt = ROUTER_PROMPT % question
    choice = simple_chatgpt_question(prompt)
    content = json.loads(choice['message']['content'])
    return content['category']