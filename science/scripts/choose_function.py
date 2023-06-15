#!/usr/bin/python3

import openai

library = """
Here are some functions in the Poly API library,

// id: fffd979b-3b03-4093-a79d-e34ebd9eff5a
// type: customFunction
// description: A function which takes a product ID and phone number, looks up the product in shopify, and then send the product url to the phone number via a SMS message using Twilio.
poly.products.shopify.sendProductUrlInSms(productId: number, phoneNumber: string)

// id: ec66c324-80fe-4d9a-a5fa-2f7f38384155
// type: apiFunction
// description: This API call allows sends SMS messages through Twilio's messaging service. The user can specify the number of the recipient as a string using the coutry code as string with no spaces, for example +16504859634, as well as the message body. The response payload returns detailed information about the status of the message, including its unique identifier and any error messages. This function does not require twilio credentials as they are alreayd store server side.
poly.comms.messaging.twilioSendSms(My_Phone_Number: string, message: string)
"""

functions = [
    {
        "name": "choose_function_ids",
        "description": "choose the best function ids to answer the user's question and give a confidence score",
        "parameters": {
            "type": "object",
            "properties": {
                "function_ids": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "confidence_score": {
                                "type": "string",
                                "enum": ["1", "2", "3"],
                            },
                        },
                    },
                }
            },
        },
    },
    {
        "name": "consult_the_poly_holocron",
        "description": "help the user understand how to use poly itself",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "the original question asked by the user",
                }
            }
        }
    },
    {
        "name": "fallback",
        "description": "if no other functions are suitable, call this function!",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "the original question asked by the user",
                }
            },
        },
    },
]


if __name__ == "__main__":
    messages = [
        {
            "role": "user",
            "content": library,
        },
        {
            "role": "user",
            "content": "how do I create a user on Poly?",
        },
    ]
    functions = functions
    resp = openai.ChatCompletion.create(
        model="gpt-4-0613",
        messages=messages,
        functions=functions,
        temperature=0.2,
    )
    print(resp)
    # data = json.loads(resp['choices'][0]['message']['function_call']['arguments'])
    # print(data)
