import json
from thefuzz import fuzz
from typing import Optional, Tuple, List
from app.constants import VarName
from app.typedefs import MessageDict, StatsDict, ExtractKeywordDto, SpecificationDto
from app.utils import (
    func_path,
    get_chat_completion,
    get_config_variable,
    insert_internal_step_info,
    log,
    remove_punctuation,
    store_messages,
)
from prisma import get_client


KEYWORD_PROMPT = """For the following prompt, give me back the keywords from my prompt.
This will be used to power an API discovery service.
Each keyword must be a single word.
Return 8 or fewer keywords.
Return only the keywords most relevant to APIs or variables.
Don't include "API" or "resource" as keywords.

Here is the prompt:

"%s"

Return the keywords as a space separated list. Please return valid JSON in this format:

```
{"keywords": "foo bar"}
```
"""

KEYWORD_TRANSFORM_PROMPT = "Translate the keywords to English.  Please correct typos."


def get_function_similarity_threshold() -> int:
    # how similar does a function or webhook have to be to be considered a match?
    # scale is 0-100
    var = get_config_variable(VarName.function_keyword_similarity_threshold)
    return int(var.value) if var else 41


def get_variable_similarity_threshold() -> int:
    # how similar does a variable have to be to be considered a match?
    # scale is 0-100
    var = get_config_variable(VarName.variable_keyword_similarity_threshold)
    return int(var.value) if var else 35


def get_function_match_limit() -> int:
    var = get_config_variable(VarName.function_match_limit)
    return int(var.value) if var else 5


def get_extract_keywords_temperature() -> float:
    var = get_config_variable(VarName.extract_keywords_temperature)
    return float(var.value) if var else 0.01


def extract_keywords(
    user_id: str, conversation_id: str, question: str
) -> Optional[ExtractKeywordDto]:
    prompt = KEYWORD_PROMPT % question
    messages = [
        MessageDict(role="user", content=prompt),
        MessageDict(role="user", content=KEYWORD_TRANSFORM_PROMPT),
    ]
    content = get_chat_completion(
        messages,
        temperature=get_extract_keywords_temperature(),
    )
    assert isinstance(content, str)
    content = content.replace("```", "")

    # store conversation
    messages.append(MessageDict(role="assistant", content=content))
    insert_internal_step_info(messages, "STEP 1: GET KEYWORDS")
    store_messages(user_id, conversation_id, messages)

    # continue
    try:
        rv = json.loads(content)
    except Exception as e:
        log("Non-JSON response from OpenAI", e, content, sep="\n")
        return None

    # sometimes OpenAI returns lists instead of strings
    # let's coerce them to strings
    for key in ["keywords"]:
        if isinstance(rv[key], list):
            rv[key] = " ".join(rv[key])
            rv[key] = remove_punctuation(rv[key])

    return rv


BLACKLISTED = [
    "api",
]


def remove_blacklist(keywords: str) -> str:
    for blacklist in BLACKLISTED:
        keywords = keywords.replace(blacklist, "")
    return keywords


def _get_func_str(func: SpecificationDto) -> str:
    func_parts = []
    if func.get("context"):
        func_parts.append(func["context"])
    if func.get("name"):
        func_parts.append(func["name"])
    func_str = " ".join(func_parts).lower()

    if func.get("description"):
        func_str += f"\n{func.get('description')}"

    return func_str


def keywords_similar(
    keywords: str, func: SpecificationDto, debug=False
) -> Tuple[bool, int]:
    if not keywords:
        # when we have no keywords, just assume everything matches for now
        return True, -1

    keywords = keywords.lower()

    func_str = _get_func_str(func)

    keywords = remove_blacklist(keywords)

    similarity_score = fuzz.token_set_ratio(keywords, func_str)
    if debug:
        log(keywords, similarity_score, func_str)

    return similarity_score > get_function_similarity_threshold(), similarity_score


def get_top_function_matches(
    items: List[SpecificationDto], keyword_data: ExtractKeywordDto
) -> Tuple[List[SpecificationDto], StatsDict]:
    """get top function matches based on keywords"""
    match_limit = get_function_match_limit()

    # items = filter_items_based_on_http_method(items, keyword_data.get("http_methods"))

    keyword_matches, keyword_stats = _get_top(
        match_limit, items, keyword_data["keywords"]
    )

    stats: StatsDict = {"keyword_extraction": keyword_data}
    stats["config"] = {
        "match_limit": match_limit,
        "similarity_threshold": get_function_similarity_threshold(),
        "extract_keywords_temperature": get_extract_keywords_temperature(),
    }
    stats["keyword_stats"] = keyword_stats
    stats["match_count"] = _generate_match_count(stats)

    return keyword_matches, stats


def filter_items_based_on_http_method(
    items: List[SpecificationDto], http_methods: Optional[str]
) -> List[SpecificationDto]:
    if not http_methods:
        return items

    db = get_client()
    ids = [item.get("id", "") for item in items]
    result = db.apifunction.find_many(
        where={
            "id": {"in": ids},
        }
    )
    http_methods_set = {http_method.strip() for http_method in http_methods.split(",")}
    items_to_remove = {rs.id for rs in result if rs.method not in http_methods_set}
    items = [item for item in items if item.get("id") not in items_to_remove]
    return items


def _generate_match_count(stats: StatsDict) -> int:
    """for keyword matches, we only return up to `match_limit` matches
    this function counts how many potential matches crossed the similarity threshold
    """
    threshold = get_function_similarity_threshold()
    matches = set()
    for name, score in stats["keyword_stats"].get("function_scores", []):
        if score > threshold:
            matches.add(name)
    for name, score in stats["keyword_stats"].get("variable_scores", []):
        if score > threshold:
            matches.add(name)
    return len(matches)


def _get_top(
    match_limit: int,
    items: List[SpecificationDto],
    keywords: str,
) -> Tuple[List[SpecificationDto], StatsDict]:
    function_threshold = get_function_similarity_threshold()
    variable_threshold = get_variable_similarity_threshold()

    funcs = []
    variables = []
    for item in items:
        if item["type"] == "serverVariable":
            variables.append(item)
        else:
            funcs.append(item)

    if not keywords:
        return [], {
            "total_functions": len(funcs),
            "total_variables": len(variables),
            "match_count": 0,
        }

    functions_with_scores = []
    for func in funcs:
        _, score = keywords_similar(keywords, func)
        functions_with_scores.append((func, score))

    variables_with_scores = []
    for variable in variables:
        _, score = keywords_similar(keywords, variable)
        variables_with_scores.append((variable, score))

    functions_with_scores = sorted(
        functions_with_scores, key=lambda x: x[1], reverse=True
    )
    variables_with_scores = sorted(
        variables_with_scores, key=lambda x: x[1], reverse=True
    )
    top_functions = [
        item for item, score in functions_with_scores if score > function_threshold
    ]
    top_functions = top_functions[:match_limit]
    top_variables = [
        item for item, score in variables_with_scores if score > variable_threshold
    ]
    top_variables = top_variables[:match_limit]

    stats = _get_stats(functions_with_scores, variables_with_scores)
    return top_functions + top_variables, stats


def _get_stats(
    functions_with_scores: List[Tuple[SpecificationDto, int]],
    variables_with_scores: List[Tuple[SpecificationDto, int]],
) -> StatsDict:
    stats: StatsDict = {
        "total_functions": len(functions_with_scores),
        "total_variables": len(variables_with_scores),
    }
    match_count = 0

    function_scores: List[Tuple[str, int]] = []
    for item, score in functions_with_scores:
        if score > get_function_similarity_threshold():
            match_count += 1
        function_scores.append((func_path(item), score))

    variable_scores: List[Tuple[str, int]] = []
    for item, score in variables_with_scores:
        if score > get_function_similarity_threshold():
            match_count += 1
        variable_scores.append((func_path(item), score))

    stats["function_scores"] = function_scores
    stats["variable_scores"] = variable_scores
    stats["match_count"] = match_count
    return stats
