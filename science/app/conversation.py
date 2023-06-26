from typing import Tuple, Dict
from prisma import get_client
from app.completion import general_question

from app.typedefs import ChatGptChoice, MessageDict
from app.utils import create_new_conversation, get_chat_completion, get_last_conversation, store_messages


def conversation_question(user_id: str, question: str) -> Tuple[ChatGptChoice, Dict]:
    conversation = get_last_conversation(user_id)
    if not conversation:
        conversation = create_new_conversation(user_id)
        choice = general_question(user_id, conversation.id, question)
        return choice, {"fallback": True}

    db = get_client()
    cmsgs = db.conversationmessage.find_many(
        where={"conversationId": conversation.id}, order={"createdAt": "asc"}
    )
    messages = [MessageDict(role=cmsg.role, content=cmsg.content) for cmsg in cmsgs]
    question_msg = MessageDict(role="user", content=question)
    messages.append(question_msg)
    resp = get_chat_completion(messages)
    choice = resp["choices"][0]

    # now lets store the question and response for this message!
    answer_msg = choice['message']
    store_messages(user_id, conversation.id, [question_msg, answer_msg])

    return choice, {"todo": "add more stats"}
