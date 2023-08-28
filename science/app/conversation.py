from typing import List, Optional
from prisma import get_client
from prisma.models import ConversationMessage
from app.constants import MessageType, VarName
from app.typedefs import MessageDict
from app.utils import (
    get_config_variable,
    get_last_conversations,
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


def previous_messages_referenced(
    user_id: Optional[str], question: str, workspace_folder: str = "",  message_type: Optional[int] = None
) -> List[ConversationMessage]:
    """ get any previous messages referenced in the incoming question
    """
    if not user_id:
        return []

    if not message_type:
        message_type = MessageType.user.value

    if message_type == MessageType.plugin.value:
        conversation_count = get_plugin_conversation_lookback()
    else:
        conversation_count = get_chat_conversation_lookback()

    conversations = get_last_conversations(user_id, conversation_count, workspace_folder)
    conversationIds = [conversation.id for conversation in conversations]
    if not conversationIds:
        return []

    # HACK for now this just always says YES include the previous conversations
    # TODO in future this will be wicked smaht and find only the relevant messages
    # from prior in the conversation
    answer = 1
    if answer == 1:
        db = get_client()
        cmsgs = db.conversationmessage.find_many(
            where={"conversationId": {"in": conversationIds}, "type": message_type},
            order={"createdAt": "asc"},
        )
        return cmsgs
    else:
        return []