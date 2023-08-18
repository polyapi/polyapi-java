#!/usr/bin/env python3
import json
from typing import Any, Dict, Generator, Optional, Union
from flask import Blueprint, Response, request, jsonify
from openai.error import OpenAIError, RateLimitError
from app.completion import general_question, get_completion_answer
from app.constants import MessageType
from app.conversation import previous_message_referenced
from app.description import (
    get_function_description,
    get_variable_description,
    get_webhook_description,
)
from app.docs import documentation_question, update_vector
from app.help import help_question
from app.plugin import get_plugin_chat
from app.typedefs import DescInputDto, MessageDict, VarDescInputDto
from app.utils import (
    clear_conversations,
    create_new_conversation,
    get_user,
    log,
    redis_get,
    store_messages,
)
from app.router import split_route_and_question

bp = Blueprint("views", __name__)


@bp.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/science/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completion`! See the {readme_link} for details"


@bp.route("/function-completion", methods=["GET"])  # type: ignore
def function_completion() -> Response:
    data: Dict = request.args.to_dict()

    # default to question, fallback to question_uuid
    question: str = data.get("question", "").strip()
    if not question:
        message_uuid = data.get("question_uuid", "").strip()
        question = redis_get(message_uuid)
        if question:
            parsedQuestion = json.loads(question)
            question = parsedQuestion["message"]

    if not question:
        raise NotImplementedError("No question or question_uuid passed!")

    user_id: Optional[str] = data.get("user_id")
    environment_id: Optional[str] = data.get("environment_id")
    assert environment_id
    assert user_id
    user = get_user(user_id)
    if not user:
        return Response(
            {
                "answer": "This key is not assigned to a user, please use a key assigned to a user with the AI Assistant.",
                "stats": {},
            }
        )

    prev_msgs = previous_message_referenced(user_id, question)
    stats: Dict[str, Any] = {"prev_msg_ids": [prev_msg.id for prev_msg in prev_msgs]}

    route, question = split_route_and_question(question)
    stats["route"] = route

    resp: Union[Generator, str] = ""  # either str or streaming completion type
    conversation = create_new_conversation(user_id)
    if route == "function":
        resp = get_completion_answer(
            user_id, conversation.id, environment_id, question, prev_msgs
        )
        # TODO fixme?
        # stats.update(completion_stats)
    elif route == "general":
        resp = general_question(user_id, conversation.id, question, prev_msgs)
    elif route == "help":
        resp = help_question(user_id, conversation.id, question, prev_msgs)
    elif route == "documentation":
        resp = documentation_question(user_id, conversation.id, question, prev_msgs)
        # TODO fixme?
        # stats.update(doc_stats)
    else:
        resp = "unexpected category: {route}"

    if user.vip:
        log(f"VIP USER {user_id}", resp, sep="\n")

    def generate():
        if isinstance(resp, str):
            yield "data: {}\n\n".format(json.dumps({"chunk": resp}))
            # store the final message before exiting
            store_messages(
                user_id,
                conversation.id,
                [
                    MessageDict(
                        role="assistant",
                        content=resp,
                        type=MessageType.user,
                    )
                ],
            )
        else:
            answer_content = ""
            for chunk in resp:
                content = chunk["choices"][0].get("delta", {}).get("content")
                if content is not None:
                    answer_content += content
                    # still have data to send back
                    yield "data: {}\n\n".format(json.dumps({"chunk": content}))
                else:
                    # store the final message before exiting
                    store_messages(
                        user_id,
                        conversation.id,
                        [
                            MessageDict(
                                role="assistant",
                                content=answer_content,
                                type=MessageType.user,
                            )
                        ],
                    )

    return Response(generate(), mimetype="text/event-stream")


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


@bp.route("/plugin-chat", methods=["POST"])
def plugin_chat() -> Response:
    data = request.get_json(force=True)
    resp = get_plugin_chat(data['apiKey'], data['pluginId'], data['message'])
    return jsonify(resp)


@bp.route("/docs/update-vector", methods=["POST"])
def docs_update_vector() -> str:
    data = request.get_json(force=True)
    return update_vector(data["id"])


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
    if isinstance(e, RateLimitError) and str(e).startswith("That model is currently overloaded"):
        # special message for when OpenAI is overloaded
        msg = "OpenAI is overloaded with other requests at the moment. Please wait a few seconds and try your request again!"
    else:
        # just pass along whatever
        msg = "OpenAI Error: {}".format(str(e))
    current_app.log_exception(msg)
    return msg, 500
