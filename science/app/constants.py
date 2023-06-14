from enum import Enum, IntEnum, unique


# names for ConfigVariables
@unique
class VarName(Enum):
    keyword_similarity_threshold = "keyword_similarity_threshold"
    function_match_limit = "function_match_limit"
    extract_keywords_temperature = "extract_keywords_temperature"


@unique
class MessageType(IntEnum):
    gpt = 1  # hidden messages between us and chatgpt
    user = 2  # what the user sees
    internal = 3  # totally internal messages for our own logging


CHAT_GPT_MODEL = "gpt-4-0613"
