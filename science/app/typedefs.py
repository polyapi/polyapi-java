from typing import Any, Dict, Optional, Tuple, TypedDict, List, Literal, Union
from typing_extensions import NotRequired
from prisma.models import ApiFunction, CustomFunction, AuthProvider, WebhookHandle, Variable


AnyFunction = Union[ApiFunction, CustomFunction, AuthProvider, WebhookHandle, Variable]


class DescInputDto(TypedDict):
    url: str
    method: str
    short_description: str
    payload: str
    response: str
    code: Optional[str]
    arguments: Optional[List[Dict]]


class DescOutputDto(TypedDict):
    name: str
    context: str
    description: str
    arguments: Optional[List[Dict]]
    openai_response: str


class VarDescInputDto(TypedDict):
    name: str
    context: str
    secret: bool
    value: Union[str, int, float, bool, Dict]


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
    description: str
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
    returnType: Dict[str, Any]
    synchronous: NotRequired[bool]


class SpecificationDto(TypedDict):
    id: str
    context: str
    name: str
    description: str
    function: Optional[FunctionSpecification]
    # variables have variable: {"secret": boolean} and NO function
    type: Literal['apiFunction', 'customFunction', 'serverFunction', 'authFunction', 'webhookHandle', 'serverVariable']


class MessageDict(TypedDict, total=False):
    role: str
    content: Optional[str]
    type: int
    name: NotRequired[str]
    function_call: NotRequired[Dict]


class ChatGptChoice(TypedDict):
    message: MessageDict  # no function_ids or webhook_ids
    finish_reason: Literal['stop', 'length', 'content_filter', None]
    index: int


class ChatCompletionResponse(TypedDict):
    choices: List[ChatGptChoice]


class StatsDict(TypedDict, total=False):
    prompt: str
    match_count: int
    total_functions: int
    total_variables: int
    function_scores: List[Tuple[str, int]]
    variable_scores: List[Tuple[str, int]]
    keyword_extraction: ExtractKeywordDto
    keyword_stats: 'StatsDict'
    semantically_similar_stats: 'StatsDict'
    config: Dict


class CompletionAnswer(TypedDict):
    answer: str
    stats: Dict