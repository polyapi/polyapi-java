#!/usr/bin/env python3
import os
from typing import Any, Dict, Optional
from flask import Blueprint, Response, request, jsonify
from openai.error import OpenAIError, RateLimitError
from app.completion import general_question, get_completion_answer
from app.conversation import previous_message_referenced
from app.description import (
    get_function_description,
    get_variable_description,
    get_webhook_description,
)
from app.docs import documentation_question, update_vector
from app.typedefs import CompletionAnswer, DescInputDto, VarDescInputDto
from app.utils import clear_conversations, create_new_conversation, get_user, log
from app.router import split_route_and_question

bp = Blueprint("views", __name__)


@bp.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/science/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completion`! See the {readme_link} for details"


HELP_ANSWER = """Poly conversation special commands

* /functions or /f or no slash command: search functions and variables and use them to answer question
* /help or /h: list out available commands
* /poly or /p or /docs or /d: searches poly documentation
* /general or /g: ask general question straight to ChatGPT
"""


@bp.route("/function-completion", methods=["POST"])  # type: ignore
def function_completion() -> CompletionAnswer:
    data: Dict = request.get_json(force=True)
    question: str = data["question"].strip()
    user_id: Optional[str] = data.get("user_id")
    environment_id: Optional[str] = data.get("environment_id")
    assert environment_id
    assert user_id
    user = get_user(user_id)
    if not user:
        return {
            "answer": "This key is not assigned to a user, please use a key assigned to a user with the AI Assistant.",
            "stats": {},
        }

    prev_msgs = previous_message_referenced(user_id, question)
    stats: Dict[str, Any] = {"prev_msg_ids": [prev_msg.id for prev_msg in prev_msgs]}

    route, question = split_route_and_question(question)
    stats["route"] = route

    if route == "function":
        resp, completion_stats = get_completion_answer(
            user_id, environment_id, question, prev_msgs
        )
        stats.update(completion_stats)
    elif route == "general":
        conversation = create_new_conversation(user_id)
        choice = general_question(user_id, conversation.id, question, prev_msgs)
        resp = {"answer": choice["message"]["content"]}
    elif route == "help":
        resp = {"answer": HELP_ANSWER}
    elif route == "documentation":
        choice, doc_stats = documentation_question(user_id, question, prev_msgs)
        stats.update(doc_stats)
        resp = {"answer": choice["message"]["content"]}
    else:
        resp = {"answer": f"unexpected category: {route}"}

    if os.environ.get("HOST_URL") == "https://develop-k8s.polyapi.io":
        # only send stats back in develop
        resp["stats"] = stats
    else:
        # TODO maybe put the stats somewhere so we can see them in non-develop?
        resp["stats"] = {}

    if user.vip:
        log(f"VIP USER {user_id}", resp, sep="\n")

    return resp  # type: ignore


@bp.route("/function-description", methods=["POST"])
def function_description() -> Response:
    data: DescInputDto = request.get_json(force=True)
    desc = get_function_description(data)
    log(desc)
    return jsonify(desc)


@bp.route("/webhook-description", methods=["POST"])
def webhook_description() -> Response:
    data: DescInputDto = request.get_json(force=True)
    return jsonify(get_webhook_description(data))


@bp.route("/variable-description", methods=["POST"])
def variable_description() -> Response:
    data: VarDescInputDto = request.get_json(force=True)
    return jsonify(get_variable_description(data))


@bp.route("/docs/update-vector", methods=["POST"])
def docs_update_vector() -> str:
    data = request.get_json(force=True)
    return update_vector(data['id'])


@bp.route("/clear-conversations", methods=["POST"])
def clear_conversations_view() -> str:
    user_id = request.get_json(force=True)["user_id"]
    clear_conversations(user_id)
    return "Conversation Cleared"


@bp.route("/error")
def error():
    raise NotImplementedError("Intentional error successfully triggered!")


@bp.route("/error-rate-limit")
def error_rate_limit():
    raise RateLimitError(
        "That model is currently overloaded with other requests. You can retry your request, or contact us through our help center at help.openai.com if the error persists. (Please include the request ID 1a63543dd9855ee708b9020f73d50a38 in your message."
    )


@bp.errorhandler(OpenAIError)
def handle_open_ai_error(e):
    # now you're handling non-HTTP exceptions only
    from flask import current_app

    if isinstance(e, RateLimitError):
        msg = "OpenAI is overloaded with other requests at the moment. Please wait a few seconds and try your request again!"
    else:
        msg = f"Sadly, OpenAI appears to be down. Please try again later. ({e.__class__.__name__})"
    current_app.log_exception(msg)
    return msg, 500
