#!/usr/bin/env python3
import json
from typing import Any, Dict, Optional, Union
from flask import Blueprint, Response, request, jsonify
from openai import OpenAIError, RateLimitError, APIError, Stream
from app.completion import general_question, get_completion_answer
from app.constants import MessageType, PerfLogType
from app.conversation import get_chat_conversation_lookback, get_recent_messages
from app.description import (
    get_function_description,
    get_variable_description,
    get_webhook_description,
)
from app.docs import documentation_question, update_vector
from app.help import help_question
from app.log import log_exception
from app.plugin import get_plugin_chat
from app.typedefs import DescInputDto, MessageDict, VarDescInputDto
from app.utils import (
    clear_conversations,
    create_new_conversation,
    get_last_conversation,
    get_user,
    redis_get,
    store_messages,
    verify_required_fields,
)
from app.router import split_route_and_question
from app.perf import PerfLogger

bp = Blueprint("views", __name__)


@bp.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/science/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completion`! See the {readme_link} for details"


@bp.route("/function-completion", methods=["GET"])  # type: ignore
def function_completion() -> Response:
    perf = PerfLogger()
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

    workspace_folder: str = data.get("workspace_folder", "")
    conversation = get_last_conversation(
        user_id=user_id, workspace_folder=workspace_folder
    )
    if conversation:
        prev_msgs = get_recent_messages(
            conversation_id=conversation.id,
            message_types=[MessageType.user.value, MessageType.context.value],
            lookback=get_chat_conversation_lookback(),
        )
    else:
        conversation = create_new_conversation(user_id, workspace_folder)
        prev_msgs = []
    stats: Dict[str, Any] = {"prev_msg_ids": [prev_msg.id for prev_msg in prev_msgs]}

    route, question = split_route_and_question(question)
    stats["route"] = route

    language = data.get("language", "")

    try:
        resp: Union[Stream, str] = ""  # either str or streaming completion type
        if route == "function":
            resp = get_completion_answer(
                user_id, conversation.id, environment_id, question, prev_msgs, language
            )
        elif route == "general":
            resp = general_question(user_id, conversation.id, question, prev_msgs)  # type: ignore
        elif route == "help":
            resp = help_question(user_id, conversation.id, question, prev_msgs)  # type: ignore
        elif route == "tenant_documentation":
            resp = documentation_question(
                user_id,
                conversation.id,
                question,
                prev_msgs,
                docs_tenant_id=user.tenantId,
                openai_tenant_id=user.tenantId,
            )
        elif route == "poly_documentation":
            resp = documentation_question(
                user_id,
                conversation.id,
                question,
                prev_msgs,
                docs_tenant_id=None,
                openai_tenant_id=user.tenantId,
            )
        elif route == "error":
            # mock error for testing
            raise OpenAIError("That model is currently overloaded...")
        else:
            resp = "unexpected category: {route}"
    except Exception as e:
        if isinstance(e, OpenAIError):
            msg = handle_open_ai_error(e)
        else:
            log_exception(e)
            msg = str(e)

        err_data = {"message": msg}

        return Response(
            f"event:error\ndata:{json.dumps(err_data)}\n\n",
            status=200,  # HACK arbitrary error code
            mimetype="text/event-stream",
        )

    def generate():
        if isinstance(resp, str):
            yield "data: {}\n\n".format(json.dumps({"chunk": resp}))
            # store the final message before exiting
            store_messages(
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
            for part in resp:
                content = part.choices[0].delta.content
                if content is not None:
                    answer_content += content
                    # still have data to send back
                    yield "data: {}\n\n".format(json.dumps({"chunk": content}))
                else:
                    # store the final message before exiting
                    store_messages(
                        conversation.id,
                        [
                            MessageDict(
                                role="assistant",
                                content=answer_content,
                                type=MessageType.user,
                            )
                        ],
                    )
                    yield "event:close\ndata:\n\n"

    perf.set_data(
        userId=user_id,
        snippet=question,
        input_length=len(question),
        output_length=0,  # can't really calculate the output length easily, just let it go
        type=_get_perf_log_type(route),
    )
    perf.stop_and_save()
    return Response(generate(), mimetype="text/event-stream")


def _get_perf_log_type(route: str) -> int:
    if route == "function":
        return PerfLogType.science_chat_code.value
    elif route == "general":
        return PerfLogType.science_chat_general.value
    elif route == "help":
        return PerfLogType.science_chat_help.value
    elif route == "documentation":
        return PerfLogType.science_chat_documentation.value
    else:
        # HACK just call it code, we are probably going to error anyway
        return PerfLogType.science_chat_code.value


@bp.route("/function-description", methods=["POST"])
def function_description() -> Response:
    perf = PerfLogger()

    data: DescInputDto = request.get_json(force=True)
    desc = get_function_description(data)
    resp = jsonify(desc)

    perf.set_data(
        snippet=data["url"],
        input_length=len(request.data),
        output_length=int(resp.headers["Content-Length"]),
        type=PerfLogType.science_generate_description.value,
        # TODO pass in userId so we can track that?
    )
    perf.stop_and_save()
    return resp


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
    perf = PerfLogger()

    data = request.get_json(force=True)

    verify_required_fields(
        data, ["apiKey", "apiKeyId", "pluginId", "conversationId", "message"]
    )
    messages = get_plugin_chat(
        data["apiKey"],
        data["apiKeyId"],
        data["pluginId"],
        data["conversationId"],
        data["message"],
    )

    resp = jsonify(messages)
    perf.set_data(
        apiKey=data["apiKey"],
        snippet=data["message"],
        input_length=len(data["message"]),
        output_length=int(resp.headers["Content-Length"]),
        type=PerfLogType.science_api_execute.value,
    )
    perf.stop_and_save()

    return resp


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


@bp.route("/error-api")
def error_api():
    raise APIError(
        "That model is currently overloaded with other requests. You can retry your request, or contact us through our help center at help.openai.com if the error persists. (Please include the request ID 1a63543dd9855ee708b9020f73d50a38 in your message."
    )


@bp.errorhandler(OpenAIError)
def openai_error_view(e):
    # now you're handling non-HTTP exceptions only
    msg = handle_open_ai_error(e)
    return msg, 500


def handle_open_ai_error(e: OpenAIError) -> str:
    # now you're handling non-HTTP exceptions only
    if isinstance(e, RateLimitError) and str(e).startswith(
        "That model is currently overloaded"
    ):
        # special message for when OpenAI is overloaded
        msg = "OpenAI is overloaded with other requests at the moment. Please wait a few seconds and try your request again!"
    else:
        # just pass along whatever
        msg = "OpenAI Error: {}".format(str(e))
    log_exception(msg)
    return msg


@bp.errorhandler(400)
def handle_400(e):
    print(f"400 error desc from science server: {e.description}")
    return e.description, 400


@bp.errorhandler(401)
def handle_401(e):
    return e.description, 401
