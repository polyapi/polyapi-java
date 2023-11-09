import re
import json
from typing import Generator, List, Optional, Tuple, Union, Dict
from openai.error import InvalidRequestError
from prisma import get_client
from prisma.models import SystemPrompt, ConversationMessage
from app.constants import QUESTION_TEMPLATE, MessageType
from app.conversation import insert_prev_msgs
from app.typedefs import (
    ExtractKeywordDto,
    StatsDict,
)
from app.keywords import extract_keywords, get_top_function_matches
from app.typedefs import (
    SpecificationDto,
    MessageDict,
)
from app.log import log
from app.utils import (
    filter_to_real_public_ids,
    get_return_type_properties,
    get_tenant_openai_key,
    insert_internal_step_info,
    func_path_with_args,
    msgs_to_msg_dicts,
    public_ids_to_specs,
    query_node_server,
    store_messages,
    get_chat_completion,
)

UUID_REGEX = re.compile(
    r"[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"
)


def insert_system_prompt(messages: List[MessageDict], environment_id: str) -> None:
    """modify the array in place to insert the system prompt at the beginning!"""
    # environment_id is unused but in the near future system prompts will be environment specific!
    system_prompt = get_system_prompt()
    if system_prompt and system_prompt.content:
        p = MessageDict(role="system", content=system_prompt.content)
        messages.insert(0, p)


def _rewrite_and_generate_id_map(specs: List[SpecificationDto]) -> Dict[int, str]:
    """this generates an id_map from matches AND rewrites specs to have different, shorter ids
    (the goal of this is to streamline Step 2 and make it faster)
    """
    rv: Dict[int, str] = {}
    for idx, spec in enumerate(specs, start=1):
        rv[idx] = spec["id"]
        # HACK this is technically making spec.id have the wrong type (int not str) but practically it doesn't matter and int is shorter in json than str
        spec["id"] = idx  # type: ignore
    return rv


def get_function_options_prompt(
    user_id: str,
    environment_id: str,
    keywords: Optional[ExtractKeywordDto],
) -> Tuple[Optional[MessageDict], Dict[int, str], StatsDict]:
    """get all matching functions that need to be injected into the prompt"""
    if not keywords:
        return None, {}, {"match_count": 0}

    specs_resp = query_node_server(user_id, environment_id, "specs")
    specs: List[SpecificationDto] = specs_resp.json()

    top_matches, stats = get_top_function_matches(specs, keywords)

    function_parts: List[str] = []
    webhook_parts: List[str] = []
    variable_parts: List[str] = []

    id_map: Dict[int, str] = _rewrite_and_generate_id_map(top_matches)

    for match in top_matches:
        if match["type"] == "webhookHandle":
            webhook_parts.append(spec_prompt(match, include_argument_schema=False))
        elif match["type"] == "serverVariable":
            variable_parts.append(spec_prompt(match, include_argument_schema=False))
        else:
            function_parts.append(spec_prompt(match, include_argument_schema=False))

    content = _join_content(function_parts, webhook_parts, variable_parts)

    if content:
        return (
            {
                "role": "assistant",
                "content": content,
            },
            id_map,
            stats,
        )
    else:
        return None, {}, stats


def _join_content(
    function_parts: List[str], webhook_parts: List[str], variable_parts: List[str]
) -> str:
    function_preface = "Here are some functions in the Poly API library,"
    webhook_preface = "Here are some event handlers in the Poly API library,"
    variable_preface = "Here are some variables from the Poly API library,"
    parts = []
    if function_parts:
        parts.append(function_preface)
        parts += function_parts

    if webhook_parts:
        parts.append(webhook_preface)
        parts += webhook_parts

    if variable_parts:
        parts.append(variable_preface)
        parts += variable_parts

    return "\n\n".join(parts)


def _has_double_data(return_props: Dict) -> bool:
    try:
        return bool(
            return_props.get("data", {})
            .get("schema", {})
            .get("properties", {})
            .get("data")
        )
    except:
        # if there's some data type, just let it go
        # we are catching an edge case here
        return False


def spec_prompt(
    spec: SpecificationDto, *, include_argument_schema=True, include_return_type=False
) -> str:
    desc = spec.get("description", "")
    if spec["type"] == "serverVariable":
        path = f"// secret: {spec['variable']['secret']}\n"  # type: ignore
        path += f"vari.{spec['context']}.{spec['name']}"
    else:
        path = func_path_with_args(
            spec, include_argument_schema=include_argument_schema
        )

    parts = [
        f"// id: {spec['id']}",
        f"// type: {spec['type']}",
        f"// description: {desc}",
    ]
    if include_return_type:
        return_props = get_return_type_properties(spec)
        if return_props:
            return_type = json.dumps(return_props)
            return_type = return_type.replace("\n", " ")
            return_part = f"// returns {return_type}"
            if _has_double_data(return_props):
                # when we have a double `data.data` sometimes OpenAI gets confused
                # and thinks it was a mistake and collapses things to a single `data`
                return_part += "\n// NOTE: please allow `response.data.data...` for this return type"
            parts.append(return_part)

    parts.append(path)
    return "\n".join(parts)


BEST_FUNCTION_CHOICE_TEMPLATE = """
Which functions or variables could be invoked as is, if any, to implement this user prompt:

"%s"

Please return only the ids of the functions or variables and their confidence scores, on a scale of 1-3, in this format:

```
[ {"id": 1, "score": 3}, {"id": 2, "score": 1} ]
```

Do not explain your reasoning.

If no function or variable is suitable, please return the following:

```
[]
```

Here's what each confidence score means, rate it from the bottom up stopping when a match is achieved:

1: Function or variable is similar, but for a different system, resource, or operation and cannot be used as is
2: It might be useful, but would require more investigation to be sure
3: The function or variable can be used as is to address the users prompt.
"""


def get_best_function_messages(
    user_id: str,
    conversation_id: str,
    environment_id: str,
    question: str,
) -> Tuple[List[MessageDict], Dict[int, str], StatsDict]:
    keywords = extract_keywords(user_id, conversation_id, question)
    options, id_map, stats = get_function_options_prompt(
        user_id, environment_id, keywords
    )
    stats["prompt"] = question

    if not options:
        return [], {}, stats

    messages = [
        options,
        MessageDict(role="user", content=BEST_FUNCTION_CHOICE_TEMPLATE % question),
    ]
    insert_system_prompt(messages, environment_id)
    return messages, id_map, stats


def get_system_prompt() -> Optional[SystemPrompt]:
    # HACK for now this is just one system-wide
    # but in future there will be multiple types, multiple orgs, etc
    db = get_client()
    system_prompt = db.systemprompt.find_first(order={"createdAt": "desc"})
    return system_prompt


def get_best_functions(
    user_id: str, conversation_id: str, environment_id: str, question: str
) -> Tuple[List[str], StatsDict]:
    messages, id_map, stats = get_best_function_messages(
        user_id, conversation_id, environment_id, question
    )
    if not messages:
        # we have no candidate functions whatsoever, abort!
        return [], stats

    openai_api_key = get_tenant_openai_key(user_id=user_id)
    answer_msg = get_chat_completion(messages, temperature=0.2, api_key=openai_api_key)
    assert isinstance(answer_msg, str)

    # store conversation
    insert_internal_step_info(messages, "STEP 2: GET BEST FUNCTIONS")
    messages.append(MessageDict(role="assistant", content=answer_msg))
    store_messages(conversation_id, messages)

    # continue
    public_ids = _extract_ids_from_completion(answer_msg, id_map)
    if public_ids:
        # valid public id, send it back!
        rv = filter_to_real_public_ids(public_ids)
        return rv, stats
    else:
        # we received invalid public id, just send back nothing
        return [], stats


def _extract_ids_from_completion(content: str, id_map: Dict[int, str]) -> List[str]:
    """sometimes OpenAI returns straight JSON, sometimes it gets chatty
    this extracts just the code snippet wrapped in ``` if it is valid JSON
    """
    parts = content.split("```")
    for part in parts:
        try:
            data = json.loads(part)
        except json.JSONDecodeError:
            # move on to the next part, hopefully valid JSON!
            continue

        try:
            if isinstance(data, dict):
                # sometimes OpenAI messes up and doesn't put it in a List when there's a single item
                public_ids = [data["id"]] if data["score"] != 1 else []
            else:
                public_ids = [d["id"] for d in data if d["score"] != 1]
            public_ids = _rehydrate_public_ids(public_ids, id_map)
            return public_ids
        except Exception:
            # OpenAI has returned weird JSON, lets log it and move on!
            log("invalid function ids returned, setting public_ids to []")
            return []
    return []


def _rehydrate_public_ids(short_ids: List, id_map: Dict[int, str]) -> List[str]:
    """we shorten to short ids"""
    rv = []
    for short_id in short_ids:
        public_id = id_map.get(short_id)
        if public_id:
            rv.append(public_id)
        else:
            log(
                f"ERROR: we got the short_id {short_id} back but it doesn't map to any uuid. Did OpenAI screw up or did we?"
            )
    return rv


BEST_FUNCTION_DETAILS_TEMPLATE = """To import the Poly API Library:

{import_prompt}

Consider the comments when generating example data.

Use any combination of only the following functions to answer my question:

{spec_str}

{language_prompt}
"""

BEST_FUNCTION_VARIABLES_TEMPLATE = """Use any combination of the following variables as arguments to those functions:

{spec_str}

To import Vari:

{import_prompt}

Each variable has the following methods:

* async .get()  // get the value of the variable
* async .update()  // update the value of the variable
* async .onUpdate()  // execute function when the variable is updated
* .inject()  // use the variable inside a poly function to be injected on the poly server at the time of execution

When passing a variable as an argument to a poly function, please prefer the `inject` method over the `get` method. Inject is more efficient.

If the variable is secret: True, then the variable ONLY has access to the `inject` method.
"""


def get_best_function_example(
    user_id: str,
    conversation_id: str,
    environment_id: str,
    public_ids: List[str],
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
    language: str = "",
) -> Union[Generator, str]:
    """take in the best function and get OpenAI to return an example of how to use that function"""

    specs = public_ids_to_specs(user_id, environment_id, public_ids)

    # split them out
    variables = [s for s in specs if s["type"] == "serverVariable"]
    specs = [s for s in specs if s["type"] != "serverVariable"]

    language_prompt = ""
    if language:
        language_prompt = f"Please provide all code examples in {language}"

    best_functions_prompt = BEST_FUNCTION_DETAILS_TEMPLATE.format(
        import_prompt=_get_function_import_prompt(language),
        spec_str="\n\n".join(
            spec_prompt(spec, include_return_type=True) for spec in specs
        ),
        language_prompt=language_prompt,
    )
    messages = [
        MessageDict(
            role="user", content=best_functions_prompt, type=MessageType.context.value
        )
    ]

    if variables:
        best_variables_prompt = BEST_FUNCTION_VARIABLES_TEMPLATE.format(
            spec_str="\n\n".join(spec_prompt(v) for v in variables),
            import_prompt=_get_variable_import_prompt(language),
        )
        messages.append(
            MessageDict(
                role="user",
                content=best_variables_prompt,
                type=MessageType.context.value,
            )
        )

    question_msg = MessageDict(
        role="user", content=QUESTION_TEMPLATE.format(question), type=MessageType.user
    )
    messages.append(question_msg)

    insert_prev_msgs(messages, prev_msgs)
    insert_system_prompt(messages, environment_id)

    openai_api_key = get_tenant_openai_key(user_id=user_id)
    try:
        resp = get_chat_completion(
            messages, temperature=0.5, stream=True, api_key=openai_api_key
        )
    except InvalidRequestError as e:
        if "maximum content length" in str(e) and prev_msgs:
            log(
                f"InvalidRequestError due to maximum content length: {e}\ntrying again without prev_msgs"
            )
            messages = messages[
                len(prev_msgs) + 1 :
            ]  # let's trim off prev messages and system prompt
            insert_system_prompt(
                messages, environment_id
            )  # let's reinsert system prompt
            resp = get_chat_completion(
                messages, temperature=0.5, stream=True, api_key=openai_api_key
            )  # try again!
        else:
            # cant recover from this error, just move on!
            raise

    # store conversation
    insert_internal_step_info(messages, "STEP 3: GET FUNCTION EXAMPLE")
    store_messages(conversation_id, messages)

    return resp


def _get_function_import_prompt(language: str) -> str:
    if language and language.lower() == "java":
        return "`import io.polyapi.Poly`"
    else:
        return "`import poly from 'polyapi'`"


def _get_variable_import_prompt(language: str) -> str:
    if language and language.lower() == "java":
        return "`import io.polyapi.Vari`"
    else:
        return "`import {vari} from 'polyapi'`"


def get_completion_answer(
    user_id: str,
    conversation_id: str,
    environment_id: str,
    question: str,
    prev_msgs: List[ConversationMessage],
    language: str = "",
) -> Union[Generator, str]:
    best_function_ids, stats = get_best_functions(
        user_id, conversation_id, environment_id, question
    )

    if best_function_ids:
        # we found a function that we think should answer this question
        # lets pass ChatGPT the function and ask the question to make this work
        return get_best_function_example(
            user_id,
            conversation_id,
            environment_id,
            best_function_ids,
            question,
            prev_msgs,
            language,
        )
    else:
        return general_question(user_id, conversation_id, question, prev_msgs)  # type: ignore


def general_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
) -> Union[Generator, str]:
    """ask a general question not related to any Poly-specific functionality"""
    messages = msgs_to_msg_dicts(prev_msgs) + [
        MessageDict(role="user", content=question, type=MessageType.user)
    ]

    openai_api_key = get_tenant_openai_key(user_id=user_id)
    resp = get_chat_completion(messages, stream=True, api_key=openai_api_key)
    store_messages(conversation_id, messages)
    return resp
