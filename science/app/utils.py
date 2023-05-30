import string
import requests
from requests import Response
from flask import current_app
from typing import List, Optional, Union
from app.constants import VarName
from app.typedefs import (
    MessageDict,
    PropertySpecification,
    SpecificationDto,
    AnyFunction,
)
from prisma import Prisma, get_client, register
from prisma.models import ConversationMessage, ConfigVariable, ApiKey


# HACK should have better name
def func_path(func: SpecificationDto) -> str:
    """get the functions path as it will be exposed in the poly library"""
    if func["context"]:
        path = func["context"] + "." + func["name"]
    else:
        path = func["name"]
    return "poly." + path


def _process_property_spec(arg: PropertySpecification) -> str:
    kind = arg["type"]["kind"]
    if kind == "void":
        # seems weird to have a void argument...
        return f"{arg['name']}"
    elif kind == "primitive":
        return f"{arg['name']}: {arg['type']['type']}"
    elif kind == "array":
        item_type = arg["type"]["items"]["type"]
        return "{name}: [{item_type}, {item_type}, ...]".format(
            name=arg["name"], item_type=item_type
        )
    elif kind == "object":
        if arg["type"].get("properties"):
            properties = [_process_property_spec(p) for p in arg["type"]["properties"]]
            sub_props = ", ".join(properties)
            sub_props = "{" + sub_props + "}"
            return "{name}: {sub_props}".format(name=arg["name"], sub_props=sub_props)
        else:
            log(f"WARNING: object with no properties in args - {arg}")
            return "{name}: object".format(name=arg["name"])
    elif kind == "function":
        return f"{arg['name']}: {kind}"
    elif kind == "plain":
        return f"{arg['name']}: {arg['type']['value']}"
    else:
        raise NotImplementedError("unrecognized kind")


def func_args(spec: SpecificationDto) -> List[str]:
    """get the args for a function from the headers and url"""
    arg_strings = []
    func = spec["function"]
    for arg in func["arguments"]:
        arg_strings.append(_process_property_spec(arg))
    return arg_strings


def func_path_with_args(func: SpecificationDto) -> str:
    args = func_args(func)
    return f"{func_path(func)}({', '.join(args)})"


def url_function_path(func: AnyFunction) -> str:
    # HACK AuthProvider doesn't have a true name
    # more like a set of standard function names?
    name = getattr(func, "name", "getToken")
    return f"{func.context}.{name}"


def log(*args, **kwargs) -> None:
    print(*args, **kwargs, flush=True)


def store_message(
    user_id: Optional[str], data: MessageDict
) -> Optional[ConversationMessage]:
    if not user_id:
        return None

    db = get_client()
    create_input = {"userId": user_id, "role": data["role"], "content": data["content"]}

    # FOR NOW IGNORE FUNCTION_IDS AND WEBHOOK_IDS
    # if data.get("function_ids"):
    #     create_input["functions"] = {
    #         "create": [{"functionId": fid} for fid in data["function_ids"]]
    #     }
    # if data.get("webhook_ids"):
    #     create_input["webhooks"] = {
    #         "create": [{"webhookId": wid} for wid in data["webhook_ids"]]
    #     }

    rv = db.conversationmessage.create(data=create_input)  # type: ignore
    return rv


def clear_conversation(user_id: str):
    db = get_client()
    db.functiondefined.delete_many(where={"message": {"userId": user_id}})  # type: ignore
    db.webhookdefined.delete_many(where={"message": {"userId": user_id}})  # type: ignore
    db.conversationmessage.delete_many(where={"userId": user_id})


def get_config_variable(varname: VarName) -> Optional[ConfigVariable]:
    db = get_client()
    rv = db.configvariable.find_first(where={"name": varname.value})  # type: ignore
    return rv


def set_config_variable(name: str, value: str) -> Optional[ConfigVariable]:
    db = get_client()
    if name not in VarName.__members__:
        raise ValueError(f"invalid config variable name: {name}")

    defaults = {"name": name, "value": value}
    var = db.configvariable.upsert(
        where={"name": name}, data={"update": defaults, "create": defaults}  # type: ignore
    )
    return var


def quick_db_connect():
    """handy function to use in ipython to quickly connect to the db
    and register your connection
    """
    db = Prisma()
    db.connect()
    register(db)
    return db


def is_vip_user(user_id: Optional[str]) -> bool:
    if not user_id:
        return False

    user = get_client().user.find_first(where={"id": user_id})
    return user.vip if user else False


remove_punctuation_translation = str.maketrans("", "", string.punctuation)


def remove_punctuation(s: str) -> str:
    return s.translate(remove_punctuation_translation)


def get_public_id(public_id: str) -> Optional[AnyFunction]:
    """check all possible tables for a public uuid
    return the corresponding object if it exists
    """
    db = get_client()
    result: Union[AnyFunction, None]

    result = db.apifunction.find_first(where={"id": public_id})
    if result:
        return result

    result = db.customfunction.find_first(where={"id": public_id})
    if result:
        return result

    result = db.authprovider.find_first(where={"id": public_id})
    if result:
        return result

    result = db.webhookhandle.find_first(where={"id": public_id})
    if result:
        return result

    return None


def get_user_key(user_id: str, environment_id: str) -> Optional[ApiKey]:
    db = get_client()
    return db.apikey.find_first(where={"userId": user_id, "environmentId": environment_id})


def query_node_server(user_id: str, environment_id: str, path: str) -> Response:
    user_key = get_user_key(user_id, environment_id)
    # if not user_key:
    # db = get_client()
    #     # HACK just use the default environment for now
    #     tenant = db.tenant.find_first(where={'name': "poly-trial"})
    #     environment = db.environment.find_first(where={'name': 'default', 'tenantId': tenant.id})
    #     user_key = db.apikey.find_first(where={'environmentId': environment.id})

    if not user_key:
        raise NotImplementedError(f"No user key found for user {user_id} and environment {environment_id}")

    headers = {
        "Content-Type": "application/json",
        "X-PolyApiKey": user_key.key,
        "Accept": "application/poly.function-definition+json",
    }
    base = current_app.config["NODE_API_URL"]
    resp = requests.get(f"{base}/{path}", headers=headers)
    assert resp.status_code == 200, resp.content
    return resp


def public_id_to_spec(user_id: str, environment_id: str, public_id: str) -> Optional[SpecificationDto]:
    specs_resp = query_node_server(user_id, environment_id, "specs")
    items: List[SpecificationDto] = specs_resp.json()
    for item in items:
        if item["id"] == public_id:
            return item
    return None


def camel_case(text: str) -> str:
    text = text.replace("-", " ").replace("_", " ")
    s = text.split()
    if len(s) == 0:
        return ""
    return s[0] + ''.join(i.capitalize() for i in s[1:])