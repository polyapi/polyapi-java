import os
import json
import requests

assert requests
from typing import Dict, List
import openai
from prisma import get_client

from app.constants import CHAT_GPT_MODEL
from app.typedefs import ChatGptChoice, MessageDict
from app.utils import log


def _get_openapi_url(plugin_id: int) -> str:
    db = get_client()
    plugin = db.gptplugin.find_unique(
        where={"id": plugin_id}, include={"environment": True}
    )
    if not plugin or not plugin.environment:
        raise NotImplementedError(f"Plugin with id {plugin_id} doesn't exist, how?")
    domain = os.environ.get("HOST_URL", "https://na1.polyapi.io").strip("https://")
    url = f"https://{plugin.slug}-{plugin.environment.subdomain}.{domain}/plugins/{plugin.slug}/openapi"
    return url


def _get_openapi_spec(plugin_id: int) -> Dict:
    openapi_url = _get_openapi_url(plugin_id)
    resp = requests.get(openapi_url)
    assert resp.status_code == 200, resp.content
    return resp.json()


def _get_body_schema_name(post: Dict) -> str:
    try:
        schema_ref: str = post["requestBody"]["content"]["application/json"]["schema"][
            "$ref"
        ]
        schema_name = schema_ref.rsplit("/", 1)[1]
    except Exception as e:
        log(f"_get_body_schema_problem:{e}\n{post}")
        return ""
    return schema_name


def openapi_to_openai_functions(openapi: Dict) -> List[Dict]:
    rv = []
    for path, data in openapi["paths"].items():
        post = data["post"]
        func = {"name": post["operationId"], "description": post["summary"]}
        schema_name = _get_body_schema_name(post)
        if schema_name:
            func["parameters"] = openapi["components"]["schemas"][schema_name]
        else:
            # TODO maybe this is a non-schema one?
            func['parameters'] = {"type": "object", "properties": {}}
        rv.append(func)

    return rv


def get_plugin_chat(api_key: str, plugin_id: int, message: str) -> List[MessageDict]:
    """ chat with a plugin
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
    if not choice.get("message"):
        raise NotImplementedError(f"Got weird OpenAI response: {choice}")
    function_call = choice["message"].get("function_call")
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
    # TODO figure out how to switch domains
    # domain = "https://megatronical.pagekite.me"
    domain = os.environ.get("HOST_URL", "https://na1.polyapi.io")
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.post(
        domain + path, data=json.loads(function_call["arguments"]), headers=headers
    )
    return MessageDict(role="function", name=function_call["name"], content=resp.text)
