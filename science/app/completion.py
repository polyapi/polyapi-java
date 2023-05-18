import copy
import requests
import openai
from flask import current_app
from requests import Response
from typing import List, Dict, Optional, Tuple
from prisma import get_client
from prisma.models import ConversationMessage, SystemPrompt

# TODO change to relative imports
from app.typedefs import ChatGptChoice, ChatGptStreamChoice, ExtractKeywordDto, StatsDict
from app.keywords import extract_keywords, get_top_function_matches
from app.typedefs import (
    SpecificationDto,
    MessageDict,
)
from app.utils import (
    log,
    clear_conversation,
    func_path_with_args,
    func_path,
    store_message,
)


def answer_processing(choice: ChatGptChoice, match_count: int) -> Tuple[str, bool]:
    content = choice["delta"]["content"]

    if choice["finish_reason"] == "length":
        # incomplete model output due to max_tokens parameter or token limit
        # let's append a message explaining to the user answer is incomplete
        content += "\n\nTOKEN LIMIT HIT\n\nPoly has hit the ChatGPT token limit for this conversation. Conversation reset. Please try again to see the full answer."
        return content, True

    if match_count:
        return content, False
    else:
        return (
            # f"We weren't able to find any Poly functions to do that.\n\nBeyond Poly, here's what we think:\n\n{content}",
            content,
            False,
        )


def get_completion_or_conversation_answer(user_id: int, question: str) -> Dict:
    messages = get_conversations_for_user(user_id)
    if False and messages:
        return get_conversation_answer(user_id, messages, question)
    else:
        # return get_completion_answer(user_id, question)
        # TODO: for dev purposes only now
        return get_completion_answer(user_id, question)


def get_conversations_for_user(user_id: Optional[int]) -> List[ConversationMessage]:
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


def query_node_server(type: str) -> Response:
    db = get_client()
    user = db.user.find_first(where={"role": "ADMIN"})
    if not user:
        raise NotImplementedError("ERROR: no admin user, cannot access Node API")

    headers = {
        "Content-Type": "application/json",
        "X-PolyApiKey": user.apiKey,
        "Accept": "application/poly.function-definition+json",
    }
    base = current_app.config['NODE_API_URL']
    resp = requests.get(f"{base}/{type}", headers=headers)
    assert resp.status_code == 200, resp.content
    return resp


def get_question_message_dict(question, match_count) -> MessageDict:
    if match_count > 0:
        # let's ask it to give us one of the matching functions!
        question_msg = MessageDict(
            role="user", content="From the Poly API Library, " + question
        )
    else:
        # there are no matches, let's just ask the question to ChatGPT in general
        question_msg = MessageDict(role="user", content=question)
    return question_msg


def get_function_options_prompt(
    keywords: Optional[ExtractKeywordDto],
) -> Tuple[Optional[MessageDict], StatsDict]:
    """get all matching functions that need to be injected into the prompt"""
    if not keywords:
        return None, {"match_count": 0}

    specs_resp = query_node_server("specs")
    items: List[SpecificationDto] = specs_resp.json()

    top_matches, stats = get_top_function_matches(items, keywords)

    function_parts: List[str] = []
    webhook_parts: List[str] = []
    for match in top_matches:
        if match['type'] == "webhookHandle":
            webhook_parts.append(webhook_prompt(match))
        else:
            function_parts.append(
                f"// {match['description']}\n{func_path_with_args(match)}"
            )

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


def webhook_prompt(hook: SpecificationDto) -> str:
    parts = [func_path(hook)]
    # DAN TODO how we get urls?
    urls: List[Dict] = []
    for url in urls:
        if hook["id"] in url:
            continue
        parts.append(f"url: {url}")
    return "\n".join(parts)


def get_conversation_answer(
    user_id: int, messages: List[ConversationMessage], question: str
):
    # prepare payload
    priors: List[MessageDict] = []
    for message in messages:
        priors.append({"role": message.role, "content": message.content})

    new_messages, stats = get_new_conversation_messages(messages, question)

    # get
    try:
        resp = get_chat_completion(priors + new_messages)
    except openai.InvalidRequestError as e:
        # our conversation is probably too long! let's transparently nuke it and start again
        current_app.log_exception(e)  # type: ignore
        clear_conversation(user_id)
        return get_completion_answer(user_id, question)

    answer, hit_token_limit = answer_processing(
        resp["choices"][0], stats["match_count"]
    )

    if hit_token_limit:
        # if we hit the token limit, let's just clear the conversation and start over
        clear_conversation(user_id)
    else:
        # store
        for msg in new_messages:
            store_message(user_id, msg)
        store_message(user_id, {"role": "assistant", "content": answer})

    return answer


def get_new_conversation_messages(
    old_messages: List[ConversationMessage], question: str
) -> Tuple[List[MessageDict], StatsDict]:
    """get all the new messages that should be added to an existing conversation"""
    rv = []

    # old_msg_ids = [m.id for m in old_messages]

    # db = get_client()
    # old_function_ids = {
    #     f.functionPublicId
    #     for f in db.functiondefined.find_many(where={"messageId": {"in": old_msg_ids}})
    # }
    # old_webhook_ids = {
    #     w.webhookPublicId
    #     for w in db.webhookdefined.find_many(where={"messageId": {"in": old_msg_ids}})
    # }

    keywords = extract_keywords(question)

    functions, stats = get_function_options_prompt(keywords)
    stats["prompt"] = question

    if functions:
        rv.append(functions)

    question_msg = get_question_message_dict(question, stats["match_count"])
    rv.append(question_msg)

    return rv, stats


def get_chat_completion(messages: List[MessageDict]) -> Dict:
    """send the messages to OpenAI and get a response"""
    stripped = copy.deepcopy(messages)
    for s in stripped:
        # pop off all the data we use internally before sending the messages to OpenAI
        s.pop("function_ids", None)
        s.pop("webhook_ids", None)

    return openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=stripped,
        stream=True
    )


def get_completion_prompt_messages(
    question: str,
) -> Tuple[List[MessageDict], StatsDict]:
    keywords = extract_keywords(question)
    library, stats = get_function_options_prompt(keywords)
    stats["prompt"] = question

    rv = []

    if library:
        # from the OpenAI docs:
        # gpt-3.5-turbo-0301 does not always pay strong attention to system messages. Future models will be trained to pay stronger attention to system messages.
        # let's try user!
        MessageDict(
            role="user",
            content="Only include actual payload elements and function arguments in the example. Be concise.",
        )
        # rv.append(
        #     MessageDict(
        #         role="user",
        #         content="To import the Poly API library, use `import poly from 'polyapi';`",
        #     )
        # )
        rv.append(library)

    question_msg = get_question_message_dict(question, bool(library))
    rv.append(question_msg)

    system_prompt = get_system_prompt()
    if system_prompt and system_prompt.content:
        rv.insert(0, {"role": "system", "content": system_prompt.content})
    return rv, stats


def get_system_prompt() -> Optional[SystemPrompt]:
    # HACK for now this is just one system-wide
    # but in future there will be multiple types, multiple orgs, etc
    db = get_client()
    system_prompt = db.systemprompt.find_first(order={"createdAt": "desc"})
    return system_prompt


def get_completion_answer(user_id: int, question: str) -> Dict:
    messages, stats = get_completion_prompt_messages(question)
    resp = get_chat_completion(messages)

    return resp

    # for chunk in resp:
    #     print(chunk)
    #     content = chunk["choices"][0].get("delta", {}).get("content")
    #     if content:
    #         print(content)
    #         answer, hit_token_limit = answer_processing(
    #             chunk["choices"][0], stats["match_count"]
    #         )
    #         print(answer)
    #         print(hit_token_limit)
    #         if hit_token_limit:
    #             # if we hit the token limit, let's just clear the conversation and start over
    #             clear_conversation(user_id)
    #         else:
    #             # HACK always clear for now
    #             clear_conversation(user_id)
    #             # TODO this one is for discussion as response come in chunks not as full reply once
    #             for message in messages:
    #                 store_message(
    #                     user_id,
    #                     message,
    #                 )
    #             store_message(user_id, {"role": "assistant", "content": answer})

    # return {"answer": collected_messages, "stats": stats}
