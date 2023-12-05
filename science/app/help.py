from typing import List, Optional, Union
from openai import Stream
from prisma.models import ConversationMessage
from app.completion import general_question
from app.typedefs import MessageDict


HELP_ANSWER = """Poly conversation special commands

* /functions or /f or no slash command: search functions and variables and use them to answer questions
* /help or /h: list out available commands
* /poly or /p: searches poly documentation
* /docs or /d: searches your company's documentation
* /general or /g: ask general question straight to ChatGPT
* /clear: clear your current conversation and start from scratch!
"""


def help_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
) -> Union[Stream, str]:
    if not question:
        return HELP_ANSWER

    help_prompt = MessageDict(role="user", content=HELP_ANSWER)
    prev_msgs = prev_msgs or []
    prev_msgs.append(help_prompt)  # type: ignore

    resp = general_question(user_id, conversation_id, question, prev_msgs)

    return resp
