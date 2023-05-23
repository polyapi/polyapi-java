from typing import Dict, Tuple, TypedDict, List, Literal, Union
from typing_extensions import NotRequired
from prisma.models import ApiFunction, CustomFunction, AuthProvider, WebhookHandle


AnyFunction = Union[ApiFunction, CustomFunction, AuthProvider, WebhookHandle]


class DescInputDto(TypedDict):
    url: str
    method: str
    short_description: str
    payload: str
    response: str


class DescOutputDto(TypedDict):
    name: str
    context: str
    description: str
    openai_response: str


class ErrorDto(TypedDict):
    error: str


class ExtractKeywordDto(TypedDict):
    keywords: str
    semantically_similar_keywords: str
    http_methods: str


# TODO: Not sure how to define this
class JsonSchema(TypedDict):
    todo: str


class PropertySpecification(TypedDict):
    name: str
    required: bool
    nullable: NotRequired[bool]
    type: "PropertyType"


class PropertyType(TypedDict):
    kind: Literal['void', 'primitive', 'array', 'object', 'function', 'plain']
    name: NotRequired[str]
    type: NotRequired[str]
    items: NotRequired['PropertyType']
    schema: NotRequired[JsonSchema]
    properties: NotRequired[List[PropertySpecification]]
    typeName: NotRequired[str]
    value: NotRequired[str]


class FunctionSpecification(TypedDict):
    arguments: List[PropertySpecification]
    returnType: Dict[str, str]
    synchronous: NotRequired[bool]


class SpecificationDto(TypedDict):
    id: str
    context: str
    name: str
    description: str
    function: FunctionSpecification
    type: Literal['apiFunction', 'customFunction', 'serverFunction', 'authFunction', 'webhookHandle']


class MessageDict(TypedDict, total=False):
    role: str
    content: str
    function_ids: List[str]  # not required
    webhook_ids: List[str]  # not required


class ChatGptChoice(TypedDict):
    message: MessageDict  # no function_ids or webhook_ids
    finish_reason: Literal['stop', 'length', 'content_filter', None]
    index: int


class ChatCompletionResponse(TypedDict):
    choices: List[ChatGptChoice]


class StatsDict(TypedDict, total=False):
    prompt: str
    total: int
    match_count: int
    scores: List[Tuple[str, int]]
    keyword_extraction: ExtractKeywordDto
    keyword_stats: 'StatsDict'
    semantically_similar_stats: 'StatsDict'
    config: Dict