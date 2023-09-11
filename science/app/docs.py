""" search the poly docs for the suitable passage
then pass it to ChatGPT
then return the response
"""
import os
import json
from typing import Dict, Generator, List, Optional, Union
import openai
from prisma import get_client
from prisma.models import ConversationMessage, DocSection
from app.constants import QUESTION_TEMPLATE, MessageType
from app.typedefs import MessageDict
from app.utils import (
    cosine_similarity,
    get_chat_completion,
    msgs_to_msg_dicts,
    store_messages,
)

DOC_PROMPT = """
The following documentation helps users understand how to use Poly API a.k.a “Poly” or “PolyAPI” or “Poly AI Assistant”

This documentation was written for the purpose of an AI agent to consume it. Note there are hints to the AI agent included in the document using this notation: <<this is a hint to the AI>>. Feel free to use your own knowledge to elaborate these points where hints are included.

%s

%s

---

Answer the following question using markdown to format.
Please provide generous spacing between sections. Indent lists.
Feel free to reorganize or reformat to make the information more consumable.
Translate the answer to the same language of the question.
"""


def documentation_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: List[ConversationMessage],
) -> Union[Generator, str]:
    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    db = get_client()
    docs = db.docsection.find_many()
    most_similar_doc: Optional[DocSection] = None
    max_similarity = -2.0  # similarity is -1 to 1
    stats: Dict[str, Dict] = {"similarity": {}}
    for doc in docs:
        if not doc.vector:
            continue

        similarity = cosine_similarity(json.loads(doc.vector), query_vector)
        if similarity > max_similarity:
            most_similar_doc = doc
            max_similarity = similarity
        stats["similarity"][doc.title] = similarity

    if not most_similar_doc:
        raise NotImplementedError("No matching documentation found!")

    prompt = DOC_PROMPT % (most_similar_doc.title, most_similar_doc.text)
    prompt_msg = MessageDict(role="user", content=prompt)
    question_msg = MessageDict(
        role="user", content=QUESTION_TEMPLATE.format(question), type=MessageType.user
    )
    messages = msgs_to_msg_dicts(prev_msgs) + [prompt_msg, question_msg]  # type: ignore

    host_url = os.environ.get("HOST_URL", "https://na1.polyapi.io")
    if host_url != "https://na1.polyapi.io":
        content = f"The user's instance url is '{host_url}'. Use it to generate the urls for the poly instance specific links."
        messages.append(MessageDict(role="user", content=content))

    resp = get_chat_completion(messages, stream=True)
    store_messages(conversation_id, messages)

    return resp


def update_vector(doc_id: str) -> str:
    db = get_client()
    doc = db.docsection.find_unique(where={"id": doc_id})
    assert doc
    resp = openai.Embedding.create(input=doc.text, model="text-embedding-ada-002")
    vector = resp["data"][0]["embedding"]
    db.docsection.update(where={"id": doc_id}, data={"vector": json.dumps(vector)})
    return "updated!"
