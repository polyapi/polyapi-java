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
    openai_tenant_api_key = "OpenAITenantApiKey"


@unique
class MessageType(IntEnum):
    gpt = 1  # hidden messages between us and chatgpt
    user = 2  # what the user sees
    internal = 3  # totally internal messages for our own logging
    plugin = 4  # plugin api messages
    context = 5  # context that the user can't see but that should be included as context in subsequent requests


@unique
class PerfLogType(IntEnum):
    """ types for rows stored in PerfLog table
    """
    science_generate_description = 1
    science_api_execute = 2
    science_chat_code = 3
    science_chat_general = 4
    science_chat_help = 5
    science_chat_documentation = 6


CHAT_GPT_MODEL = "gpt-4-0613"

# standard question template where the FE knows how to extract the stuff in the quotes
QUESTION_TEMPLATE = 'Question: "{}"'
