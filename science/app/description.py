import uuid
import json

from typing import Dict, List, Optional, Union
from app.typedefs import (
    DescInputDto,
    DescOutputDto,
    ErrorDto,
    MessageDict,
    SpecificationDto,
    VarDescInputDto,
)
from app.log import log, rlog_desc_info
from app.utils import (
    camel_case,
    extract_code,
    func_path_with_args,
    get_chat_completion,
    get_tenant_openai_key,
)

# this needs to be 300 or less for the OpenAPI spec
# however, OpenAI counts characters slightly differently than us (html escaped entities like `&29;`)
# so we set this 290 just to be safe
DESCRIPTION_LENGTH_LIMIT = 290


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

The description should use keywords that makes search efficient. It can be a little redundant if that adds keywords but
needs to remain human readable.

Here is the {call_type}:

{short_description}
{method} {url}

Request Payload:
{payload}

Response Payload:
{response}

{code}

Please return the context, name, and description in this format:

{format}
"""

FUNCTION_DESCRIPTION_RETURN_FORMAT = """{
    "context": "string",
    "name": "string",
    "description": "string"
}"""


ARGUMENT_DESCRIPTION_PROMPT = """
Consider the following function:

```
// {}
{}
```

Please give me the description for each of the arguments.

Return valid JSON in the following format:

{}
"""


ARGUMENT_DESCRIPTION_RETURN_FORMAT = """[{
    "name": "string",
    "description": "string"
}]"""


VARIABLE_DESCRIPTION_PROMPT = """
Here is data about a variable:

```
{
    "name": %s,
    "secret": %s,
    "value": %s
}
```

Please generate a description that says what the variable means and how it is used.

Assume your guesses are right and write the description confidently.

Don't include the current name, context, or value of the variable in the description.

Don't say whether the variable is secret or not.

Return it as JSON in the following format:

```
{"description": "foo"}
```
"""


def get_function_description(data: DescInputDto) -> Union[DescOutputDto, ErrorDto]:
    trace_id = uuid.uuid4().hex

    short = data.get("short_description", "")
    short = f"User given name: {short}" if short else ""
    prompt = NAME_CONTEXT_DESCRIPTION_PROMPT.format(
        url=data.get("url", ""),
        method=data.get("method", ""),
        short_description=short,
        payload=data.get("payload", "None"),
        response=data.get("response", "None"),
        code=_get_code_prompt(data.get("code")),
        call_type="API call",
        format=FUNCTION_DESCRIPTION_RETURN_FORMAT,
    )
    prompt_msg: MessageDict = {"role": "user", "content": prompt}
    limitations: MessageDict = {
        "role": "user",
        "content": f"The description must be {DESCRIPTION_LENGTH_LIMIT} characters or less.",
    }
    messages = [prompt_msg, limitations]
    tenant_id = data.get("tenantId")
    openai_api_key = get_tenant_openai_key(tenant_id=tenant_id)

    # go
    completion = get_chat_completion(messages, temperature=0.2, api_key=openai_api_key)
    assert isinstance(completion, str)
    completion = completion.strip()

    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        msg = "Error parsing JSON from OpenAI: "
        rlog_desc_info(trace_id, msg, dict(data), completion)
        return {"error": f"{trace_id}, {msg}, {completion}"}

    if not rv["context"] or not rv["name"] or not rv["description"]:
        rlog_desc_info(
            trace_id,
            "Error getting context/name/description from OpenAI",
            dict(data),
            completion,
        )
        rv["trace_id"] = trace_id
        return rv

    # for now log EVERYTHING
    rv["description"] = rv["description"][:300]
    log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    rv["arguments"] = get_argument_descriptions(
        openai_api_key,
        rv["context"],
        rv["name"],
        rv["description"],
        data.get("arguments", []),
    )
    log("argument descriptions generated:", json.dumps(rv["arguments"]))

    if _arguments_missing_descriptions(rv["arguments"]):
        rlog_desc_info(
            trace_id,
            "Some arguments did not get descriptions from OpenAI!",
            dict(data),
            json.dumps(rv["arguments"]),
        )
        rv["trace_id"] = trace_id

    return rv


def _arguments_missing_descriptions(args: Optional[List[Dict]]) -> bool:
    if not args:
        return True

    try:
        for arg in args:
            # TODO maybe figure out how to try nested args?
            if not arg.get("description"):
                return True
    except:
        # this data structure is not what we expect, just go ahead and say we are missing description!!
        return True

    return False


def get_argument_descriptions(
    api_key: Optional[str],
    context: str,
    name: str,
    description: str,
    arguments: Optional[List[Dict]],
):
    if not arguments:
        return []

    spec = SpecificationDto(
        id="unused",
        context=context,
        name=name,
        description=description,
        function={"arguments": arguments},  # type: ignore
        type="unused",  # type: ignore
    )
    path = func_path_with_args(spec)
    prompt = ARGUMENT_DESCRIPTION_PROMPT.format(
        description, path, ARGUMENT_DESCRIPTION_RETURN_FORMAT
    )
    prompt_msg = MessageDict(role="user", content=prompt)

    completion = get_chat_completion([prompt_msg], temperature=0.2, api_key=api_key)
    assert isinstance(completion, str)
    return extract_code(completion)


def _get_code_prompt(code: Optional[str]) -> str:
    if code:
        return f"Code:\n{code}"
    else:
        return ""


def get_webhook_description(data: DescInputDto) -> Union[DescOutputDto, ErrorDto]:
    trace_id = uuid.uuid4().hex

    tenant_id = data.get("tenantId")
    openai_api_key = get_tenant_openai_key(tenant_id=tenant_id)
    short = data.get("short_description", "")
    short = f"User given name: {short}" if short else ""
    prompt = NAME_CONTEXT_DESCRIPTION_PROMPT.format(
        url=data.get("url", ""),
        method=data.get("method", ""),
        short_description=short,
        payload=data.get("payload", "None"),
        response=data.get("response", "None"),
        code="",  # no code for webhooks
        call_type="Event handler",
        format=FUNCTION_DESCRIPTION_RETURN_FORMAT,
        # contexts="\n".join(contexts),
    )
    limitations: MessageDict = {
        "role": "user",
        "content": f"The description must be {DESCRIPTION_LENGTH_LIMIT} characters or less.",
    }
    prompt_msg: MessageDict = {"role": "user", "content": prompt}
    completion = get_chat_completion(
        [prompt_msg, limitations],
        temperature=0.2,
        api_key=openai_api_key,
    )
    assert isinstance(completion, str)
    completion = completion.strip()

    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        msg = "Error parsing JSON from OpenAI: "
        rlog_desc_info(trace_id, msg, dict(data), completion)
        return {"error": f"{trace_id}, {msg}, {completion}"}

    if not rv["context"] or not rv["name"] or not rv["description"]:
        rlog_desc_info(
            trace_id,
            "Error getting context/name/description from OpenAI",
            dict(data),
            completion,
        )
        rv["trace_id"] = trace_id
    else:
        # for now log EVERYTHING
        rv["description"] = rv["description"][:DESCRIPTION_LENGTH_LIMIT]
        log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    return rv


def _parse_openai_response(completion: str) -> DescOutputDto:
    completion = completion.lstrip("JSON Response:").strip()
    data: Dict = json.loads(completion)

    rv = DescOutputDto(
        context=data.get("context", ""),
        name=data.get("name", ""),
        description=data.get("description", ""),
        arguments=None,
        openai_response=completion,
    )

    # make sure there are no spaces or dashes in context or name
    rv["name"] = camel_case(rv["name"])
    rv["context"] = camel_case(rv["context"])
    return rv


def get_variable_description(data: VarDescInputDto) -> Dict:
    tenant_id = data.get("tenantId")
    openai_api_key = get_tenant_openai_key(tenant_id=tenant_id)
    func_name = data["context"] + "." + data["name"]
    prompt = VARIABLE_DESCRIPTION_PROMPT % (func_name, data["secret"], data["value"])
    messages = [MessageDict(role="user", content=prompt)]
    resp = get_chat_completion(messages, api_key=openai_api_key)
    assert isinstance(resp, str)
    resp = resp.strip("```")
    rv = json.loads(resp)
    return rv
