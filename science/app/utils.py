import string
from typing import List, Optional
from app.constants import VarName
from app.typedefs import MessageDict, PropertySpecification, SpecificationDto
from prisma import Prisma, get_client, register
from prisma.models import ConversationMessage, ApiFunction, ConfigVariable


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
        if arg["type"].get('properties'):
            properties = [_process_property_spec(p) for p in arg["type"]["properties"]]
            sub_props = ", ".join(properties)
            sub_props = "{" + sub_props + "}"
            return "{name}: {sub_props}".format(name=arg["name"], sub_props=sub_props)
        else:
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


def url_function_path(func: ApiFunction) -> str:
    return f"{func.context}.{func.name}"


def log(*args, **kwargs) -> None:
    print(*args, **kwargs, flush=True)


def store_message(
    user_id: Optional[int], data: MessageDict
) -> Optional[ConversationMessage]:
    if not user_id:
        return None

    db = get_client()
    create_input = {"userId": user_id, "role": data["role"], "content": data["content"]}

    if data.get("function_ids"):
        create_input["functions"] = {
            "create": [{"functionId": fid} for fid in data["function_ids"]]
        }
    if data.get("webhook_ids"):
        create_input["webhooks"] = {
            "create": [{"webhookId": wid} for wid in data["webhook_ids"]]
        }

    rv = db.conversationmessage.create(data=create_input)  # type: ignore
    return rv


def clear_conversation(user_id: int):
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


def is_vip_user(user_id: Optional[int]) -> bool:
    if not user_id:
        return False

    user = get_client().user.find_first(where={"id": user_id})
    return user.vip if user else False


remove_punctuation_translation = str.maketrans("", "", string.punctuation)


def remove_punctuation(s: str) -> str:
    return s.translate(remove_punctuation_translation)
