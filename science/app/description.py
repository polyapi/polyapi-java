from typing import Dict, List, Optional, Set, Union
import json
import openai
from app.typedefs import DescInputDto, DescOutputDto, ErrorDto
from app.utils import log
from prisma import get_client
from thefuzz import fuzz

# trim
# The name should allow me to understand if I am doing a get, post, delete, it should include a verb and the object. It should use the name of the system that it's for follow a convention of product.verbObject if possible. It should be as concise as possible and can use common product acronyms such as MS for microsoft, SFDC for salesforce etc... The name should be as short as possible and ideally only consist of two words and one "." Lastly dont use the same word for the name as found in the context, default to only one word if that is the case.

#  For example, if the context is "comms.twilio" and the name is "twilio.sendSMS", then the name should be "sendSMS" and not "twilio.sendSMS".

# Here are the existing contexts and names separated by dots:
# {contexts}
# Try to use an existing context if possible.


NAME_CONTEXT_DESCRIPTION_PROMPT = """
I will provide you information about an {call_type}.

Please give me a context, name and description for the {call_type}.

The context is a way of grouping similar {call_type}s.

The context and name can use '.' notation but cannot have any spaces or dashes.

The context and name should be in camelCase.

Don't repeat words in both the context and the name.

Don't repeat similar words in both the name and the context

The context should begin with the product. Then the resource. Then the action.

For example, to create a new product on shopify the context should be "shopify.products" and the name should be "create".

Resources should be plural. For example, shopify.products, shopify.orders, shopify.customers, etc.

The description should use keywords that makes search efficient. It can be a little redundant if that adds keywords but needs to remain human readable. It should be three to five sentences long.

Here is the {call_type}:

{short_description}
{method} {url}

Request Payload:
{payload}

Response Payload:
{response}

Please return JSON with three keys: context, name, description
"""


REVISION_PROMPT = """
Each of our functions has a context and a name.

Here's our existing contexts and names:

{existing}

Here's the proposed context and name for a new function:

{new}

We would like to have this function use an existing context if it makes sense.

We would like to have the new name follow similar patterns as the existing names.

Please determine the best context and name for this new function and return valid JSON with two keys: context, name
"""


def get_function_description(data: DescInputDto) -> Union[DescOutputDto, ErrorDto]:
    # contexts = _get_context_and_names()
    short = data.get("short_description", "")
    short = f"User given name: {short}" if short else ""
    prompt = NAME_CONTEXT_DESCRIPTION_PROMPT.format(
        url=data.get("url", ""),
        method=data.get("method", ""),
        short_description=short,
        payload=data.get("payload", "None"),
        response=data.get("response", "None"),
        call_type="API call",
        # contexts="\n".join(contexts),
    )
    prompt_msg = {"role": "user", "content": prompt}
    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo", temperature=0.2, messages=[prompt_msg]
    )
    completion = resp["choices"][0]["message"]["content"].strip()
    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        log_error(data, completion, prompt)
        return {"error": "Error parsing JSON from OpenAI: " + completion}

    if not rv["context"] or not rv["name"] or not rv["description"]:
        log_error(data, completion, prompt)
    else:
        # for now log EVERYTHING
        log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    # if rv["context"] and rv['name']:
    #     revision = _revise_to_match_existing_context_and_patterns(rv['context'], rv['name'])
    #     if revision:
    #         rv['context'] = revision['context']
    #         rv['name'] = revision['name']

    return rv


def get_webhook_description(data: DescInputDto) -> Union[DescOutputDto, ErrorDto]:
    # contexts = _get_context_and_names()
    short = data.get("short_description", "")
    short = f"User given name: {short}" if short else ""
    prompt = NAME_CONTEXT_DESCRIPTION_PROMPT.format(
      url=data.get("url", ""),
      method=data.get("method", ""),
      short_description=short,
      payload=data.get("payload", "None"),
      response=data.get("response", "None"),
      call_type="Event handler"
      # contexts="\n".join(contexts),
    )
    prompt_msg = {"role": "user", "content": prompt}
    resp = openai.ChatCompletion.create(
      model="gpt-3.5-turbo", temperature=0.2, messages=[prompt_msg]
    )
    completion = resp["choices"][0]["message"]["content"].strip()
    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        log_error(data, completion, prompt)
        return {"error": "Error parsing JSON from OpenAI: " + completion}

    if not rv["context"] or not rv["name"] or not rv["description"]:
        log_error(data, completion, prompt)
    else:
        # for now log EVERYTHING
        log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    # if rv["context"] and rv['name']:
    #     revision = _revise_to_match_existing_context_and_patterns(rv['context'], rv['name'])
    #     if revision:
    #         rv['context'] = revision['context']
    #         rv['name'] = revision['name']

    return rv


def _revise_to_match_existing_context_and_patterns(context: str, name: str) -> Optional[Dict]:
    existing = _get_existing_context_and_names()
    prompt = REVISION_PROMPT.format(
        existing="\n".join(json.dumps(e) for e in existing),
        new=json.dumps({"context": context, "name": name}),
    )
    prompt_msg = {"role": "user", "content": prompt}
    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo", temperature=0.2, messages=[prompt_msg]
    )
    completion = resp["choices"][0]["message"]["content"].strip()

    # just log it all for now!
    log("REVISION", "input:", f"{context}, {name}", "output:", completion, "prompt:", prompt, sep="\n")

    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        return None

    if rv["context"] and rv["name"]:
        return {"context": rv["context"], "name": rv["name"]}
    else:
        return None


def _get_existing_context_and_names() -> List[Dict]:
    db = get_client()
    rv = []
    for f in db.urlfunction.find_many():
        rv.append({"context": f.context, "name": f.name})
    return rv


def try_to_match_existing_context(from_openai: str) -> str:
    """ UNUSED ATM
    lets try to see if an existing context is highly similar
    to the context we get from openai
    if it is, let's use the existing context rather than the new one from openai
    """
    db = get_client()
    contexts = list({f.context for f in db.urlfunction.find_many()})
    # try to match the longest context first
    # otherwise we will match something like `weather` when `weather.forecast` is a better match
    contexts = sorted(contexts, key=lambda x: len(x), reverse=True)
    for context in contexts:
        if fuzz.token_set_ratio(from_openai, context) > 90:
            return context

    return from_openai


def _get_context_and_names() -> Set[str]:
    db = get_client()
    funcs = {
        ".".join([f.context, f.name]).lstrip(".") for f in db.urlfunction.find_many()
    }
    return funcs


def log_error(data: DescInputDto, completion: str, prompt: str) -> None:
    parts = [
        "Error getting context/name/description from OpenAI",
        "input:",
        str(data),
        "output:",
        completion,
        "prompt:",
        prompt,
    ]
    log("\n".join(parts))


def _parse_openai_response(completion: str) -> DescOutputDto:
    completion = completion.lstrip("JSON Response:").strip()
    data: Dict = json.loads(completion)

    rv = DescOutputDto(
        context=data.get("context", ""),
        name=data.get("name", ""),
        description=data.get("description", ""),
        openai_response=completion,
    )

    # make sure there are no spaces or dashes in context or name
    rv["name"] = rv["name"].replace(" ", "").replace("-", "")
    rv["context"] = rv["context"].replace(" ", "").replace("-", "")

    # parts = completion.split("\n")
    # for idx in range(len(parts)):
    #     part = parts[idx]
    #     part = part.strip()
    #     part_lowered = part.lower()  # sometimes OpenAI returns "context:", sometimes "Context:"

    #     if part_lowered.startswith("context:"):
    #         rv["context"] = part.split(":")[1].strip()
    #         if not rv["context"] and _value_on_next_line(parts, idx):
    #             # next line is context, grab it and move forward!
    #             rv['context'] = parts[idx + 1].strip()
    #             idx += 1

    #     elif part_lowered.startswith("name:"):
    #         rv["name"] = part.split(":")[1].strip()
    #         if not rv["name"] and _value_on_next_line(parts, idx):
    #             # next line is name, grab it and move forward!
    #             rv['name'] = parts[idx + 1].strip()
    #             idx += 1

    #     elif part_lowered.startswith("description:"):
    #         rv["description"] = part.split(":")[1].strip()
    #         if not rv["description"] and _value_on_next_line(parts, idx):
    #             # next line is description, grab it and move forward!
    #             rv['description'] = parts[idx + 1].strip()
    #             idx += 1

    #     idx += 1

    return rv


def _value_on_next_line(parts: list, idx: int) -> bool:
    try:
        next_line = parts[idx + 1].strip()
    except IndexError:
        return False

    next_line = next_line.lower()
    return (
        next_line
        and not next_line.startswith("context:")
        and not next_line.startswith("name:")
        and not next_line.startswith("description:")
    )
