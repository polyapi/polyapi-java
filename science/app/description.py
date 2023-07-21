from typing import Dict, List, Optional, Union
import json
import openai
from app.typedefs import (
    DescInputDto,
    DescOutputDto,
    ErrorDto,
    MessageDict,
    SpecificationDto,
    VarDescInputDto,
)
from app.utils import camel_case, extract_code, func_path_with_args, get_chat_completion, log
from app.constants import CHAT_GPT_MODEL

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
needs to remain human readable. It should be limited to {description_length_limit} characters without losing meaning and also can be less than
{description_length_limit} characters if it makes sense.

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
    # contexts = _get_context_and_names()
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
        description_length_limit=DESCRIPTION_LENGTH_LIMIT,
        format=FUNCTION_DESCRIPTION_RETURN_FORMAT,
        # contexts="\n".join(contexts),
    )
    prompt_msg = {"role": "user", "content": prompt}

    resp = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL, temperature=0.2, messages=[prompt_msg]
    )
    completion = resp["choices"][0]["message"]["content"].strip()
    try:
        rv = _parse_openai_response(completion)
    except json.JSONDecodeError:
        log_error(data, completion, prompt)
        return {"error": "Error parsing JSON from OpenAI: " + completion}

    if not rv["context"] or not rv["name"] or not rv["description"]:
        log_error(data, completion, prompt)
        return rv

    # for now log EVERYTHING
    rv["description"] = rv["description"][:300]
    log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    rv["arguments"] = get_argument_descriptions(
        rv["context"], rv["name"], rv["description"], data.get("arguments", [])
    )
    return rv


def get_argument_descriptions(
    context: str, name: str, description: str, arguments: Optional[List[Dict]]
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
        description,
        path,
        ARGUMENT_DESCRIPTION_RETURN_FORMAT)
    prompt_msg = MessageDict(
        role="user",
        content=prompt
    )

    resp = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL, temperature=0.2, messages=[prompt_msg]
    )

    message: MessageDict = resp["choices"][0]["message"]
    return extract_code(message["content"])


def _get_code_prompt(code: Optional[str]) -> str:
    if code:
        return f"Code:\n{code}"
    else:
        return ""


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
        code="",  # no code for webhooks
        call_type="Event handler",
        description_length_limit=DESCRIPTION_LENGTH_LIMIT,
        format=FUNCTION_DESCRIPTION_RETURN_FORMAT,
        # contexts="\n".join(contexts),
    )
    prompt_msg = {"role": "user", "content": prompt}
    resp = openai.ChatCompletion.create(
        model=CHAT_GPT_MODEL, temperature=0.2, messages=[prompt_msg]
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
        rv["description"] = rv["description"][:DESCRIPTION_LENGTH_LIMIT]
        log("input:", str(data), "output:", completion, "prompt:", prompt, sep="\n")

    return rv


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
        arguments=None,
        openai_response=completion,
    )

    # make sure there are no spaces or dashes in context or name
    rv["name"] = camel_case(rv["name"])
    rv["context"] = camel_case(rv["context"])
    return rv


def get_variable_description(data: VarDescInputDto) -> Dict:
    func_name = data["context"] + "." + data["name"]
    prompt = VARIABLE_DESCRIPTION_PROMPT % (func_name, data["secret"], data["value"])
    messages = [MessageDict(role="user", content=prompt)]
    resp = get_chat_completion(messages)
    choice = resp["choices"][0]
    content = choice["message"]["content"].strip("```")
    rv = json.loads(content)
    return rv
