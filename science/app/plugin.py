import os
import json
import requests

assert requests
from typing import Dict, List
import openai
from app.typedefs import MessageDict


MOCK_OPENAPI = {
    "openapi": "3.0.1",
    "info": {
        "version": "v1",
        "title": "Service Nexus",
        "description": "Endpoints that allow users to execute functions on PolyAPI",
    },
    "servers": [{"url": "https://service-nexus-1a0400cf.develop-k8s.polyapi.io"}],
    "paths": {
        "/functions/api/a43bd64b-1b83-4b4f-824c-441bac050957/execute": {
            "post": {
                "summary": "This API call allows sends SMS messages through Twilio",
                "operationId": "commsMessagingTwilioSendSms",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/commsMessagingTwilioSendSmsBody"
                            }
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "This API call allows sends SMS messages through Twilio's messaging service. The user can specify the number of the recipient as a string using the coutry code as string with no spaces, for example +16504859634, as well as the message body. The respon",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/commsMessagingTwilioSendSmsResponse"
                                }
                            }
                        },
                    }
                },
            }
        }
    },
    "components": {
        "schemas": {
            "commsMessagingTwilioSendSmsBody": {
                "type": "object",
                "properties": {
                    "My_Phone_Number": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["My_Phone_Number", "message"],
            },
            "commsMessagingTwilioSendSmsResponse": {
                "type": "object",
                "description": "response",
                "properties": {
                    "body": {"type": "string"},
                    "from": {"type": "string"},
                },
            },
        }
    },
}


def _get_openapi_spec(plugin_id: str) -> Dict:
    # requests.get()
    # openapi_url = "https://service-nexus-1a0400cf.develop-k8s.polyapi.io/plugins/service-nexus/openapi"
    # resp = requests.get(openapi_url)

    return MOCK_OPENAPI


def _get_body_schema_name(post: Dict) -> str:
    schema_ref: str = post["requestBody"]["content"]["application/json"]["schema"][
        "$ref"
    ]
    schema_name = schema_ref.rsplit("/", 1)[1]
    return schema_name


def openapi_to_openai_functions(openapi: Dict) -> List[Dict]:
    rv = []
    for path, data in openapi["paths"].items():
        post = data["post"]
        func = {"name": post["operationId"], "description": post["summary"]}
        schema_name = _get_body_schema_name(post)
        func["parameters"] = openapi["components"]["schemas"][schema_name]
        rv.append(func)

    return rv


def get_plugin_chat(plugin_id: str, message: str) -> Dict:
    """get the plugin
    get the function ids
    get them from db
    pass them to the first function call
    get back the function call and the args
    figure out the execute path
    hit the execute path
    return the results
    we are going to have a LOT of results
    lets give the function-call invocation
    AND the final results after the function is called
    """
    openapi = _get_openapi_spec(plugin_id)
    functions = openapi_to_openai_functions(openapi)
    messages = [MessageDict(role="user", content=message)]
    resp = openai.ChatCompletion.create(
        model="gpt-4-0613",
        messages=messages,
        functions=functions,
        temperature=0.2,
    )
    print(resp["choices"][0])
    function_call = resp["choices"][0]["message"].get("function_call")
    # TODO pass in this token
    token = os.environ.get('POLY_BEARER_TOKEN', 'FIXME')
    resp = execute_function(token, openapi, function_call)
    return resp


def _get_name_path_map(openapi: Dict) -> Dict:
    rv = {}
    for path, data in openapi["paths"].items():
        print(path, data)
        rv[data["post"]["operationId"]] = path
    return rv


def execute_function(token: str, openapi: Dict, function_call: Dict):
    name_path_map = _get_name_path_map(openapi)
    path = name_path_map[function_call["name"]]
    # TODO figure out how to add preface to path?
    domain = "https://megatronical.pagekite.me"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(domain + path, data=json.loads(function_call['arguments']), headers=headers)
    assert resp.status_code == 201
    return {"answer": "TODO"}