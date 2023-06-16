#!/usr/bin/env python3
from typing import Dict, Optional, Tuple
from flask import Blueprint, Response, render_template, request, jsonify
from openai.error import OpenAIError, RateLimitError
from app.completion import get_completion_answer
from app.description import get_function_description, get_webhook_description
from app.typedefs import DescInputDto
from app.utils import is_vip_user, log, set_config_variable

bp = Blueprint("views", __name__)


@bp.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/science/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completion`! See the {readme_link} for details"


@bp.route("/function-completion", methods=["POST"])  # type: ignore
def function_completion() -> Dict:
    data: Dict = request.get_json(force=True)
    question: str = data["question"].strip()
    user_id: Optional[str] = data.get("user_id")
    environment_id: Optional[str] = data.get("environment_id")
    assert user_id
    assert environment_id

    resp = get_completion_answer(user_id, environment_id, question)

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


@bp.route("/configure", methods=["POST"])
def configure() -> Tuple[str, int]:
    data = request.get_json(force=True)
    name = data["name"]
    value = data["value"]
    try:
        set_config_variable(name, value)
    except ValueError:
        return f"Invalid config variable name: {name}", 400

    return "Configured", 201


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


@bp.route("/fake-plugin")
def fake_plugin():
    return render_template('fake_plugin.html')


@bp.route("/fake-function-execute", methods=["POST"])
def fake_function_execute():
    data = request.get_json(force=True)
    print(data)
    return jsonify({"response": "Message sent!"})
