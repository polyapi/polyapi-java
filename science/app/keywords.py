import json
import openai
from thefuzz import fuzz
from typing import Optional, Tuple, Union, List
from app.constants import VarName
from app.typedefs import StatsDict, ExtractKeywordDto, FunctionDto, WebhookDto
from app.utils import func_path, get_config_variable, log, remove_punctuation


KEYWORD_PROMPT = """For the following prompt, give me back both the keywords from my prompt and semantically similar keywords.
This will be used to power an API discovery service.
Each keyword must be a single word.
Keep the list to the top 8 keywords relevant to APIs.
Don't include "API" "resource" as keywords.
Include all of the likely HTTP methods for this prompt, for example many times search is done using a POST.

Here is the prompt:

{prompt}


"""


def get_similarity_threshold() -> int:
    # how similar does a function or webhook have to be to be considered a match?
    # scale is 0-100
    var = get_config_variable(VarName.keyword_similarity_threshold)
    return int(var.value) if var else 55


def get_function_match_limit() -> int:
    var = get_config_variable(VarName.function_match_limit)
    return int(var.value) if var else 5


def get_extract_keywords_temperature() -> float:
    var = get_config_variable(VarName.extract_keywords_temperature)
    return float(var.value) if var else 0.01


def extract_keywords(question: str) -> Optional[ExtractKeywordDto]:
    prompt = KEYWORD_PROMPT.format(prompt=question)
    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=get_extract_keywords_temperature(),
        messages=[
            {"role": "user", "content": prompt},
            {
                "role": "user",
                "content": 'Return JSON with keys "keywords", "semantically_similar_keywords", and "http_methods". Each value should be a string and in English.',
            },
        ],
    )
    content = resp["choices"][0]["message"]["content"]
    try:
        rv = json.loads(content)
    except Exception as e:
        log("Non-JSON response from OpenAI", e, content, sep="\n")
        return None

    # sometimes OpenAI returns lists instead of strings
    # let's coerce them to strings
    for key in ["keywords", "semantically_similar_keywords", "http_methods"]:
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


def keywords_similar(
    keywords: str, func: Union[FunctionDto, WebhookDto], debug=False
) -> Tuple[bool, int]:
    if not keywords:
        # when we have no keywords, just assume everything matches for now
        return True, -1

    keywords = keywords.lower()

    func_parts = []
    if func.get("context"):
        func_parts.append(func["context"])
    if func.get("name"):
        func_parts.append(func["name"])
    func_str = " ".join(func_parts).lower()

    # HACK just add description for now
    if func.get("description"):
        func_str += f"\n{func.get('description')}"

    keywords = remove_blacklist(keywords)

    similarity_score = fuzz.token_set_ratio(keywords, func_str)
    if debug:
        log(keywords, similarity_score, func_str)

    # separate description ratio
    # commented out for now
    #
    # desc_ratio = 0
    # if func.get("description"):
    #     desc_ratio = fuzz.partial_ratio(keywords, func["description"])
    #     if debug:
    #         log(keywords, desc_ratio, func['description'])

    return similarity_score > get_similarity_threshold(), similarity_score


VALID_HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}


def _filter_items_by_method(items: List[Union[FunctionDto, WebhookDto]], methods: str) -> List[Union[FunctionDto, WebhookDto]]:
    method_list = [m.strip() for m in methods.split(",").lower()]
    method_list = [m for m in method_list if m in VALID_HTTP_METHODS]
    if method_list:
        rv = []
        for item in items:
            if item.get("method"):
                pass
        return rv
    else:
        # just return all items if we could not detect any methods
        return items


def get_top_function_matches(
    items: List[Union[FunctionDto, WebhookDto]], keyword_data: ExtractKeywordDto
) -> Tuple[List[Union[FunctionDto, WebhookDto]], StatsDict]:
    """get top function matches based on keywords"""
    # for now ignore http_methods
    match_limit = get_function_match_limit()

    item = _filter_items_by_method(items, keyword_data["http_methods"])

    keyword_matches, keyword_stats = _get_top(
        match_limit, items, keyword_data["keywords"]
    )

    semantic_matches, semantic_stats = _get_top(
        match_limit,
        items,
        keyword_data.get("semantically_similar_keywords", ""),
    )

    keyword_match_uuids = {x["id"] for x in keyword_matches}
    for match in semantic_matches:
        if len(keyword_matches) >= match_limit:
            break

        if match["id"] not in keyword_match_uuids:
            keyword_matches.append(match)

    stats: StatsDict = {"keyword_extraction": keyword_data}
    stats["config"] = {
        "function_match_limit": match_limit,
        "similarity_threshold": get_similarity_threshold(),
        "extract_keywords_temperature": get_extract_keywords_temperature(),
    }
    stats["keyword_stats"] = keyword_stats
    stats["semantically_similar_stats"] = semantic_stats
    stats["match_count"] = _generate_match_count(stats)

    # TODO
    return keyword_matches, stats


def _generate_match_count(stats: StatsDict) -> int:
    threshold = get_similarity_threshold()
    matches = set()
    for name, score in stats["keyword_stats"]["scores"]:
        if score > threshold:
            matches.add(name)
    for name, score in stats["semantically_similar_stats"]["scores"]:
        if score > threshold:
            matches.add(name)
    return len(matches)


def _get_top(
    match_limit: int,
    items: List[Union[FunctionDto, WebhookDto]],
    keywords: str,
) -> Tuple[List[Union[FunctionDto, WebhookDto]], StatsDict]:
    threshold = get_similarity_threshold()

    if not keywords:
        return [], {"total": len(items), "match_count": 0, "scores": []}

    items_with_scores = []
    for item in items:
        _, score = keywords_similar(keywords, item)
        items_with_scores.append((item, score))

    items_with_scores = sorted(items_with_scores, key=lambda x: x[1], reverse=True)
    stats = _get_stats(items_with_scores)

    top_matches = [item for item, score in items_with_scores if score > threshold]
    return top_matches[:match_limit], stats


def _get_stats(
    items_with_scores: List[Tuple[Union[FunctionDto, WebhookDto], int]]
) -> StatsDict:
    stats: StatsDict = {"total": len(items_with_scores)}
    match_count = 0

    scores: List[Tuple[str, int]] = []
    for item, score in items_with_scores:
        if score > get_similarity_threshold():
            match_count += 1
        scores.append((func_path(item), score))

    stats["scores"] = scores
    stats["match_count"] = match_count
    return stats
