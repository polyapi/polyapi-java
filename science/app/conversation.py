from typing import List, Optional
from prisma import get_client
from prisma.models import ConversationMessage
from app.constants import VarName
from app.typedefs import MessageDict
from app.utils import (
    get_config_variable,
)


def insert_prev_msgs(
    messages: List[MessageDict], prev_msgs: Optional[List[ConversationMessage]]
) -> None:
    """get the prev msg ids and insert into the MessageDict list"""
    if not prev_msgs:
        return

    # reverse the list then insert each msg at the beginning to maintain order
    for msg in reversed(prev_msgs):
        messages.insert(0, MessageDict(role=msg.role, content=msg.content))


PREVIOUS_INFO_PROMPT = """Answer "1" if the question seems incomplete suggesting the user is referencing information from the preceding conversation.

Answer "0" if not.

Here is the question:

"{}"
"""


def get_plugin_conversation_lookback() -> int:
    var = get_config_variable(VarName.plugin_conversation_lookback)
    return int(var.value) if var else 3


def get_chat_conversation_lookback() -> int:
    var = get_config_variable(VarName.chat_conversation_lookback)
    return int(var.value) if var else 3


def get_recent_messages(
    conversation_id: str, message_type: Optional[int], lookback=3
) -> List[ConversationMessage]:
    db = get_client()
    where = {"conversationId": conversation_id}
    if message_type:
        where["type"] = message_type

    messages = db.conversationmessage.find_many(
        where=where,
        order={"createdAt": "desc"},
        # lookback represents pairs of messages (user+assistant) so we multiply by 2
        take=lookback * 2,
    )

    # flip the sort order to go from start to end
    return sorted(messages, key=lambda m: m.createdAt)
