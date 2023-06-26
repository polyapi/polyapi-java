#!/usr/bin/env python3
from typing import Dict, Optional
from flask import Blueprint, Response, request, jsonify
from openai.error import OpenAIError, RateLimitError
from app.completion import general_question, get_completion_answer
from app.conversation import conversation_question
from app.description import get_function_description, get_variable_description, get_webhook_description
from app.docs import documentation_question
from app.typedefs import CompletionAnswer, DescInputDto, VarDescInputDto
from app.utils import create_new_conversation, is_vip_user, log
from app.router import route_question

bp = Blueprint("views", __name__)


@bp.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/science/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completion`! See the {readme_link} for details"


@bp.route("/function-completion", methods=["POST"])  # type: ignore
def function_completion() -> CompletionAnswer:
    data: Dict = request.get_json(force=True)
    question: str = data["question"].strip()
    user_id: Optional[str] = data.get("user_id")
    environment_id: Optional[str] = data.get("environment_id")
    assert user_id
    assert environment_id

    route = route_question(question)
    if route == "function":
        resp = get_completion_answer(user_id, environment_id, question)
    elif route == "general":
        conversation = create_new_conversation(user_id)
        choice = general_question(user_id, conversation.id, question)
        resp = {"answer": choice['message']['content'], "stats": {}}
    elif route == "conversation":
        choice, stats = conversation_question(user_id, question)
        resp = {"answer": choice['message']['content'], "stats": stats}
    elif route == "documentation":
        choice, stats = documentation_question(user_id, question)
        resp = {"answer": choice['message']['content'], "stats": stats}
    else:
        resp = {
            "answer": f"unexpected category: {route}",
            "stats": {
                "todo": "send back more stats!"
            },
        }

    resp['stats']['routing'] = route

    if is_vip_user(user_id):
        log(f"VIP USER {user_id}", resp, sep="\n")

    return resp


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
