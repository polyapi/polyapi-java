from enum import Enum, unique


# names for ConfigVariables
@unique
class VarName(Enum):
    keyword_similarity_threshold = "keyword_similarity_threshold"
    function_match_limit = "function_match_limit"
    extract_keywords_temperature = "extract_keywords_temperature"


CHAT_GPT_MODEL = "gpt-3.5-turbo-0301"