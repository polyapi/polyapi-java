from typing import List, Optional
from prisma import get_client
from prisma.models import ConversationMessage
from app.constants import MessageType
from app.typedefs import MessageDict
from app.utils import (
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


def previous_message_referenced(
    user_id: str, question: str
) -> List[ConversationMessage]:
    """ get any previous messages referenced in the incoming question
    """
    conversations = get_last_conversations(user_id, 3)
    conversationIds = [conversation.id for conversation in conversations]
    if not conversationIds:
        return []

    # choice = simple_chatgpt_question(question)
    # try:
    #     answer = int(remove_punctuation(choice["message"]["content"]))
    # except (ValueError, TypeError):
    #     answer = 0

    # HACK for now this just always says YES include the previous conversations
    # TODO in future this will be wicked smaht and find only the relevant messages
    # from prior in the conversation
    answer = 1
    if answer == 1:
        db = get_client()
        cmsgs = db.conversationmessage.find_many(
            where={"conversationId": {"in": conversationIds}, "type": MessageType.user},
            order={"createdAt": "asc"},
        )
        return cmsgs
    else:
        return []