#!/usr/bin/env python3
from pathlib import Path
import json
from prisma import Prisma
from ..completion import (
    get_completion_answer,
    question_processing,
)
from ..server import get_function_prompt

db = Prisma()
db.connect()
# HACK why this no work?
# register(db)


def transform_to_jsonl() -> str:
    data = []
    # TODO add webhooks
    for func in db.apifunction.find_many(where={"NOT": {"description": ""}}):  # type: ignore
        question = f"how do I {func.description}?"
        parts = [question]
        prompt = "\n\n".join(parts)
        data.append(
            {
                "prompt": prompt,
                # TODO make a `converation_get_completion_answer`
                # and make this base one not require db/user_id
                "completion": get_completion_answer(base_prompt, question),
            }
        )

    abs_path = Path(__file__).parent
    jsonl_path = (abs_path / "../data/examples.jsonl").resolve()
    with open(jsonl_path, "w") as f:
        for d in data:
            f.write(json.dumps(d))
            f.write("\n")

    print(f"training data processed and written to {jsonl_path}")
    return str(jsonl_path)


if __name__ == "__main__":
    transform_to_jsonl()