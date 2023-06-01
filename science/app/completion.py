import json
import copy
import openai
from typing import List, Dict, Optional, Tuple
from prisma import get_client
from prisma.models import ConversationMessage, SystemPrompt

# TODO change to relative imports
from app.typedefs import (
    ChatCompletionResponse,
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
    public_id_to_spec,
    get_public_id,
    log,
    clear_conversation,
    func_path_with_args,
    query_node_server,
    store_message,
)
from app.constants import CHAT_GPT_MODEL


def insert_system_prompt(environment_id: str, messages: List[MessageDict]) -> None:
    """ modify the array in place to insert the system prompt at the beginning!
    """
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


def get_conversations_for_user(user_id: Optional[str]) -> List[ConversationMessage]:
    if not user_id:
        return []

    db = get_client()
    return list(
        db.conversationmessage.find_many(
            where={"userId": user_id}, order={"createdAt": "asc"}
        )
    )


def log_matches(question: str, type: str, matches: int, total: int):
    log(f"{type}: {matches} out of {total} matched: {question}")


def get_function_options_prompt(
    user_id: str,
    environment_id: str,
    keywords: Optional[ExtractKeywordDto],
) -> Tuple[Optional[MessageDict], StatsDict]:
    """get all matching functions that need to be injected into the prompt"""
    if not keywords:
        return None, {"match_count": 0}

    specs_resp = query_node_server(user_id, environment_id, "specs")
    items: List[SpecificationDto] = specs_resp.json()

    top_matches, stats = get_top_function_matches(items, keywords)

    function_parts: List[str] = []
    webhook_parts: List[str] = []
    for match in top_matches:
        if match["type"] == "webhookHandle":
            webhook_parts.append(spec_prompt(match))
        else:
            function_parts.append(spec_prompt(match))

    content = _join_content(function_parts, webhook_parts)

    if content:
        return {
            "role": "assistant",
            "content": content,
        }, stats
    else:
        return None, stats


def _join_content(function_parts: List[str], webhook_parts: List[str]) -> str:
    function_preface = "Here are some functions in the Poly API library,"
    webhook_preface = "Here are some event handlers in the Poly API library,"
    parts = []
    if function_parts:
        parts.append(function_preface)
        parts += function_parts

    if webhook_parts:
        parts.append(webhook_preface)
        parts += webhook_parts

    return "\n\n".join(parts)


def spec_prompt(match: SpecificationDto) -> str:
    desc = match.get("description", "")
    parts = [
        f"// id: {match['id']}",
        f"// type: {match['type']}",
        f"// description: {desc}",
        func_path_with_args(match),
    ]
    return "\n".join(parts)


def get_chat_completion(
    messages: List[MessageDict], *, temperature=1.0, stage=""
) -> ChatCompletionResponse:
    """send the messages to OpenAI and get a response"""
    stripped = copy.deepcopy(messages)
    for s in stripped:
        # pop off all the data we use internally before sending the messages to OpenAI
        s.pop("function_ids", None)
        s.pop("webhook_ids", None)

    resp: ChatCompletionResponse = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL,
        messages=stripped,
        temperature=temperature,
    )
    if stage:
        parts = [f"STAGE: {stage}"]
        parts.append("PROMPT:")
        parts += [str(s) for s in stripped]
        parts.append("ANSWER:")
        parts.append(str(resp["choices"][0]))
        log("\n".join(parts))

    return resp


BEST_FUNCTION_CHOICE_TEMPLATE = """
Which function can be used to accomplish this user prompt:
%s

Please return just the id of the function in this format:

```
{"id": functionId}
```

If no function is suitable, please return the following:

```
{"id": "none"}
```
"""


def get_best_function_messages(
    user_id: str,
    environment_id: str,
    question: str,
) -> Tuple[List[MessageDict], StatsDict]:
    keywords = extract_keywords(question)
    library, stats = get_function_options_prompt(user_id, environment_id, keywords)
    stats["prompt"] = question

    if not library:
        return [], stats

    question_msg = MessageDict(
        role="user", content=BEST_FUNCTION_CHOICE_TEMPLATE % question
    )
    rv: List[MessageDict] = [library, question_msg]
    insert_system_prompt(environment_id, rv)
    return rv, stats


def get_system_prompt() -> Optional[SystemPrompt]:
    # HACK for now this is just one system-wide
    # but in future there will be multiple types, multiple orgs, etc
    db = get_client()
    system_prompt = db.systemprompt.find_first(order={"createdAt": "desc"})
    return system_prompt


def get_best_function(
    user_id: str, environment_id: str, question: str
) -> Tuple[str, StatsDict]:
    messages, stats = get_best_function_messages(user_id, environment_id, question)
    if not messages:
        # we have no candidate functions whatsoever, abort!
        clear_conversation(user_id)
        return "", stats

    resp = get_chat_completion(messages, stage="get_best_function", temperature=0.2)
    answer_msg = resp["choices"][0]["message"]
    messages.append(answer_msg)

    # HACK just store convo for debugging
    # always clear for now
    clear_conversation(user_id)
    for message in messages:
        store_message(
            user_id,
            message,
        )

    # we tell ChatGPT to send us back "none" if no function matches

    try:
        public_id = _extract_json_from_completion(answer_msg["content"])["id"]
    except Exception as e:
        log(f"invalid function id returned, setting public_id to none: {e}")
        public_id = "none"

    if public_id != "none" and get_public_id(public_id):
        # valid public id, send it back!
        return public_id, stats
    else:
        # we received invalid public id, just send back nothing
        return "", stats


def _extract_json_from_completion(content: str) -> Dict:
    """sometimes OpenAI returns straight JSON, sometimes it gets chatty
    this extracts just the code snippet wrapped in ``` if it is valid JSON
    """
    parts = content.split("```")
    for part in parts:
        try:
            return json.loads(part)
        except json.JSONDecodeError:
            # move on to the next part, hopefully valid JSON!
            pass

    # if we get here we have invalid JSON
    # just reraise last error!
    raise


BEST_FUNCTION_DETAILS_TEMPLATE = """Please be concise.
To import the Poly API Library:
`import poly from 'polyapi'`
Use the following function, and add any additional code you see fit, to answer my question:
{spec_str}
"""
BEST_FUNCTION_QUESTION_TEMPLATE = "My question:\n{question}"


def get_best_function_example(user_id: str, environment_id: str, public_id: str, question: str) -> ChatGptChoice:
    """take in the best function and get OpenAI to return an example of how to use that function"""

    spec = public_id_to_spec(user_id, environment_id, public_id)
    if not spec:
        raise NotImplementedError(
            f"spec doesnt exist for {public_id}? was is somehow deleted?"
        )

    best_function_prompt = BEST_FUNCTION_DETAILS_TEMPLATE.format(
        spec_str=spec_prompt(spec)
    )
    question_prompt = BEST_FUNCTION_QUESTION_TEMPLATE.format(question=question)
    messages = [
        MessageDict(role="user", content=best_function_prompt),
        MessageDict(role="user", content=question_prompt),
    ]
    insert_system_prompt(environment_id, messages)
    resp = get_chat_completion(messages, stage="get_best_function_example")
    return resp["choices"][0]


def get_completion_answer(user_id: str, environment_id: str, question: str) -> Dict:
    best_function_id, stats = get_best_function(user_id, environment_id, question)
    if best_function_id:
        # we found a function that we think should answer this question
        # lets pass ChatGPT the function and ask the question to make this work
        choice = get_best_function_example(user_id, environment_id, best_function_id, question)
    else:
        resp = get_chat_completion(
            [{"role": "user", "content": question}], stage="no_best_function"
        )
        choice = resp["choices"][0]

    answer, hit_token_limit = answer_processing(choice)

    return {"answer": answer, "stats": stats}
