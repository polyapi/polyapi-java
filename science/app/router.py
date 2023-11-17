from typing import Literal, Tuple


def split_route_and_question(question: str) -> Tuple[Literal["function", "general", "poly_documentation", "tenant_documentation", "help"], str]:
    question = question.strip()
    if question.startswith("/"):
        parts = question.split(" ", 1)

        route_cmd = parts[0]
        if len(parts) == 1:
            question = ""
        else:
            question = parts[1].strip()

        route = get_route(route_cmd)
        return route, question
    else:
        return "function", question


ROUTE_CMD_MAP = {
    "f": "function",
    "function": "function",
    "poly": "poly_documentation",
    "p": "poly_documentation",
    "documentation": "tenant_documentation",
    "docs": "tenant_documentation",
    "d": "tenant_documentation",
    "help": "help",
    "h": "help",
    "general": "general",
    "g": "general",
    # special route for error testing
    "error": "error",
}


def get_route(route_cmd: str) -> Literal["function", "general", "poly_documentation", "tenant_documentation", "help"]:
    route_cmd = route_cmd.lstrip("/")
    return ROUTE_CMD_MAP.get(route_cmd, "function")  # type: ignore