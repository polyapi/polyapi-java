import re
import json
from typing import Dict, List, Optional, Tuple
from prisma import get_client
from prisma.models import SystemPrompt, ConversationMessage
from app.constants import QUESTION_TEMPLATE, MessageType
from app.conversation import insert_prev_msgs

# TODO change to relative imports
from app.typedefs import (
    ChatGptChoice,
    ExtractKeywordDto,
    StatsDict,
)
from app.keywords import extract_keywords, get_top_function_matches
from app.typedefs import (
    SpecificationDto,
    MessageDict,
)
from app.utils import (
    create_new_conversation,
    filter_to_real_public_ids,
    get_return_type_properties,
    insert_internal_step_info,
    log,
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


def answer_processing(choice: ChatGptChoice) -> Tuple[str, bool]:
    content = choice["message"]["content"]

    if choice["finish_reason"] == "length":
        # incomplete model output due to max_tokens parameter or token limit
        # let's append a message explaining to the user answer is incomplete
        content += "\n\nTOKEN LIMIT HIT\n\nPoly has hit the ChatGPT token limit for this conversation. Conversation reset. Please try again to see the full answer."
        return content, True

    return content, False


def get_function_options_prompt(
    user_id: str,
    environment_id: str,
    keywords: Optional[ExtractKeywordDto],
) -> Tuple[Optional[MessageDict], StatsDict]:
    """get all matching functions that need to be injected into the prompt"""
    if not keywords:
        return None, {"match_count": 0}

    specs_resp = query_node_server(user_id, environment_id, "specs")
    specs: List[SpecificationDto] = specs_resp.json()

    top_matches, stats = get_top_function_matches(specs, keywords)

    function_parts: List[str] = []
    webhook_parts: List[str] = []
    variable_parts: List[str] = []
    for match in top_matches:
        if match["type"] == "webhookHandle":
            webhook_parts.append(spec_prompt(match))
        elif match["type"] == "serverVariable":
            variable_parts.append(spec_prompt(match))
        else:
            function_parts.append(spec_prompt(match))

    content = _join_content(function_parts, webhook_parts, variable_parts)

    if content:
        return {
            "role": "assistant",
            "content": content,
        }, stats
    else:
        return None, stats


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


def spec_prompt(spec: SpecificationDto, *, include_return_type=False) -> str:
    desc = spec.get("description", "")
    if spec["type"] == "serverVariable":
        path = f"vari.{spec['context']}.{spec['name']}"
    else:
        path = func_path_with_args(spec)

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
            parts.append(f"// returns {return_type}")

    parts.append(path)
    return "\n".join(parts)


BEST_FUNCTION_CHOICE_TEMPLATE = """
Which functions or variables could be invoked as is, if any, to implement this user prompt:

"%s"

Please return only the ids of the functions or variables and their confidence scores, on a scale of 1-3, in this format:

```
[ {"id": "111111-1111-1111-1111-1111111111", "score": 3}, {"id": "222222-2222-2222-2222-222222222", "score": 1} ]
```

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
) -> Tuple[List[MessageDict], StatsDict]:
    keywords = extract_keywords(user_id, conversation_id, question)
    options, stats = get_function_options_prompt(user_id, environment_id, keywords)
    stats["prompt"] = question

    if not options:
        return [], stats

    messages = [
        options,
        MessageDict(role="user", content=BEST_FUNCTION_CHOICE_TEMPLATE % question),
    ]
    insert_system_prompt(messages, environment_id)
    return messages, stats


def get_system_prompt() -> Optional[SystemPrompt]:
    # HACK for now this is just one system-wide
    # but in future there will be multiple types, multiple orgs, etc
    db = get_client()
    system_prompt = db.systemprompt.find_first(order={"createdAt": "desc"})
    return system_prompt


def get_best_functions(
    user_id: str, conversation_id: str, environment_id: str, question: str
) -> Tuple[List[str], StatsDict]:
    messages, stats = get_best_function_messages(
        user_id, conversation_id, environment_id, question
    )
    if not messages:
        # we have no candidate functions whatsoever, abort!
        return [], stats

    resp = get_chat_completion(messages, temperature=0.2)

    # store conversation
    insert_internal_step_info(messages, "STEP 2: GET BEST FUNCTIONS")
    answer_msg = resp["choices"][0]["message"]
    messages.append(answer_msg)
    store_messages(user_id, conversation_id, messages)

    # continue
    public_ids = _extract_ids_from_completion(answer_msg["content"])
    if public_ids:
        # valid public id, send it back!
        rv = filter_to_real_public_ids(public_ids)
        return rv, stats
    else:
        # we received invalid public id, just send back nothing
        return [], stats


def _extract_ids_from_completion(content: str) -> List[str]:
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
            if isinstance(data, dict) and data["score"] != 1:
                # sometimes OpenAI messes up and doesn't put it in a List when there's a single item
                public_ids = [data["id"]]
            else:
                public_ids = [d["id"] for d in data if d["score"] != 1]
            return public_ids
        except Exception as e:
            # OpenAI has returned weird JSON, lets try something else!
            log(f"invalid function ids returned, setting public_id to none: {e}")
            continue

    public_ids = _id_extraction_fallback(content)
    if public_ids:
        return public_ids
    else:
        log("invalid function ids returned, setting public_id to none")
        return []


def _id_extraction_fallback(content: str) -> List[str]:
    return UUID_REGEX.findall(content)


BEST_FUNCTION_DETAILS_TEMPLATE = """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

{spec_str}
"""

BEST_FUNCTION_VARIABLES_TEMPLATE = """Use any combination of the following variables as arguments to those functions:

{variable_str}

Each variable has the following methods:

* .get()  // get the value of the variable
* .onUpdate()  // execute function when the variable is updated
* .update()  // update the value of the variable
* .onServer()  // use the variable inside a poly function to be injected on the poly server at the time of execution
"""


def get_best_function_example(
    user_id: str,
    conversation_id: str,
    environment_id: str,
    public_ids: List[str],
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
) -> ChatGptChoice:
    """take in the best function and get OpenAI to return an example of how to use that function"""

    specs = public_ids_to_specs(user_id, environment_id, public_ids)

    # split them out
    variables = [s for s in specs if s["type"] == "serverVariable"]
    specs = [s for s in specs if s["type"] != "serverVariable"]

    best_functions_prompt = BEST_FUNCTION_DETAILS_TEMPLATE.format(
        spec_str="\n\n".join(
            spec_prompt(spec, include_return_type=True) for spec in specs
        )
    )
    messages = [MessageDict(role="user", content=best_functions_prompt)]

    if variables:
        best_variables_prompt = BEST_FUNCTION_VARIABLES_TEMPLATE.format(
            variable_str="\n\n".join(spec_prompt(v) for v in variables)
        )
        messages.append(MessageDict(role="user", content=best_variables_prompt))

    question_msg = MessageDict(
        role="user", content=QUESTION_TEMPLATE.format(question), type=MessageType.user
    )
    messages.append(question_msg)

    insert_prev_msgs(messages, prev_msgs)
    insert_system_prompt(messages, environment_id)

    resp = get_chat_completion(messages, temperature=0.5)

    # store conversation
    insert_internal_step_info(messages, "STEP 3: GET FUNCTION EXAMPLE")
    rv = resp["choices"][0]
    answer = rv['message']
    answer["type"] = 2
    messages.append(answer)
    store_messages(user_id, conversation_id, messages)

    return rv


def get_completion_answer(
    user_id: str,
    environment_id: str,
    question: str,
    prev_msgs: List[ConversationMessage],
) -> Tuple[Dict, Dict]:
    conversation = create_new_conversation(user_id)
    best_function_ids, stats = get_best_functions(
        user_id, conversation.id, environment_id, question
    )

    if best_function_ids:
        # we found a function that we think should answer this question
        # lets pass ChatGPT the function and ask the question to make this work
        choice = get_best_function_example(
            user_id,
            conversation.id,
            environment_id,
            best_function_ids,
            question,
            prev_msgs,
        )
    else:
        choice = general_question(user_id, conversation.id, question, prev_msgs)

    answer, hit_token_limit = answer_processing(choice)

    return {"answer": answer}, stats  # type: ignore


def simple_chatgpt_question(question: str) -> ChatGptChoice:
    messages = [MessageDict(role="user", content=question)]
    resp = get_chat_completion(messages)
    return resp["choices"][0]


def general_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
) -> ChatGptChoice:
    """ask a general question not related to any Poly-specific functionality"""
    messages = msgs_to_msg_dicts(prev_msgs) + [
        MessageDict(role="user", content=question, type=MessageType.user)
    ]

    resp = get_chat_completion(messages)
    choice = resp["choices"][0]
    answer = choice["message"]
    answer["type"] = MessageType.user
    messages.append(answer)

    insert_internal_step_info(messages, "FALLBACK")
    store_messages(user_id, conversation_id, messages)
    return choice
