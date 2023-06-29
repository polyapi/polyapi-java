import copy
import openai
import string
import requests
import numpy as np
from requests import Response
from flask import current_app
from typing import Dict, List, Optional, Union
from app.constants import CHAT_GPT_MODEL, MessageType, VarName
from app.typedefs import (
    ChatCompletionResponse,
    MessageDict,
    PropertySpecification,
    SpecificationDto,
    AnyFunction,
)
from prisma import Prisma, get_client, register
from prisma.models import ConversationMessage, Conversation, ConfigVariable, ApiKey


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
    if func:
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


def insert_internal_step_info(messages: List[MessageDict], step: str) -> None:
    messages.insert(
        0,
        MessageDict(
            role="info", content=f"----- {step} -----", type=MessageType.internal
        ),
    )


def store_messages(
    user_id: str, conversation_id: str, messages: List[MessageDict]
) -> None:
    for message in messages:
        store_message(
            user_id,
            conversation_id,
            message,
        )


def store_message(
    user_id: str, conversation_id: str, data: MessageDict
) -> Optional[ConversationMessage]:
    if not user_id:
        return None

    db = get_client()
    create_input = {
        "userId": user_id,
        "conversationId": conversation_id,
        "role": data["role"],
        "content": data["content"],
    }

    rv = db.conversationmessage.create(data=create_input)  # type: ignore
    return rv


def get_conversations_for_user(user_id: str) -> List[Conversation]:
    db = get_client()
    return list(
        db.conversation.find_many(where={"userId": user_id}, order={"createdAt": "asc"})
    )


def get_last_conversation(user_id: str) -> Optional[Conversation]:
    db = get_client()
    return db.conversation.find_first(
        where={"userId": user_id}, order={"createdAt": "desc"}
    )


def create_new_conversation(user_id: str) -> Conversation:
    assert user_id
    db = get_client()
    return db.conversation.create(data={"userId": user_id})


def clear_conversations(user_id: str) -> None:
    # CURRENTLY UNUSED!
    db = get_client()
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


def filter_to_real_public_ids(public_ids: List[str]) -> List[str]:
    db = get_client()
    real: List[AnyFunction] = []

    real += db.apifunction.find_many(where={"id": {"in": public_ids}})
    real += db.customfunction.find_many(where={"id": {"in": public_ids}})
    real += db.authprovider.find_many(where={"id": {"in": public_ids}})
    real += db.webhookhandle.find_many(where={"id": {"in": public_ids}})
    real += db.variable.find_many(where={"id": {"in": public_ids}})
    real_ids = {r.id for r in real}

    return [pid for pid in public_ids if pid in real_ids]


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
    return db.apikey.find_first(
        where={"userId": user_id, "environmentId": environment_id}
    )


def query_node_server(user_id: str, environment_id: str, path: str) -> Response:
    user_key = get_user_key(user_id, environment_id)
    if not user_key:
        raise NotImplementedError(
            f"No user key found for user {user_id} and environment {environment_id}"
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {user_key.key}",
        "Accept": "application/poly.function-definition+json",
    }
    base = current_app.config["NODE_API_URL"]
    resp = requests.get(f"{base}/{path}", headers=headers)
    assert resp.status_code == 200, resp.content
    return resp


def public_ids_to_specs(
    user_id: str, environment_id: str, public_ids: List[str]
) -> List[SpecificationDto]:
    public_ids_set = set(public_ids)
    specs_resp = query_node_server(user_id, environment_id, "specs")

    items: List[SpecificationDto] = specs_resp.json()
    rv: List[SpecificationDto] = []
    for item in items:
        if item["id"] in public_ids_set:
            rv.append(item)
    return rv


def camel_case(text: str) -> str:
    text = text.replace("-", " ").replace("_", " ")
    s = text.split()
    if len(s) == 0:
        return ""
    return s[0] + "".join(i.capitalize() for i in s[1:])


def get_chat_completion(
    messages: List[MessageDict], *, temperature=1.0
) -> ChatCompletionResponse:
    """send the messages to OpenAI and get a response"""
    stripped = copy.deepcopy(messages)
    stripped = [
        m for m in stripped if m["role"] != "info"
    ]  # info is our internal conversation stats, dont send!
    for s in stripped:
        # remove our internal-use-only fields
        s.pop("type", None)
    resp: ChatCompletionResponse = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL,
        messages=stripped,
        temperature=temperature,
    )
    return resp


def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def set_all_functions_public(password=""):
    if password != "DONT RUN THIS IN PROD":
        raise NotImplementedError("incorrect password, blocking!")

    db = get_client()
    db.apifunction.update_many(
        where={"visibility": "TENANT"}, data={"visibility": "PUBLIC"}
    )
    db.tenant.update_many(
        where={"publicVisibilityAllowed": False}, data={"publicVisibilityAllowed": True}
    )


def get_variables(
    environment_id: str, public_ids: Optional[List[str]] = None
) -> List[SpecificationDto]:
    db = get_client()

    if public_ids:
        vars = db.variable.find_many(
            where={
                "AND": [
                    {"id": {"in": public_ids}},
                    {
                        "OR": [
                            {"environmentId": environment_id},
                            {"visibility": "PUBLIC"},
                        ]
                    },
                ]
            }
        )
    else:
        vars = db.variable.find_many(
            where={"OR": [{"environmentId": environment_id}, {"visibility": "PUBLIC"}]}
        )
    return [
        SpecificationDto(
            id=var.id,
            context=var.context,
            name=var.name,
            description=var.description,
            function=None,
            type="variable",
        )
        for var in vars
    ]


def get_return_type_properties(spec: SpecificationDto) -> Union[Dict, None]:
    if not spec or not spec.get("function", {}).get("returnType"):  # type: ignore
        return None

    return_type = spec.get("function", {}).get("returnType")  # type: ignore
    if not return_type:
        return None

    kind = return_type.get("kind")
    if kind == "object":
        return {"data": return_type.get("schema", {}).get("properties")}
    else:
        return {"data": kind}
