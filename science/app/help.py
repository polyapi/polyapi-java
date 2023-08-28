from typing import Generator, List, Optional, Union
from app.completion import general_question

from app.typedefs import MessageDict

from prisma.models import ConversationMessage


HELP_ANSWER = """Poly conversation special commands

* /functions or /f or no slash command: search functions and variables and use them to answer questions
* /help or /h: list out available commands
* /poly or /p or /docs or /d: searches poly documentation
* /general or /g: ask general question straight to ChatGPT
"""


def help_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: Optional[List[ConversationMessage]] = None,
) -> Union[Generator, str]:
    if not question:
        return HELP_ANSWER

    help_prompt = MessageDict(role="user", content=HELP_ANSWER)
    prev_msgs = prev_msgs or []
    prev_msgs.append(help_prompt)  # type: ignore

    resp = general_question(user_id, conversation_id, question, prev_msgs)

    return resp
