from enum import Enum, IntEnum, unique


# names for ConfigVariables
@unique
class VarName(Enum):
    function_keyword_similarity_threshold = "OpenAIKeywordSimilarityThreshold"
    variable_keyword_similarity_threshold = "OpenAIVariableKeywordSimilarityThreshold"
    function_match_limit = "OpenAIFunctionMatchLimit"
    extract_keywords_temperature = "OpenAIExtractKeywordsTemperature"


@unique
class MessageType(IntEnum):
    gpt = 1  # hidden messages between us and chatgpt
    user = 2  # what the user sees
    internal = 3  # totally internal messages for our own logging
    plugin = 4  # plugin api messages


CHAT_GPT_MODEL = "gpt-4-0613"

# standard question template where the FE knows how to extract the stuff in the quotes
QUESTION_TEMPLATE = 'Question: "{}"'
