""" search the poly docs for the suitable passage
then pass it to ChatGPT
then return the response
"""
import os
import json
from typing import Dict, Generator, List, Optional, Union
from flask import abort
import openai
from prisma import get_client
from prisma.models import ConversationMessage, DocSection
from prisma.types import DocSectionWhereInput
from app.constants import QUESTION_TEMPLATE, MessageType
from app.typedefs import MessageDict
from app.utils import (
    cosine_similarity,
    get_chat_completion,
    get_tenant_openai_key,
    msgs_to_msg_dicts,
    store_messages,
)

DOC_PROMPT = """
%s

This documentation was written for the purpose of an AI agent to consume it. Note there are hints to the AI agent included in the document using this notation: <<this is a hint to the AI>>. Feel free to use your own knowledge to elaborate these points where hints are included.

%s

%s

---

Answer the following question using markdown to format.
Please provide generous spacing between sections. Indent lists.
Feel free to reorganize or reformat to make the information more consumable.
Translate the answer to the same language of the question.
"""


# HACK replace these hardcoded tenant ids + tenant prompts with table in the DB
SYSTEM_TENANT_ID = None
# OPTORO_TENANT_ID = 'd314c8b7-2663-4286-83ff-3d623f1620f6'


def _get_tenant_prompt(tenantId: Optional[str]):
    if tenantId == SYSTEM_TENANT_ID:
        return "The following documentation helps users understand how to use Poly API a.k.a “Poly” or “PolyAPI” or “Poly AI Assistant”"
    # elif tenantId == OPTORO_TENANT_ID:
    #     return "The following documentation helps users understand how to use Optoro's platform called Optiturn. Optiturn is a platform which helps e-commerce and retail customers manage their returns. You are being prompted by a developer trying build integrations to Optiturn."
    else:
        return "The following documentation is internal company documentation."


def documentation_question(
    user_id: str,
    conversation_id: str,
    question: str,
    prev_msgs: List[ConversationMessage],
    *,
    docs_tenant_id: Optional[str],  # which tenantid to use for docs search?
    openai_tenant_id: Optional[str],  # which tenantid to use for openai key?
) -> Union[Generator, str]:
    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    db = get_client()
    where: DocSectionWhereInput = {"tenantId": docs_tenant_id}
    docs = db.docsection.find_many(where=where)
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
        abort(400, "No matching documentation found!")

    tenant_prompt = _get_tenant_prompt(docs_tenant_id)
    prompt = DOC_PROMPT % (tenant_prompt, most_similar_doc.title, most_similar_doc.text)
    prompt_msg = MessageDict(role="user", content=prompt)
    question_msg = MessageDict(
        role="user", content=QUESTION_TEMPLATE.format(question), type=MessageType.user
    )
    messages = msgs_to_msg_dicts(prev_msgs) + [prompt_msg, question_msg]  # type: ignore

    host_url = os.environ.get("HOST_URL", "https://na1.polyapi.io")
    if docs_tenant_id == SYSTEM_TENANT_ID and host_url != "https://na1.polyapi.io":
        content = f"The user's instance url is '{host_url}'. Use it to generate the urls for the poly instance specific links."
        messages.append(MessageDict(role="user", content=content))

    openai_api_key = get_tenant_openai_key(tenant_id=openai_tenant_id)
    resp = get_chat_completion(messages, stream=True, api_key=openai_api_key)
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


def update_poly_docs() -> None:
    with open("./data/docs.json") as f:
        docs = json.loads(f.read())

    db = get_client()
    for data in docs:
        doc = db.docsection.find_first(
            where={"title": data["title"], "context": data["context"], "tenantId": None}
        )
        if doc:
            db.docsection.update(where={"id": doc.id}, data={"text": data["text"]})
            print(f"{doc.title} updated")
        else:
            doc = db.docsection.create(
                data={
                    "title": data["title"],
                    "context": data["context"],
                    "text": data["text"],
                }
            )
            print(f"{doc.title} created!")
        update_vector(doc.id)