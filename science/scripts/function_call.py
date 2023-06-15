#!/usr/bin/python3

import json
import openai


if __name__ == "__main__":
    messages = [
        {
            "role": "user",
            "content": "what is the capitol of sweden? when was it founded?",
        }
    ]
    functions = [
        {
            "name": "return_results",
            "description": "first try to answer the users question. then call this function to return the results",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"},
                    "country": {"type": "string"},
                    "date_founded": {"type": "string"}
                },
            },
            "required": ["city", "country"],
        }
    ]
    resp = openai.ChatCompletion.create(
        model="gpt-4-0613",
        messages=messages,
        functions=functions,
        temperature=0.2,
    )
    print(resp)
    data = json.loads(resp['choices'][0]['message']['function_call']['arguments'])
    print(data)
