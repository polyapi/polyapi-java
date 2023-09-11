from enum import Enum, IntEnum, unique


# names for ConfigVariables
@unique
class VarName(Enum):
    function_keyword_similarity_threshold = "OpenAIKeywordSimilarityThreshold"
    variable_keyword_similarity_threshold = "OpenAIVariableKeywordSimilarityThreshold"
    function_match_limit = "OpenAIFunctionMatchLimit"
    variable_match_limit = "OpenAIVariableMatchLimit"
    extract_keywords_temperature = "OpenAIExtractKeywordsTemperature"
    chat_conversation_lookback = "OpenAIChatConversationLookback"  # number of past messages to include for chat
    plugin_conversation_lookback = "OpenAIPluginConversationLookback"  # number of past messages to include for plugin


@unique
class MessageType(IntEnum):
    gpt = 1  # hidden messages between us and chatgpt
    user = 2  # what the user sees
    internal = 3  # totally internal messages for our own logging
    plugin = 4  # plugin api messages


CHAT_GPT_MODEL = "gpt-4-0613"

# standard question template where the FE knows how to extract the stuff in the quotes
QUESTION_TEMPLATE = 'Question: "{}"'
