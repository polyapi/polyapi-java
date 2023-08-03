import json
import requests

assert requests
from typing import Dict, List
import openai
from prisma import get_client

from app.constants import CHAT_GPT_MODEL
from app.utils import log
from app.typedefs import ChatGptChoice, MessageDict


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
        },
        "/functions/api/83704918-28d0-4c7f-8897-7e27ad291c96/execute": {
            "post": {
                "summary": "Create a new incident in ServiceNow with details like priority, state, short description, impact, urgency, and assignment group. Returns the created incident with its unique identifier (sys_id) and other incident details.",
                "operationId": "serviceNowIncidentsCreate",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/serviceNowIncidentsCreateBody"
                            }
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "Create a new incident in ServiceNow with details like priority, state, short description, impact, urgency, and assignment group. Returns the created incident with its unique identifier (sys_id) and other incident details.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/serviceNowIncidentsCreateResponse"
                                }
                            }
                        },
                    }
                },
            }
        },
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
            "serviceNowIncidentsCreateBody": {
                "type": "object",
                "properties": {
                    "payload": {
                        "type": "object",
                        "properties": {
                            "impact": {"type": "number"},
                            "priority": {"type": "number"},
                            "businessImpact": {"type": "string"},
                            "businessUrgency": {"type": "number"},
                            "businessSeverity": {"type": "number"},
                            "escalationRequest": {"type": "string"},
                        },
                        "required": [
                            "impact",
                            "priority",
                            "businessImpact",
                            "businessUrgency",
                            "businessSeverity",
                            "escalationRequest",
                        ],
                    }
                },
                "required": ["payload"],
            },
            "serviceNowIncidentsCreateResponse": {
                "type": "object",
                "description": "response",
                "properties": {},
            },
        }
    },
}


def _get_openapi_url(plugin_id: int) -> str:
    db = get_client()
    plugin = db.gptplugin.find_unique(
        where={"id": plugin_id}, include={"environment": True}
    )
    if not plugin or not plugin.environment:
        raise NotImplementedError(f"Plugin with id {plugin_id} doesn't exist, how?")
    url = f"https://{plugin.slug}-{plugin.environment.subdomain}.develop-k8s.polyapi.io/plugins/{plugin.slug}/openapi"
    return url


def _get_openapi_spec(plugin_id: int) -> Dict:
    openapi_url = _get_openapi_url(plugin_id)
    resp = requests.get(openapi_url)
    assert resp.status_code == 200
    return resp.json()


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


def get_plugin_chat(api_key: str, plugin_id: int, message: str) -> List[MessageDict]:
    """ chat with a plugin, providing
    """
    openapi = _get_openapi_spec(plugin_id)
    functions = openapi_to_openai_functions(openapi)
    messages = [MessageDict(role="user", content=message)]
    resp = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL,
        messages=messages,
        functions=functions,
        temperature=0.2,
    )
    choice: ChatGptChoice = resp["choices"][0]
    function_call = choice["message"].get("function_call")
    log(choice)
    if function_call:
        # lets execute the function_call and return the results
        function_call = dict(function_call)
        function_call_msg = choice["message"]
        function_msg = execute_function(api_key, openapi, function_call)
        messages.extend([function_call_msg, function_msg])
        resp2 = openai.ChatCompletion.create(
            model=CHAT_GPT_MODEL,
            messages=messages,
            functions=functions,
            temperature=0.2,
        )
        answer_msg = dict(resp2["choices"][0]["message"])
        messages.append(answer_msg)  # type: ignore
        messages = messages[
            1:
        ]  # lets pop off the first question, the user already knows it
        log(messages)
        return messages
    else:
        # no function call, just return OpenAI's answer
        return [choice["message"]]


def _get_name_path_map(openapi: Dict) -> Dict:
    rv = {}
    for path, data in openapi["paths"].items():
        rv[data["post"]["operationId"]] = path
    return rv


def execute_function(api_key: str, openapi: Dict, function_call: Dict) -> MessageDict:
    name_path_map = _get_name_path_map(openapi)
    path = name_path_map[function_call["name"]]
    # TODO figure out how to add preface to path?
    domain = "https://megatronical.pagekite.me"
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.post(
        domain + path, data=json.loads(function_call["arguments"]), headers=headers
    )
    return MessageDict(role="function", name=function_call["name"], content=resp.text)
